// =============================================================================
// Zernio — Instagram (DMs, posts y automatizaciones de comentarios)
// =============================================================================
// Cliente de la API de Zernio (https://zernio.com/api/v1, auth bearer). Zernio
// envuelve la API de Instagram de Meta: acá NO se reintenta contra errores del
// upstream (Zernio ya reintenta contra Meta); un error se tira tipado
// (ZernioError, con el envelope del body) y lo maneja el caller.
//
// CREDENCIALES — BYOK con respaldo de plataforma:
//   · La key PROPIA del workspace manda: credWs('ZERNIO_API_KEY', ws).
//   · Sin key propia, cae a la key de PLATAFORMA (env ZERNIO_API_KEY vía
//     envCred). Excepción documentada al contrato de credWs, estilo Resend
//     "Opción A": la cuenta de Zernio es de la agencia, pero el AISLAMIENTO por
//     cliente lo da el PROFILE de Zernio — ensureProfile() crea un profile por
//     workspace y TODO listado se scopea a él (ver el porqué en listAccounts).
//
// TENANT-SAFETY: todos los helpers reciben `ws` EXPLÍCITO porque corren también
// en webhooks y crons (sin sesión). La tabla zernio_workspace se lee con el
// cliente crudo + .eq('workspace_id', ws) a propósito (mismo patrón que
// lib/webhook-routing.ts); está igual en TENANT_TABLES por si alguien la lee
// con getTenantDb desde un request.
//
// Contratos verificados contra el spec OpenAPI real (https://docs.zernio.com/api/openapi,
// v1.0.4) y https://docs.zernio.com/llms-full.txt — NO contra el repo GitHub
// zernio-dev/openapi-specs, que documenta las APIs de Meta, no la de Zernio.
// =============================================================================

import 'server-only';
import { credWs, envCred } from './credenciales';
import { getSupabaseServer } from './supabase';
import { OWNER_WS } from './workspace';
import { upsertRouting } from './webhook-routing';

const ZERNIO_BASE = 'https://zernio.com/api/v1';

// ── Error tipado (envelope canónico de Zernio) ───────────────────────────────
// Regla de la doc de Zernio: «Branch on type and code, never on error text».

export type ZernioErrorBody = {
  error?: string;
  /** invalid_request_error | authentication_error | permission_error | not_found | rate_limit_error | platform_error | api_error */
  type?: string;
  /** Código estable para máquinas (ej. 'profile_name_conflict'). */
  code?: string;
  param?: string;
  platform?: string;
  /** Payload crudo del upstream (Meta) verbatim, si type=platform_error. */
  platformError?: unknown;
  details?: unknown;
};

export class ZernioError extends Error {
  /** HTTP status de la respuesta; 0 si el error es local (config, red, base). */
  readonly status: number;
  readonly code: string | null;
  readonly type: string | null;
  readonly body: ZernioErrorBody | null;

  constructor(message: string, status: number, body: ZernioErrorBody | null) {
    super(message);
    this.name = 'ZernioError';
    this.status = status;
    this.code = body?.code ?? null;
    this.type = body?.type ?? null;
    this.body = body;
  }
}

// ── Config por workspace ─────────────────────────────────────────────────────

type ZernioCfg = {
  apiKey: string;
  /** true = el ws trae SU PROPIA cuenta de Zernio (key propia, no la del dueño). */
  byok: boolean;
};

async function cfg(ws: number): Promise<ZernioCfg> {
  const propia = await credWs('ZERNIO_API_KEY', ws);
  // Para el dueño, credWs ya cae a su env: eso es la cuenta de plataforma, no BYOK.
  if (propia) return { apiKey: propia, byok: ws !== OWNER_WS };
  const plataforma = await envCred('ZERNIO_API_KEY');
  if (plataforma) return { apiKey: plataforma, byok: false };
  throw new ZernioError('Zernio no configurado (ZERNIO_API_KEY: ni key propia ni de plataforma)', 0, null);
}

/** ¿Este workspace puede hablar con Zernio? (sin tirar; para /integraciones y gates). */
export async function zernioConfigurado(ws: number): Promise<boolean> {
  try {
    await cfg(ws);
    return true;
  } catch {
    return false;
  }
}

// ── fetch tipado ─────────────────────────────────────────────────────────────

async function zFetch<T>(
  apiKey: string,
  path: string,
  init?: RequestInit & { headers?: Record<string, string> },
): Promise<T> {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const b: ZernioErrorBody = body != null && typeof body === 'object'
      ? (body as ZernioErrorBody)
      : { error: text.slice(0, 300) };
    throw new ZernioError(`Zernio ${res.status}: ${b.error ?? text.slice(0, 200)}`, res.status, b);
  }
  if (body == null) {
    throw new ZernioError(`Zernio: respuesta no-JSON en ${path}`, res.status, { error: text.slice(0, 300) });
  }
  return body as T;
}

// ── Profiles (mapeo ws → profile, tabla zernio_workspace) ────────────────────

export type ZernioProfile = {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  isDefault?: boolean;
  createdAt?: string;
};

/**
 * Profile de Zernio del workspace. Contrato:
 *   · Si zernio_workspace ya tiene fila → devuelve su profile_id (string | null).
 *   · Si no hay fila y el ws es BYOK → guarda profile_id NULL y devuelve null:
 *     null significa "el profile Default de SU cuenta" (la cuenta es del cliente,
 *     no se le crea un profile con nombre nuestro).
 *   · Si no hay fila y usa la key de PLATAFORMA → POST /v1/profiles con nombre
 *     'mako_ws_<ws>' (un profile por workspace: es lo que aísla los datos de
 *     cada cliente dentro de la única cuenta de la agencia), guarda y devuelve
 *     el _id. Idempotency-Key estable → un retry replay-ea el create; un 409
 *     profile_name_conflict trae el id del existente en details.
 */
export async function ensureProfile(ws: number): Promise<string | null> {
  const db = getSupabaseServer();
  const { data, error: errSel } = await db
    .from('zernio_workspace')
    .select('profile_id')
    .eq('workspace_id', ws)
    .maybeSingle();
  if (errSel) throw new ZernioError(`zernio_workspace (select): ${errSel.message}`, 0, null);
  if (data) return (data.profile_id as string | null) ?? null;

  const c = await cfg(ws);

  if (c.byok) {
    const { error } = await db
      .from('zernio_workspace')
      .upsert({ workspace_id: ws, profile_id: null }, { onConflict: 'workspace_id' });
    if (error) throw new ZernioError(`zernio_workspace (upsert byok): ${error.message}`, 0, null);
    return null;
  }

  const nombre = `mako_ws_${ws}`;
  let profileId: string;
  try {
    const r = await zFetch<{ message?: string; profile: ZernioProfile }>(c.apiKey, '/profiles', {
      method: 'POST',
      headers: { 'Idempotency-Key': nombre },
      body: JSON.stringify({ name: nombre }),
    });
    profileId = r.profile._id;
  } catch (e) {
    // 409 con code profile_name_conflict: el profile ya existe (una corrida
    // anterior que no llegó a guardar, o una carrera) → details trae el id.
    // Cualquier otro error sube tal cual: acá no se traga nada.
    const existente =
      e instanceof ZernioError && e.status === 409
        ? (e.body?.details as { existingProfileId?: string } | undefined)?.existingProfileId
        : undefined;
    if (!existente) throw e;
    profileId = existente;
  }

  const { error } = await db
    .from('zernio_workspace')
    .upsert({ workspace_id: ws, profile_id: profileId }, { onConflict: 'workspace_id' });
  if (error) throw new ZernioError(`zernio_workspace (upsert): ${error.message}`, 0, null);

  // El webhook de Zernio va a rutear por account.profileId → se reclama acá,
  // donde el server acuña el identificador (primer reclamante gana; best-effort,
  // upsertRouting no lanza — mismo camino que landing_token en setSetting).
  await upsertRouting('zernio', profileId, ws);

  return profileId;
}

/**
 * profileId CONCRETO para pasarle a la API (varios endpoints lo exigen).
 * Para BYOK (ensureProfile → null = "default de la key") lo resuelve contra
 * GET /v1/profiles (el que tenga isDefault; el orden del listado es default
 * primero). También reclama el routing de ese id.
 */
async function profileIdEfectivo(ws: number, c: ZernioCfg): Promise<string | null> {
  const guardado = await ensureProfile(ws);
  if (guardado) return guardado;
  if (!c.byok) return guardado; // con key de plataforma ensureProfile siempre acuña
  const r = await zFetch<{ profiles: ZernioProfile[] }>(c.apiKey, '/profiles');
  const def = r.profiles.find((p) => p.isDefault) ?? r.profiles[0];
  if (!def) return null;
  await upsertRouting('zernio', def._id, ws);
  return def._id;
}

/** Profiles de la cuenta (GET /v1/profiles). Para diagnósticos/pantallas de conexión. */
export async function listProfiles(ws: number): Promise<ZernioProfile[]> {
  const c = await cfg(ws);
  const r = await zFetch<{ profiles: ZernioProfile[] }>(c.apiKey, '/profiles');
  return r.profiles ?? [];
}

// ── Connect (OAuth) ──────────────────────────────────────────────────────────

export type ZernioConnectUrl = { authUrl: string; state: string };

/**
 * URL de OAuth para conectar una cuenta (GET /v1/connect/{platform}).
 * Redirigir al usuario a authUrl; al volver, redirect_url trae
 * connected={platform}&profileId=…&accountId=…&username=… (modo estándar).
 * OJO: el query param es `redirect_url` (snake_case), no redirectUrl.
 */
export async function getConnectUrl(
  ws: number,
  platform: 'instagram' | 'facebook' = 'instagram',
  redirectUrl?: string,
): Promise<ZernioConnectUrl> {
  const c = await cfg(ws);
  const profileId = await profileIdEfectivo(ws, c);
  if (!profileId) {
    throw new ZernioError('Zernio: la cuenta no tiene ningún profile para conectar', 0, null);
  }
  const q = new URLSearchParams({ profileId });
  if (redirectUrl) q.set('redirect_url', redirectUrl);
  return zFetch<ZernioConnectUrl>(c.apiKey, `/connect/${platform}?${q.toString()}`);
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export type ZernioAccount = {
  _id: string;
  platform: string;
  username: string;
  displayName?: string;
  profileUrl?: string;
  isActive?: boolean;
  /** Populado como objeto en el listado; puede venir como string en otros lados. */
  profileId?: { _id: string; name?: string; slug?: string } | string;
};

/**
 * Cuentas sociales conectadas del WORKSPACE (GET /v1/accounts, filtrado por su
 * profile). El filtro por profileId NO es opcional con la key de plataforma: la
 * cuenta de Zernio de la agencia contiene los profiles de TODOS los workspaces,
 * y sin filtro un cliente vería las cuentas de otro.
 */
export async function listAccounts(
  ws: number,
  opts?: { platform?: string; status?: 'connected' | 'disconnected' },
): Promise<ZernioAccount[]> {
  const c = await cfg(ws);
  const profileId = await profileIdEfectivo(ws, c);
  if (!profileId && !c.byok) {
    // Guard en positivo: solo se lista sin filtro cuando la cuenta es DEL cliente.
    throw new ZernioError('Zernio: sin profile del workspace para listar cuentas', 0, null);
  }
  const q = new URLSearchParams();
  if (profileId) q.set('profileId', profileId);
  if (opts?.platform) q.set('platform', opts.platform);
  if (opts?.status) q.set('status', opts.status);
  const r = await zFetch<{ accounts: ZernioAccount[] }>(c.apiKey, `/accounts?${q.toString()}`);
  return r.accounts ?? [];
}

// ── Posts ────────────────────────────────────────────────────────────────────

export type ZernioMediaItem = {
  type: 'image' | 'video' | 'gif' | 'document';
  /** URL HTTPS pública (para media del bucket ig-media: una URL firmada). */
  url: string;
  title?: string;
  altText?: string;
  filename?: string;
  mimeType?: string;
  thumbnail?: string;
  instagramThumbnail?: string;
};

export type ZernioPostPlatform = {
  platform: string;
  accountId: string;
  customContent?: string;
  /** Override de programación por plataforma (date-time). */
  scheduledFor?: string;
  /** Por plataforma: p.ej. { contentType: 'story' | 'reel' }, firstComment, etc. */
  platformSpecificData?: Record<string, unknown>;
};

export type ZernioPost = {
  _id: string;
  title?: string;
  content?: string;
  mediaItems?: ZernioMediaItem[];
  platforms?: Array<{
    platform: string;
    accountId?: unknown; // populado como objeto en el response del create
    status?: string; // 'pending' → 'published'
    publishedAt?: string;
    platformPostId?: string;
    platformPostUrl?: string;
  }>;
  scheduledFor?: string | null;
  timezone?: string;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'partial' | string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type CrearPostInput = {
  content?: string;
  title?: string;
  mediaItems?: ZernioMediaItem[];
  /** Requerido para no-drafts. */
  platforms: ZernioPostPlatform[];
  /**
   * OJO al clásico bug de zonas del contrato: con sufijo Z u offset explícito es
   * un instante absoluto y `timezone` SE IGNORA; SIN zona ('2026-08-01T10:00:00')
   * es hora de pared en `timezone` (default UTC).
   */
  scheduledFor?: string;
  /** IANA (ej. 'America/Mexico_City'). Inválido ⇒ 400. */
  timezone?: string;
  publishNow?: boolean;
  isDraft?: boolean;
  /** Vuelve como eco en los webhooks post.* → poner acá el id local (contenido_posts.id). */
  metadata?: Record<string, unknown>;
  /**
   * Header x-request-id (uuid). Un retry con el mismo id dentro de ~5 min
   * devuelve el post original en vez de duplicar. Generar UNO por post local,
   * nunca reusar entre posts (pitfall documentado de n8n/Zapier).
   */
  requestId?: string;
};

/** Crea un post (POST /v1/posts). 409 = dedup por content-hash (24h) con details.existingPostId. */
export async function createPost(
  ws: number,
  input: CrearPostInput,
): Promise<{ message?: string; post: ZernioPost }> {
  const c = await cfg(ws);
  const { requestId, ...body } = input;
  return zFetch<{ message?: string; post: ZernioPost }>(c.apiKey, '/posts', {
    method: 'POST',
    headers: requestId ? { 'x-request-id': requestId } : {},
    body: JSON.stringify(body),
  });
}

/** Un post por id (GET /v1/posts/{postId}). */
export async function getPost(ws: number, postId: string): Promise<ZernioPost> {
  const c = await cfg(ws);
  const r = await zFetch<{ post: ZernioPost }>(c.apiKey, `/posts/${encodeURIComponent(postId)}`);
  return r.post;
}

/**
 * Borra un post (DELETE /v1/posts/{postId}). Solo draft/scheduled: un post ya
 * publicado da 400 (el unpublish es otro endpoint y otra decisión — no se
 * "borra" contenido publicado desde acá).
 */
export async function deletePost(ws: number, postId: string): Promise<{ message?: string }> {
  const c = await cfg(ws);
  return zFetch<{ message?: string }>(c.apiKey, `/posts/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
  });
}

// ── Inbox (DMs) ──────────────────────────────────────────────────────────────

export type ZernioConversation = {
  /** Opaco: pasarlo verbatim a getConversation/sendDm. */
  id: string;
  platform: string;
  accountId: string;
  accountUsername?: string;
  participantId?: string;
  participantName?: string;
  participantPicture?: string;
  lastMessage?: string;
  updatedTime?: string;
  status?: 'active' | 'archived' | string;
  unreadCount?: number | null;
  url?: string;
  instagramProfile?: {
    isFollower?: boolean;
    isFollowing?: boolean;
    followerCount?: number;
    isVerified?: boolean;
    fetchedAt?: string;
  };
  /** Atribución de ads (familias ctwa_* / meta_ad_*, nunca juntas). */
  metadata?: Record<string, unknown> | null;
};

export type ZernioPagination = { hasMore: boolean; nextCursor: string | null };

/**
 * Conversaciones del inbox (GET /v1/inbox/conversations), SIEMPRE scopeadas al
 * workspace: por accountId si viene, si no por su profileId (mismo motivo que
 * listAccounts — la key de plataforma ve todos los workspaces).
 *
 * GOTCHA del contrato: IG/FB replayan hasta 500 conversaciones de historia
 * PRE-conexión, sin webhooks y ya leídas — no tratarlas como mensajes nuevos.
 */
export async function listConversations(
  ws: number,
  opts?: {
    accountId?: string;
    platform?: 'instagram' | 'facebook';
    status?: 'active' | 'archived';
    sortOrder?: 'asc' | 'desc';
    limit?: number; // 1-100, default 50
    cursor?: string;
  },
): Promise<{ data: ZernioConversation[]; pagination: ZernioPagination; meta?: unknown }> {
  const c = await cfg(ws);
  const q = new URLSearchParams();
  if (opts?.accountId) {
    q.set('accountId', opts.accountId);
  } else {
    const profileId = await profileIdEfectivo(ws, c);
    if (!profileId) {
      throw new ZernioError('Zernio: sin profile ni accountId para listar conversaciones', 0, null);
    }
    q.set('profileId', profileId);
  }
  if (opts?.platform) q.set('platform', opts.platform);
  if (opts?.status) q.set('status', opts.status);
  if (opts?.sortOrder) q.set('sortOrder', opts.sortOrder);
  if (opts?.limit) q.set('limit', String(opts.limit));
  if (opts?.cursor) q.set('cursor', opts.cursor);
  return zFetch(c.apiKey, `/inbox/conversations?${q.toString()}`);
}

export type ZernioMessage = {
  id: string;
  conversationId: string;
  accountId: string;
  platform: string;
  message?: string | null;
  senderId?: string;
  senderName?: string | null;
  direction: 'incoming' | 'outgoing';
  createdAt?: string;
  /**
   * OJO (contrato): en IG/FB `url` es una CDN de Meta firmada que EXPIRA — NO
   * persistirla. Lo seguro de guardar es `refreshUrl` (re-mintea la URL).
   */
  attachments?: Array<{
    id?: string;
    type?: 'image' | 'video' | 'audio' | 'file' | 'sticker' | 'share' | string;
    url?: string;
    refreshUrl?: string | null;
    filename?: string;
    previewUrl?: string;
  }>;
  storyReply?: boolean | null;
  isStoryMention?: boolean | null;
  isDeleted?: boolean;
  deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed' | 'deleted' | null;
  deliveryError?: { code?: string; title?: string; message?: string };
  reactions?: Array<{ emoji?: string; fromMe?: boolean; reactedAt?: string }>;
  metadata?: Record<string, unknown>;
};

/**
 * Mensajes de una conversación (GET /v1/inbox/conversations/{id}/messages).
 * `accountId` es REQUERIDO por el endpoint. Es read-only: NO marca leído (eso
 * es POST /v1/inbox/conversations/{id}/read, no implementado en esta base).
 */
export async function getConversation(
  ws: number,
  conversationId: string,
  accountId: string,
  opts?: { limit?: number; cursor?: string; sortOrder?: 'asc' | 'desc' },
): Promise<{
  messages: ZernioMessage[];
  pagination: ZernioPagination;
  sortOrderApplied?: 'asc' | 'desc';
}> {
  const c = await cfg(ws);
  const q = new URLSearchParams({ accountId });
  if (opts?.limit) q.set('limit', String(opts.limit));
  if (opts?.cursor) q.set('cursor', opts.cursor);
  if (opts?.sortOrder) q.set('sortOrder', opts.sortOrder);
  return zFetch(
    c.apiKey,
    `/inbox/conversations/${encodeURIComponent(conversationId)}/messages?${q.toString()}`,
  );
}

export type EnviarDmInput = {
  /** Social account ID del ws (requerido por el endpoint de Zernio). */
  accountId: string;
  texto?: string;
  /** URL pública del adjunto. */
  adjuntoUrl?: string;
  adjuntoTipo?: 'image' | 'video' | 'audio' | 'file';
  /**
   * Para mandar FUERA de la ventana de 24h de Meta. Instagram solo soporta
   * HUMAN_AGENT (el contrato lo dice literal); implica messagingType MESSAGE_TAG.
   */
  tag?: 'HUMAN_AGENT';
  /**
   * Header Idempotency-Key (≤255): mismo key+body ⇒ replay del response
   * original; mismo key+body distinto ⇒ 422; en vuelo ⇒ 409. Retención 24h.
   * Usar un id derivado del borrador local (ej. `ig_borrador_<id>`).
   */
  idempotencyKey?: string;
};

/**
 * Envía un DM en una conversación existente
 * (POST /v1/inbox/conversations/{conversationId}/messages).
 * 400 con code PLATFORM_LIMITATION = restricción de Meta (p.ej. fuera de
 * ventana sin tag); el detalle crudo de Meta viene en body.platformError.
 */
export async function sendDm(
  ws: number,
  conversationId: string,
  input: EnviarDmInput,
): Promise<{ messageId: string | null }> {
  const c = await cfg(ws);
  if (!input.texto && !input.adjuntoUrl) {
    throw new ZernioError('sendDm: hace falta texto o adjunto', 0, null);
  }
  const body: Record<string, unknown> = { accountId: input.accountId };
  if (input.texto) body.message = input.texto;
  if (input.adjuntoUrl) {
    body.attachmentUrl = input.adjuntoUrl;
    if (input.adjuntoTipo) body.attachmentType = input.adjuntoTipo;
  }
  if (input.tag) {
    body.messagingType = 'MESSAGE_TAG';
    body.messageTag = input.tag;
  }
  const r = await zFetch<{ success?: boolean; data?: { messageId?: string } }>(
    c.apiKey,
    `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey } : {},
      body: JSON.stringify(body),
    },
  );
  return { messageId: r.data?.messageId ?? null };
}

// ── Comment automations (comentario → DM) ────────────────────────────────────

export type ZernioAutomation = {
  id: string;
  name: string;
  platform?: string;
  trigger?: 'comment' | 'story_reply' | string;
  platformPostId?: string | null;
  keywords?: string[];
  matchMode?: 'exact' | 'contains' | 'word' | string;
  excludeKeywords?: string[];
  dmMessage?: string;
  commentReply?: string | null;
  isActive?: boolean;
  stats?: { totalTriggered?: number; totalSent?: number; totalFailed?: number };
  createdAt?: string;
};

export type CrearAutomationInput = {
  name: string;
  /** ≤640 chars con buttons; ~1000 sin. */
  dmMessage: string;
  trigger?: 'comment' | 'story_reply';
  /** Media/post ID de la PLATAFORMA. Omitir = automatización account-wide (cualquier post). */
  platformPostId?: string;
  /** Zernio post ID; solo tiene sentido junto a platformPostId. */
  postId?: string;
  postTitle?: string;
  /** Vacío = cualquier comentario dispara. */
  keywords?: string[];
  /**
   * Default de Zernio: 'contains' — OJO, matchea DENTRO de otra palabra ('app'
   * dispara en 'happy'). Para keywords cortas conviene 'word'.
   */
  matchMode?: 'exact' | 'contains' | 'word';
  excludeKeywords?: string[];
  /** Respuesta pública al comentario (opcional, además del DM). */
  commentReply?: string;
  buttons?: Array<{
    type: 'url' | 'postback' | 'phone';
    title: string; // ≤20
    url?: string;
    payload?: string;
    phone?: string;
  }>;
  dmDelaySeconds?: number; // 0-86400
  commentReplyDelaySeconds?: number; // 0-86400 (nunca antes del DM)
  linkTracking?: boolean;
  clickTag?: string;
};

/**
 * Crea una automatización de comentarios (POST /v1/comment-automations).
 * 409 = ya existe una automatización activa per-post para ese platformPostId.
 */
export async function createCommentAutomation(
  ws: number,
  accountId: string,
  input: CrearAutomationInput,
): Promise<ZernioAutomation> {
  const c = await cfg(ws);
  const profileId = await profileIdEfectivo(ws, c);
  if (!profileId) {
    throw new ZernioError('Zernio: sin profile del workspace para crear la automatización', 0, null);
  }
  const r = await zFetch<{ success?: boolean; automation: ZernioAutomation }>(
    c.apiKey,
    '/comment-automations',
    {
      method: 'POST',
      body: JSON.stringify({ profileId, accountId, ...input }),
    },
  );
  return r.automation;
}

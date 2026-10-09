// =============================================================================
// Zernio — el cliente de la API, para Instagram y Messenger como canales del Chatbot
// =============================================================================
// Restaurado el 09/10/2026 (sexta tanda, CRON 4: «ya tenemos la integración de Zernio, utiliza eso
// para poder enviar mensajes por allí»). El de antes (commit 8d16c6ff^) hablaba de posts, de la
// bandeja y de las automatizaciones de comentarios de Zernio; éste sólo lo que el CANAL necesita:
// la cuenta, las cuentas conectadas, el webhook, mandar un DM y la respuesta privada a un comentario.
//
// Zernio (https://zernio.com/api/v1, auth bearer) envuelve las APIs de Instagram y de Facebook de
// Meta. Un error se tira TIPADO (`ZernioError`, con el envelope del body); Zernio ya reintenta
// contra Meta, así que acá no se reintenta nada.
//
// CREDENCIALES — BYOK con respaldo de plataforma:
//   · La key PROPIA del workspace manda: `credWs('ZERNIO_API_KEY', ws)`. Medido el 09/10/2026 en
//     producción: los dos workspaces con Zernio (ws11 y ws13) tienen key propia.
//   · Sin key propia, la de la PLATAFORMA (`envCred`), y el aislamiento lo da el PROFILE de Zernio:
//     uno por workspace (`ensureProfile`), y todo listado se filtra por él.
//
// TENANT-SAFETY: todo recibe `ws` EXPLÍCITO (corre en webhooks y crons, sin sesión). La tabla
// `zernio_workspace` se lee con el cliente crudo y `.eq('workspace_id', ws)`, igual que
// lib/webhook-routing.ts.

import 'server-only';
import { credWs, envCred } from './credenciales';
import { getSupabaseServer } from './supabase';
import { OWNER_WS } from './workspace';
import { upsertRouting } from './webhook-routing';
import { linkApp } from './app-url';

const ZERNIO_BASE = 'https://zernio.com/api/v1';

/** Los servicios de `webhook_routing`: el profile (lo acuña el server) y la cuenta conectada. */
export const RUTEO_PERFIL = 'zernio';
export const RUTEO_CUENTA = 'zernio_cuenta';

/**
 * Los eventos que el canal escucha: los que se suscriben al registrar el webhook Y los que el webhook
 * procesa (app/api/webhooks/zernio/route.ts importa esta lista). Sin `message.sent`: lo que le llegó a
 * cada lead ya está en `nutricion_envios.texto_enviado`. La tabla, en docs/hallazgos-chatbot.md.
 */
export const EVENTOS_WEBHOOK = ['message.received', 'referral.received', 'comment.received', 'account.connected'] as const;

// ── Error tipado (envelope de Zernio: «Branch on type and code, never on error text») ──

export type ZernioErrorBody = {
  error?: string;
  type?: string;
  code?: string;
  param?: string;
  platform?: string;
  platformError?: unknown;
  details?: unknown;
};

export class ZernioError extends Error {
  /** HTTP status; 0 si el error es local (config, red, base). */
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

type ZernioCfg = { apiKey: string; byok: boolean };

async function cfg(ws: number): Promise<ZernioCfg> {
  const propia = await credWs('ZERNIO_API_KEY', ws);
  // Para el dueño, credWs ya cae a su env: eso es la cuenta de plataforma, no BYOK.
  if (propia) return { apiKey: propia, byok: ws !== OWNER_WS };
  const plataforma = await envCred('ZERNIO_API_KEY');
  if (plataforma) return { apiKey: plataforma, byok: false };
  throw new ZernioError('Zernio no está configurado', 0, null);
}

/** ¿Este workspace puede hablar con Zernio? Sin tirar. */
export async function zernioConfigurado(ws: number): Promise<boolean> {
  try { await cfg(ws); return true; } catch { return false; }
}

async function zFetch<T>(apiKey: string, path: string, init?: RequestInit & { headers?: Record<string, string> }): Promise<T> {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json', ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!res.ok) {
    const b: ZernioErrorBody = body != null && typeof body === 'object' ? (body as ZernioErrorBody) : { error: text.slice(0, 300) };
    throw new ZernioError(`Zernio ${res.status}: ${b.error ?? text.slice(0, 200)}`, res.status, b);
  }
  if (body == null) throw new ZernioError(`Zernio: respuesta no-JSON en ${path}`, res.status, { error: text.slice(0, 300) });
  // ⚠️ UN 200 NO ES «SALIÓ BIEN» (AGENTS.md): si el envelope trae `success: false`, es un fallo.
  if ((body as { success?: unknown }).success === false) {
    const b = body as ZernioErrorBody;
    throw new ZernioError(`Zernio: ${b.error ?? 'success: false'}`, res.status, b);
  }
  return body as T;
}

// ── Profiles ─────────────────────────────────────────────────────────────────

type ZernioProfile = { _id: string; name: string; isDefault?: boolean };

/**
 * El profile de Zernio del workspace. Con la key de PLATAFORMA crea uno por workspace (`mako_ws_<ws>`,
 * lo que aísla a cada cliente dentro de la cuenta de la agencia); con key PROPIA, `null` = el Default
 * de SU cuenta. Reclama el ruteo del profile (`RUTEO_PERFIL`): el webhook rutea por él.
 */
export async function ensureProfile(ws: number): Promise<string | null> {
  const db = getSupabaseServer();
  const { data, error: errSel } = await db.from('zernio_workspace').select('profile_id').eq('workspace_id', ws).maybeSingle();
  if (errSel) throw new ZernioError(`zernio_workspace (select): ${errSel.message}`, 0, null);
  if (data) return (data.profile_id as string | null) ?? null;
  const c = await cfg(ws);
  if (c.byok) {
    const { error } = await db.from('zernio_workspace').upsert({ workspace_id: ws, profile_id: null }, { onConflict: 'workspace_id' });
    if (error) throw new ZernioError(`zernio_workspace (upsert byok): ${error.message}`, 0, null);
    return null;
  }
  const nombre = `mako_ws_${ws}`;
  let profileId: string;
  try {
    const r = await zFetch<{ profile: ZernioProfile }>(c.apiKey, '/profiles', {
      method: 'POST', headers: { 'Idempotency-Key': nombre }, body: JSON.stringify({ name: nombre }),
    });
    profileId = r.profile._id;
  } catch (e) {
    const existente = e instanceof ZernioError && e.status === 409
      ? (e.body?.details as { existingProfileId?: string } | undefined)?.existingProfileId
      : undefined;
    if (!existente) throw e;
    profileId = existente;
  }
  const { error } = await db.from('zernio_workspace').upsert({ workspace_id: ws, profile_id: profileId }, { onConflict: 'workspace_id' });
  if (error) throw new ZernioError(`zernio_workspace (upsert): ${error.message}`, 0, null);
  await upsertRouting(RUTEO_PERFIL, profileId, ws);
  return profileId;
}

/** El profile CONCRETO (con key propia, el Default de su cuenta). También reclama su ruteo. */
async function profileIdEfectivo(ws: number, c: ZernioCfg): Promise<string | null> {
  const guardado = await ensureProfile(ws);
  if (guardado) return guardado;
  if (!c.byok) return guardado;
  const r = await zFetch<{ profiles: ZernioProfile[] }>(c.apiKey, '/profiles');
  const def = r.profiles.find((p) => p.isDefault) ?? r.profiles[0];
  if (!def) return null;
  await upsertRouting(RUTEO_PERFIL, def._id, ws);
  return def._id;
}

// ── Cuentas ──────────────────────────────────────────────────────────────────

export type ZernioAccount = {
  _id: string;
  platform: string;
  username: string;
  displayName?: string;
  isActive?: boolean;
  profileId?: { _id: string } | string;
};

/**
 * Las cuentas conectadas del WORKSPACE (filtradas por su profile: con la key de plataforma, sin
 * filtro un cliente vería las de otro). Y RECLAMA el ruteo de cada una (`RUTEO_CUENTA`): un
 * `comment.received` trae SÓLO `account.accountId`, sin el profile (medido en la doc del webhook,
 * 09/10/2026), así que sin esta fila un comentario no tiene de quién ser.
 */
export async function cuentasConectadas(ws: number, plataforma?: 'instagram' | 'facebook'): Promise<ZernioAccount[]> {
  const c = await cfg(ws);
  const profileId = await profileIdEfectivo(ws, c);
  if (!profileId && !c.byok) throw new ZernioError('Zernio: el workspace no tiene profile', 0, null);
  const q = new URLSearchParams();
  if (profileId) q.set('profileId', profileId);
  if (plataforma) q.set('platform', plataforma);
  const r = await zFetch<{ accounts: ZernioAccount[] }>(c.apiKey, `/accounts?${q.toString()}`);
  const cuentas = (r.accounts ?? []).filter((a) => a.platform === 'instagram' || a.platform === 'facebook');
  for (const a of cuentas) await upsertRouting(RUTEO_CUENTA, a._id, ws);
  return cuentas;
}

/** La URL de OAuth para conectar una cuenta. Al volver, Zernio redirige a `redirect_url`. */
export async function urlParaConectar(ws: number, plataforma: 'instagram' | 'facebook', redirectUrl: string): Promise<string> {
  const c = await cfg(ws);
  const profileId = await profileIdEfectivo(ws, c);
  if (!profileId) throw new ZernioError('Zernio: la cuenta no tiene ningún profile para conectar', 0, null);
  const q = new URLSearchParams({ profileId, redirect_url: redirectUrl });
  const r = await zFetch<{ authUrl: string }>(c.apiKey, `/connect/${plataforma}?${q.toString()}`);
  return r.authUrl;
}

// ── El webhook ───────────────────────────────────────────────────────────────

type ZernioWebhook = { _id: string; url?: string; events?: string[]; isActive?: boolean };

/**
 * QUE ZERNIO LE AVISE A MAKO, con la cuenta del workspace. Idempotente: si ya hay un webhook a
 * nuestra URL, se le pone el secreto y los eventos; si no, se crea.
 *
 * ⚠️ SIN ESTO NO LLEGA NADA, Y NO DA ERROR. Medido el 09/10/2026 en producción: los dos workspaces
 * con Zernio (ws11 y ws13) tienen key PROPIA y `zernio_workspace.webhook_ok = false` desde agosto —
 * el webhook nunca les entregó un evento. Con key propia, el webhook vive en SU cuenta de Zernio y lo
 * tiene que registrar alguien: lo registra MaKo, con el secreto de la plataforma
 * (`ZERNIO_WEBHOOK_SECRET`), que es el que verifica la firma (app/api/webhooks/zernio).
 */
export async function asegurarWebhook(ws: number): Promise<'creado' | 'actualizado' | 'sin_secreto'> {
  const secret = await envCred('ZERNIO_WEBHOOK_SECRET');
  if (!secret) return 'sin_secreto';
  const c = await cfg(ws);
  const url = linkApp('/api/webhooks/zernio', null);
  const r = await zFetch<{ webhooks?: ZernioWebhook[] }>(c.apiKey, '/webhooks/settings');
  const nuestro = (r.webhooks ?? []).find((w) => (w.url ?? '').trim() === url);
  const events = [...EVENTOS_WEBHOOK];
  if (nuestro) {
    await zFetch(c.apiKey, '/webhooks/settings', { method: 'PUT', body: JSON.stringify({ webhookId: nuestro._id, secret, events, isActive: true }) });
    return 'actualizado';
  }
  await zFetch(c.apiKey, '/webhooks/settings', { method: 'POST', body: JSON.stringify({ name: 'MaKo', url, secret, events }) });
  return 'creado';
}

// ── Mandar ───────────────────────────────────────────────────────────────────

export type EnviarDmInput = {
  /** La cuenta conectada que manda (requerida por Zernio). */
  accountId: string;
  texto?: string;
  /** URL pública HTTPS del adjunto (sin redirect: Instagram la rechaza). */
  adjuntoUrl?: string;
  adjuntoTipo?: 'image' | 'video' | 'audio' | 'file';
  /**
   * Mismo key + mismo body ⇒ Zernio devuelve la respuesta original en vez de mandar dos veces; key en
   * vuelo ⇒ 409. Se guarda 24 h, y SÓLO si la respuesta fue 2xx (un fallo libera el key).
   */
  idempotencyKey?: string;
};

/**
 * Un DM en una conversación existente (POST /v1/inbox/conversations/{id}/messages).
 *
 * ⚠️ SIN `messageTag` A PROPÓSITO: fuera de las 24 h Instagram acepta sólo HUMAN_AGENT, y por política
 * de Meta esa etiqueta es para una PERSONA que contesta, no para una automatización. Fuera de la
 * ventana, Zernio contesta 400 `PLATFORM_LIMITATION` y lib/canal-zernio.ts cierra el hilo.
 */
export async function enviarDm(ws: number, conversationId: string, input: EnviarDmInput): Promise<{ messageId: string | null }> {
  const c = await cfg(ws);
  if (!input.texto && !input.adjuntoUrl) throw new ZernioError('enviarDm: hace falta texto o adjunto', 0, null);
  const body: Record<string, unknown> = { accountId: input.accountId };
  if (input.texto) body.message = input.texto;
  if (input.adjuntoUrl) {
    body.attachmentUrl = input.adjuntoUrl;
    if (input.adjuntoTipo) body.attachmentType = input.adjuntoTipo;
  }
  const r = await zFetch<{ data?: { messageId?: string }; messageId?: string }>(c.apiKey, `/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey.slice(0, 255) } : {},
    body: JSON.stringify(body),
  });
  return { messageId: r.data?.messageId ?? r.messageId ?? null };
}

/**
 * LA RESPUESTA PRIVADA a un comentario (POST /v1/inbox/comments/{postId}/{commentId}/private-reply):
 * UNA por comentario y dentro de los 7 días. Sólo TEXTO: desde agosto de 2026 Instagram rechaza
 * botones y adjuntos a quien no sigue la cuenta y el intento GASTA la única respuesta (doc de Zernio,
 * `details.privateReplyConsumed`). No se reintenta nunca.
 */
export async function responderComentario(ws: number, input: { accountId: string; postId: string; commentId: string; texto: string; idempotencyKey?: string }): Promise<{ messageId: string | null }> {
  const c = await cfg(ws);
  const r = await zFetch<{ messageId?: string }>(c.apiKey, `/inbox/comments/${encodeURIComponent(input.postId)}/${encodeURIComponent(input.commentId)}/private-reply`, {
    method: 'POST',
    headers: input.idempotencyKey ? { 'Idempotency-Key': input.idempotencyKey.slice(0, 255) } : {},
    body: JSON.stringify({ accountId: input.accountId, message: input.texto }),
  });
  return { messageId: r.messageId ?? null };
}

/**
 * ¿Este error de Zernio dice que META NO DEJA escribirle ahora? Es la respuesta que manda sobre el
 * reloj de acá (la ventana se cerró, la respuesta privada ya se gastó, otra app atiende la charla):
 * reintentar no lo arregla.
 */
export function esLimiteDeMeta(e: unknown): boolean {
  if (!(e instanceof ZernioError)) return false;
  const d = e.body?.details as { privateReplyConsumed?: unknown } | undefined;
  return e.code === 'PLATFORM_LIMITATION' || e.code === 'not_thread_owner' || d?.privateReplyConsumed === true
    || (e.status === 400 && e.type === 'platform_error');
}

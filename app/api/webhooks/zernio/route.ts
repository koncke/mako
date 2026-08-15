// =============================================================================
// Webhook: Zernio → canal Instagram (DMs, posts y cuentas)
// =============================================================================
// Receptor único de los eventos de Zernio (message.received / message.sent /
// post.published / post.failed / post.partial / account.connected). Entrega
// at-least-once: el dedup vive en el UNIQUE (workspace_id, zernio_message_id)
// de ig_mensajes y en updates idempotentes para el resto.
//
// SEGURIDAD (patrón add-webhook-receiver, fail-closed en las dos patas):
//   · Firma: X-Zernio-Signature = HMAC-SHA256 hex del body RAW con el secret
//     ZERNIO_WEBHOOK_SECRET (envCred → plataforma). Sin secret configurado o
//     firma inválida → 401, con timingSafeEqual y guard de largo.
//   · Workspace: wsPorIdentificador('zernio', account.profileId) — el profileId
//     lo ACUÑA el server (ensureProfile, lib/zernio.ts), no lo pega un usuario.
//     Fallback: zernio_account_id ya visto en ig_conversaciones (solo si mapea
//     a UN único ws). Sin mapeo → 200 ignored y CERO escritura: NUNCA se cae al
//     dueño. Todo el dispatch corre dentro de runWithWorkspace(ws).
//
// REGLA DE ORO: el lead_id de una conversación NUNCA se deduce de un teléfono.
// Un IGSID es un número de ~17 dígitos y el matcheo telefónico de la casa lo
// confundiría con un teléfono real (bug documentado). Sin link manual, lead_id
// queda NULL y listo.
// =============================================================================

import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { envCred } from '@/lib/credenciales';
import { wsPorIdentificador } from '@/lib/webhook-routing';
import { getSupabaseServer } from '@/lib/supabase';
import { getTenantDb, runWithWorkspace } from '@/lib/workspace';
import { generarBorradorIg } from '@/lib/ig-chatbot';

export const dynamic = 'force-dynamic';
// La generación del borrador llama a la cascada de IA barata: puede pasar los
// 5s del ack de Zernio. No pasa nada: un reintento muere en el dedup.
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── Tipos del payload (contrato e1/e2 del spec de Zernio, verificado) ────────

type ZwAttachment = { type?: string; url?: string; payload?: unknown };

type ZwMessage = {
  id?: string;
  conversationId?: string;
  platform?: string;
  platformMessageId?: string;
  direction?: 'incoming' | 'outgoing';
  /** EL TEXTO VIENE ACÁ (message.text), string | null. */
  text?: string | null;
  attachments?: ZwAttachment[];
  sender?: { id?: string; contactId?: string; name?: string; username?: string };
  sentAt?: string;
  isRead?: boolean;
  source?: string;
};

type ZwConversation = {
  /** EL conversationId que se pasa al endpoint de envío. Opaco. */
  id?: string;
  platformConversationId?: string;
  participantId?: string;
  participantName?: string;
  participantUsername?: string;
  status?: string;
  contactId?: string;
};

type ZwAccount = {
  id?: string;
  /** Mismo valor que id: campo canónico para filtrar. */
  accountId?: string;
  /** Zernio profile ID — el identificador de ruteo. Puede venir AUSENTE (sandbox). */
  profileId?: string;
  platform?: string;
  username?: string;
  displayName?: string;
};

type ZwPost = {
  id?: string;
  content?: string;
  status?: string;
  scheduledFor?: string | null;
  publishedAt?: string;
  platforms?: Array<{
    platform?: string;
    status?: string;
    accountId?: string;
    platformPostId?: string;
    publishedUrl?: string;
    error?: string;
  }>;
  metadata?: Record<string, unknown> | null;
};

type ZwPayload = {
  /** Event ID estable (también en X-Zernio-Event-Id) — clave de dedup. */
  id?: string;
  event?: string;
  message?: ZwMessage;
  conversation?: ZwConversation;
  account?: ZwAccount;
  post?: ZwPost;
  metadata?: Record<string, unknown> | null;
  timestamp?: string;
};

// ── Firma ────────────────────────────────────────────────────────────────────

/**
 * Verifica X-Zernio-Signature (alias legacy X-Late-Signature): HMAC-SHA256 hex
 * lowercase del RAW body. Fail-closed: sin secret o sin header → false.
 */
function verificarFirma(rawBody: string, header: string | null, secret: string | null): boolean {
  if (!secret || !header) return false;
  const esperada = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(esperada, 'utf8');
  const b = Buffer.from(header.trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ── Resolución de workspace (fallbacks, siempre fail-closed) ─────────────────

/**
 * Fallback por accountId: un social account de Zernio pertenece a UN profile →
 * un workspace, y las filas de ig_conversaciones las escribió este mismo
 * webhook DESPUÉS de rutear. Si el id mapea a más de un ws (no debería pasar),
 * es ambiguo y se ignora — nunca se adivina.
 */
async function wsPorAccountId(accountId: string | null | undefined): Promise<number | null> {
  const id = accountId?.trim();
  if (!id) return null;
  try {
    const { data } = await getSupabaseServer()
      .from('ig_conversaciones')
      .select('workspace_id')
      .eq('zernio_account_id', id)
      .limit(50);
    const set = new Set(((data ?? []) as Array<{ workspace_id: number | string }>).map((r) => Number(r.workspace_id)));
    if (set.size === 1) return [...set][0];
    if (set.size > 1) console.warn(`[webhook:zernio] accountId ${id} mapea a ${set.size} workspaces — ambiguo, ignorado`);
    return null;
  } catch (e) {
    console.error(`[webhook:zernio] wsPorAccountId falló: ${msg(e)}`);
    return null;
  }
}

/** Los eventos post.* rutean por el post: zernio_post_id lo estampó NUESTRO create. */
async function wsPorZernioPostId(postId: string | null | undefined): Promise<number | null> {
  const id = postId?.trim();
  if (!id) return null;
  try {
    const { data } = await getSupabaseServer()
      .from('contenido_posts')
      .select('workspace_id')
      .eq('zernio_post_id', id)
      .limit(10);
    const set = new Set(((data ?? []) as Array<{ workspace_id: number | string }>).map((r) => Number(r.workspace_id)));
    if (set.size === 1) return [...set][0];
    if (set.size > 1) console.warn(`[webhook:zernio] post ${id} mapea a ${set.size} workspaces — ambiguo, ignorado`);
    return null;
  } catch (e) {
    console.error(`[webhook:zernio] wsPorZernioPostId falló: ${msg(e)}`);
    return null;
  }
}

// ── Handlers por evento (todos corren YA dentro de runWithWorkspace) ─────────

const isoDe = (s: string | undefined, fallback: string): string => {
  const t = s ? Date.parse(s) : NaN;
  return Number.isFinite(t) ? new Date(t).toISOString() : fallback;
};

/**
 * Adjuntos: se persiste tipo + payload, NUNCA la url — en Instagram es una CDN
 * de Meta firmada que EXPIRA (contrato Zernio). Lo re-minteable es el
 * refreshUrl del endpoint de mensajes, que el webhook no trae.
 */
const adjuntosDe = (atts: ZwAttachment[] | undefined): Array<Record<string, unknown>> =>
  (atts ?? []).map((a) => ({ type: a.type ?? 'file', ...(a.payload != null ? { payload: a.payload } : {}) }));

/** Upsert de la conversación; devuelve el id local o lanza. */
async function upsertConversacion(
  body: ZwPayload,
  opts: { ventanaExpiraAt?: string; ultimoMensajeAt: string; entrante: boolean },
): Promise<number> {
  const db = await getTenantDb();
  const conv = body.conversation!;
  const fila: Record<string, unknown> = {
    zernio_conversation_id: conv.id,
    ultimo_mensaje_at: opts.ultimoMensajeAt,
    // lead_id NO viaja acá a propósito: el upsert no pisa un link manual, y la
    // regla de oro prohíbe deducirlo (ver encabezado).
  };
  // Los campos de identidad solo se escriben cuando HAY valor: un payload que no
  // los trae (sandbox, eventos parciales) no borra lo que ya se sabía. Y en un
  // SALIENTE message.sender es la CUENTA del negocio, no el lead — el
  // participante sale SIEMPRE de conversation.participant*; usar el sender ahí
  // pisaría el igsid/username del lead con los del propio negocio.
  const accountId = body.account?.accountId ?? body.account?.id;
  if (accountId) fila.zernio_account_id = accountId;
  const igsid = opts.entrante ? (body.message?.sender?.id ?? conv.participantId) : conv.participantId;
  if (igsid) fila.igsid = igsid;
  const username = opts.entrante
    ? (body.message?.sender?.username ?? conv.participantUsername)
    : conv.participantUsername;
  if (username) fila.username = username;
  if (opts.ventanaExpiraAt) fila.ventana_expira_at = opts.ventanaExpiraAt;
  const { data, error } = await db
    .from('ig_conversaciones')
    .upsert(fila, { onConflict: 'workspace_id,zernio_conversation_id' })
    .select('id')
    .single();
  if (error || !data) throw new Error(`ig_conversaciones (upsert): ${error?.message ?? 'sin fila'}`);
  return (data as { id: number }).id;
}

async function procesarMensajeEntrante(ws: number, body: ZwPayload) {
  const m = body.message!;
  const ahora = new Date().toISOString();
  const sentAt = isoDe(m.sentAt ?? body.timestamp, ahora);
  // Ventana de Meta: 24h desde el último mensaje ENTRANTE.
  const ventana = new Date(Date.parse(sentAt) + 24 * 3600 * 1000).toISOString();

  const convId = await upsertConversacion(body, { ultimoMensajeAt: sentAt, ventanaExpiraAt: ventana, entrante: true });

  // Dedup de la entrega at-least-once: ignoreDuplicates sobre el UNIQUE
  // (workspace_id, zernio_message_id). Si la fila ya estaba, el reintento no
  // vuelve a disparar el chatbot.
  const db = await getTenantDb();
  const { data: ins, error } = await db
    .from('ig_mensajes')
    .upsert(
      {
        conversacion_id: convId,
        direccion: 'entrante',
        estado: 'recibido',
        texto: m.text ?? null,
        adjuntos: adjuntosDe(m.attachments),
        zernio_message_id: m.id,
      },
      { onConflict: 'workspace_id,zernio_message_id', ignoreDuplicates: true },
    )
    .select('id');
  if (error) throw new Error(`ig_mensajes (insert entrante): ${error.message}`);
  const nuevo = ((ins ?? []) as unknown[]).length > 0;

  // El puente al chatbot, best-effort: un fallo de la IA jamás hace fallar el
  // webhook (el mensaje ya quedó guardado, que es lo crítico) ni fuerza un
  // reintento de Zernio que no arreglaría nada.
  if (nuevo) {
    try {
      const r = await generarBorradorIg(ws, convId);
      if (!r.ok) console.log(`[webhook:zernio] sin borrador para conv ${convId}: ${r.motivo}`);
    } catch (e) {
      console.error(`[webhook:zernio] generarBorradorIg falló (conv ${convId}): ${msg(e)}`);
    }
  }
  return { accion: nuevo ? 'mensaje_guardado' : 'dedup' };
}

async function procesarMensajeSaliente(body: ZwPayload) {
  const m = body.message!;
  const ahora = new Date().toISOString();
  const sentAt = isoDe(m.sentAt ?? body.timestamp, ahora);
  // OJO: un saliente NO toca ventana_expira_at — la ventana la abre el entrante.
  const convId = await upsertConversacion(body, { ultimoMensajeAt: sentAt, entrante: false });
  const db = await getTenantDb();

  // ¿Corresponde a un borrador pendiente con el mismo texto? (lo mandó alguien
  // desde el dashboard de Zernio, o nuestro send no devolvió messageId): se
  // marca ESE borrador como enviado en vez de duplicar la fila.
  if (m.text?.trim() && m.id) {
    const { data: claimed, error } = await db
      .from('ig_mensajes')
      .update({ estado: 'enviado', zernio_message_id: m.id, error: null })
      .eq('conversacion_id', convId)
      .eq('estado', 'borrador')
      .eq('texto', m.text)
      .select('id');
    // Un error acá (p.ej. el UNIQUE de zernio_message_id porque nuestro send ya
    // lo estampó en otra fila) no es fatal: se sigue al camino del upsert, que
    // dedupea por ese mismo UNIQUE.
    if (!error && ((claimed ?? []) as unknown[]).length) return { accion: 'borrador_marcado' };
  }

  // Saliente externo (o el eco de nuestro propio send: mismo id → dedup).
  const { data: ins, error } = await db
    .from('ig_mensajes')
    .upsert(
      {
        conversacion_id: convId,
        direccion: 'saliente',
        estado: 'enviado',
        texto: m.text ?? null,
        adjuntos: adjuntosDe(m.attachments),
        zernio_message_id: m.id,
      },
      { onConflict: 'workspace_id,zernio_message_id', ignoreDuplicates: true },
    )
    .select('id');
  if (error) throw new Error(`ig_mensajes (insert saliente): ${error.message}`);
  return { accion: ((ins ?? []) as unknown[]).length ? 'saliente_registrado' : 'dedup' };
}

const ESTADO_POST: Record<string, string> = {
  'post.published': 'publicado',
  'post.failed': 'error',
  'post.partial': 'parcial',
};

async function procesarPost(body: ZwPayload) {
  const post = body.post!;
  const estado = ESTADO_POST[body.event!];
  const errores =
    (post.platforms ?? [])
      .filter((p) => p.error)
      .map((p) => `${p.platform ?? 'plataforma'}: ${p.error}`)
      .join(' · ') || null;
  const patch: Record<string, unknown> = {
    estado,
    error: estado === 'publicado' ? null : errores,
  };
  if (estado === 'publicado') {
    patch.publicado_at = isoDe(post.publishedAt ?? body.timestamp, new Date().toISOString());
  }
  const db = await getTenantDb();
  const { error } = await db.from('contenido_posts').update(patch).eq('zernio_post_id', post.id);
  if (error) throw new Error(`contenido_posts (update): ${error.message}`);
  return { accion: `post_${estado}` };
}

async function procesarAccountConnected(body: ZwPayload) {
  const db = await getTenantDb();
  // Sin pisar profile_id si la fila ya existe (para BYOK, NULL significa "el
  // profile Default de SU cuenta" — contrato de lib/zernio.ts): primero un
  // insert-si-no-está, después el update idempotente de webhook_ok.
  const { error: e1 } = await db
    .from('zernio_workspace')
    .upsert(
      { profile_id: body.account?.profileId ?? null, webhook_ok: true },
      { onConflict: 'workspace_id', ignoreDuplicates: true },
    );
  if (e1) throw new Error(`zernio_workspace (upsert): ${e1.message}`);
  const { error: e2 } = await db.from('zernio_workspace').update({ webhook_ok: true });
  if (e2) throw new Error(`zernio_workspace (update): ${e2.message}`);
  return { accion: 'cuenta_conectada' };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  return Response.json({ ok: true, endpoint: 'zernio webhook', usage: 'POST con header X-Zernio-Signature' });
}

export async function POST(req: NextRequest) {
  const t0 = Date.now();

  // 1) Firma sobre el body RAW, antes de parsear nada. FAIL-CLOSED: sin
  //    ZERNIO_WEBHOOK_SECRET configurado, todo request muere acá con 401.
  const rawBody = await req.text();
  const secret = await envCred('ZERNIO_WEBHOOK_SECRET');
  const header = req.headers.get('x-zernio-signature') ?? req.headers.get('x-late-signature');
  if (!verificarFirma(rawBody, header, secret)) {
    console.warn(`[webhook:zernio] firma rechazada (secret ${secret ? 'configurado' : 'AUSENTE'})`);
    return Response.json({ ok: false, error: 'signature' }, { status: 401 });
  }

  // 2) Parse (JSON.parse('null') no lanza: se exige objeto).
  let body: ZwPayload;
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (parsed === null || typeof parsed !== 'object') throw new Error('no es un objeto');
    body = parsed as ZwPayload;
  } catch {
    return Response.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }
  const event = body.event ?? '';

  try {
    // 3) Resolver el workspace según el evento. Fail-CLOSED: sin mapeo se
    //    responde 200 (reintentar no lo va a atribuir mejor) y NO se escribe nada.
    let ws: number | null = null;
    if (event === 'message.received' || event === 'message.sent') {
      // Solo Instagram: este canal no es el inbox de WhatsApp/Telegram de la casa.
      const plataforma = body.message?.platform ?? body.account?.platform ?? '';
      if (plataforma !== 'instagram') {
        return Response.json({ ok: true, event, ignored: true, reason: `plataforma ${plataforma || '—'}` });
      }
      if (!body.message?.id || !body.conversation?.id) {
        return Response.json({ ok: true, event, ignored: true, reason: 'payload incompleto' });
      }
      ws = await wsPorIdentificador('zernio', body.account?.profileId);
      if (ws == null) ws = await wsPorAccountId(body.account?.accountId ?? body.account?.id);
    } else if (Object.hasOwn(ESTADO_POST, event)) {
      // hasOwn y no `in`: el operador `in` matchea la cadena de prototipos
      // ('toString' in {} es true) y mandaría un evento basura a procesarPost.
      ws = await wsPorZernioPostId(body.post?.id);
    } else if (event === 'account.connected') {
      ws = await wsPorIdentificador('zernio', body.account?.profileId);
    } else {
      // Evento no manejado (post.scheduled, message.delivered, …) → 200 y listo.
      return Response.json({ ok: true, event, ignored: true });
    }

    if (ws == null) {
      console.warn(`[webhook:zernio] sin workspace para event=${event} profileId=${body.account?.profileId ?? '—'} — ignorado`);
      return Response.json({ ok: true, event, ignored: 'sin workspace' });
    }
    const wsFinal = ws; // const: el narrow a `number` sobrevive adentro del closure

    // 4) Dispatch, TODO confinado al workspace resuelto.
    return await runWithWorkspace(wsFinal, async () => {
      let r: { accion: string };
      if (event === 'message.received') r = await procesarMensajeEntrante(wsFinal, body);
      else if (event === 'message.sent') r = await procesarMensajeSaliente(body);
      else if (Object.hasOwn(ESTADO_POST, event)) r = await procesarPost(body);
      else r = await procesarAccountConnected(body);
      console.log(`[webhook:zernio] ${event} ws=${wsFinal} accion=${r.accion} ms=${Date.now() - t0}`);
      return Response.json({ ok: true, event, ...r, ms: Date.now() - t0 });
    });
  } catch (e) {
    // 500 a propósito: Zernio reintenta (7 intentos con backoff) y el dedup por
    // zernio_message_id / updates idempotentes hace el reintento inocuo.
    console.error(`[webhook:zernio] error procesando ${event}: ${msg(e)}`);
    return Response.json({ ok: false, error: 'processing', message: msg(e), event }, { status: 500 });
  }
}

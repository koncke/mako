'use server';

// =============================================================================
// Server actions de la tab Instagram
// =============================================================================
// Reglas de la casa que gobiernan este archivo:
//   · El workspace se resuelve SIEMPRE con getWorkspaceActual() (nunca ?ws=).
//     Agencia sin impersonar → ws null → se corta con error (fail-closed).
//   · Acciones outward-facing (publicar, conectar, toggles) exigen rol admin
//     del workspace (getRolWsEfectivo() === 'admin').
//   · Zernio falla tipado (ZernioError) y acá se devuelve { ok:false, error }:
//     nada se traga en silencio, nada rompe la pantalla con un throw crudo.
//   · El ENVÍO del DM no vive acá: lo hace POST /api/instagram/enviar (contrato
//     con el agente del webhook: body { id, texto } → { ok, error? }, donde `id`
//     es ig_mensajes.id del borrador). Esta capa solo lista y descarta.

import { randomUUID } from 'node:crypto';
import { getRolWsEfectivo, getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { getSupabaseServer } from '@/lib/supabase';
import { getSetting, setSetting } from '@/lib/settings';
import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { perfilNegocioTexto } from '@/lib/onboarding';
import { chatCheapCascade, errorDeCascada } from '@/lib/ai-cheap';
import {
  createPost, deletePost, getConnectUrl, getPost, ZernioError,
  type ZernioMediaItem, type ZernioPost,
} from '@/lib/zernio';
import { APP_BASE_URL } from '@/lib/app-url';
import {
  BUCKET_IG, KEY_IG_AUTO_RESPUESTA, estadoConexionIg, firmarMedia, firmarPreview, listarConversaciones,
  listarMensajes, listarPublicaciones, pathDelWorkspace,
  type ConversacionIg, type EstadoConexionIg, type MediaLocal, type MensajeIg, type PublicacionIg,
} from './ig-datos';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Contexto de una acción de admin: rol admin del workspace + ws concreto.
 * La agencia SIN impersonar tiene ws null: acá se corta con error en vez de
 * caer al dueño (patrón wsEstricto de lib/evolution.ts — un fallback silencioso
 * a OWNER_WS escribiría en los datos del dueño sin que nadie lo pida).
 */
async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede hacer esto.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo. Entra al workspace de un cliente para operar Instagram.' };
  return { ok: true, ws };
}

// ── Conexión (onboarding · etapa Conectar) ───────────────────────────────────

/**
 * URL de OAuth de Zernio para conectar la cuenta de Instagram. El cliente
 * redirige el navegador a `authUrl`; al volver, Zernio appendea
 * connected=instagram&accountId=…&username=… al redirect (y el evento
 * account.connected llega por webhook).
 */
export async function conectarInstagramAction(): Promise<{ ok: true; authUrl: string } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const r = await getConnectUrl(ctx.ws, 'instagram', `${APP_BASE_URL}/instagram?conectado=1`);
    return { ok: true, authUrl: r.authUrl };
  } catch (e) {
    if (e instanceof ZernioError && e.status === 402) {
      return { ok: false, error: 'La cuenta de Zernio llegó a su límite de cuentas conectadas. Revisa el plan en zernio.com.' };
    }
    return { ok: false, error: msg(e) };
  }
}

/**
 * Estado de conexión. Si detecta la cuenta conectada, cierra el paso `conectar`
 * del onboarding: la prueba de vida son los facts reales de la cuenta (el
 * username que devuelve Zernio), no la credencial guardada.
 */
export async function estadoConexionAction(): Promise<{ ok: true; estado: EstadoConexionIg } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const estado = await estadoConexionIg(ctx.ws);
    if (estado.cuenta) {
      const tab = await getEstadoTab('instagram');
      if (!tab.steps.conectar?.done) await marcarPasoTab('instagram', 'conectar');
    }
    return { ok: true, estado };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

// ── Onboarding de la tab ─────────────────────────────────────────────────────

/** Marca un paso del onboarding (contexto / ensayo). `conectar` se marca solo
 *  al detectar la cuenta — no se puede cerrar a mano sin prueba de vida. */
export async function marcarPasoIgAction(paso: 'contexto' | 'ensayo'): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    await marcarPasoTab('instagram', paso);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

// TODO: mover a prompt-registry (archivo tomado por sesión paralela 15/08).
// Mientras viva acá, este prompt NO es editable desde /configuraciones.
const ENSAYO_SYSTEM = `Eres MaKo, el asistente que responde los DM de Instagram de este negocio.
Te llega un mensaje de un cliente potencial. Redacta la respuesta que un buen setter enviaría:
corta (2 a 4 frases), cálida, en español neutro, sin emojis en exceso, terminando con UNA pregunta
que haga avanzar la conversación. No inventes datos del negocio que no estén en el contexto.
Devuelve SOLO el texto del mensaje, sin comillas ni encabezados.`;

/**
 * Ensayo del onboarding: un DM simulado → el borrador que MaKo redactaría.
 * Corre en IA barata (cascada gratis) — mismo criterio que el simulador del
 * Chat Agent, porque en producción esto corre en cada mensaje entrante.
 */
export async function ensayoDmAction(mensaje: string): Promise<{ ok: true; respuesta: string } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  const texto = (mensaje ?? '').trim().slice(0, 1200);
  if (!texto) return { ok: false, error: 'Escribe el mensaje de prueba primero.' };
  try {
    const perfil = await perfilNegocioTexto();
    // `erroresOut` no es opcional en la práctica: sin él, el `if (!respuesta)` de
    // abajo no puede decir la VERDAD de por qué falló (regla de lib/ia-mensajes).
    const errores: string[] = [];
    const respuesta = await chatCheapCascade({
      system: `${ENSAYO_SYSTEM}\n\nCONTEXTO DEL NEGOCIO:\n${perfil || '(sin contexto cargado todavía)'}`,
      user: `DM entrante de un cliente potencial: «${texto}»`,
      maxTokens: 400,
      feature: 'instagram-ensayo',
      motivo: 'Ensayo del onboarding de Instagram (DM simulado)',
      erroresOut: errores,
    });
    if (!respuesta.trim()) return { ok: false, error: await errorDeCascada(errores, 'redactar el borrador del ensayo') };
    return { ok: true, respuesta: respuesta.trim() };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

// ── Compositor de publicaciones ──────────────────────────────────────────────

/**
 * URL firmada para que el navegador suba el binario DIRECTO a storage (los POST
 * al serverless de Vercel rechazan >4.5 MB; un reel no pasa). Mismo patrón que
 * /api/onboarding/archivero/upload-url.
 */
export async function crearUrlSubidaMediaAction(
  nombre: string,
  mime: string,
): Promise<{ ok: true; path: string; signedUrl: string; token: string } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const ext = (nombre.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
    const path = `${ctx.ws}/${randomUUID()}${ext ? `.${ext}` : ''}`;
    const { data, error } = await getSupabaseServer().storage.from(BUCKET_IG).createSignedUploadUrl(path);
    if (error || !data) return { ok: false, error: error?.message || 'No se pudo crear la URL de subida.' };
    return { ok: true, path, signedUrl: data.signedUrl, token: data.token };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export type CrearPublicacionInput = {
  tipo: 'feed' | 'reel' | 'story' | 'carrusel';
  caption: string;
  media: MediaLocal[];
  /** 'borrador' = solo local (no toca Zernio) · 'ahora' = publishNow · 'programar' = scheduledFor. */
  modo: 'borrador' | 'ahora' | 'programar';
  /** ISO absoluto (con Z). Obligatorio con modo 'programar'. */
  programadoAt?: string;
};

const MARGEN_FIRMA_SEG = 7 * 24 * 60 * 60; // 7 días de margen sobre el momento de publicación

/** Estado local ← status de Zernio. */
function estadoDeZernio(z: ZernioPost['status']): PublicacionIg['estado'] {
  switch (z) {
    case 'draft': return 'borrador';
    case 'scheduled': return 'programado';
    case 'publishing': return 'publicando';
    case 'published': return 'publicado';
    case 'partial': return 'parcial';
    case 'failed': return 'error';
    default: return 'publicando';
  }
}

function validarPublicacion(input: CrearPublicacionInput): string | null {
  if (!input.media.length) return 'Sube al menos una imagen o video: Instagram no publica sin media.';
  if (input.tipo === 'reel' && !input.media.some((m) => m.mime.startsWith('video/'))) {
    return 'Un reel necesita un video.';
  }
  if (input.tipo === 'carrusel' && input.media.length < 2) return 'Un carrusel necesita al menos 2 archivos.';
  if ((input.tipo === 'reel' || input.tipo === 'story') && input.media.length > 1) {
    return `Un ${input.tipo === 'reel' ? 'reel' : 'story'} lleva un solo archivo.`;
  }
  if (input.modo === 'programar') {
    if (!input.programadoAt) return 'Elige la fecha y hora de publicación.';
    const t = Date.parse(input.programadoAt);
    if (!Number.isFinite(t)) return 'La fecha de programación no es válida.';
    if (t <= Date.now()) return 'La fecha de programación tiene que ser futura.';
  }
  return null;
}

export async function crearPublicacionAction(
  input: CrearPublicacionInput,
): Promise<{ ok: true; id: number; estado: PublicacionIg['estado'] } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  const { ws } = ctx;

  const invalido = validarPublicacion(input);
  if (invalido) return { ok: false, error: invalido };
  // Guard en positivo del storage: solo media del workspace actual.
  if (!input.media.every((m) => pathDelWorkspace(ws, m.path))) {
    return { ok: false, error: 'Hay archivos fuera del workspace actual.' };
  }

  const db = await getTenantDb();
  const caption = input.caption.trim() || null;
  const programadoAt = input.modo === 'programar' ? input.programadoAt! : null;

  // ── Borrador local: no toca Zernio (las URLs firmadas vencerían antes de un
  // futuro indefinido; se firman recién al publicar/programar). ──
  if (input.modo === 'borrador') {
    const { data, error } = await db
      .from('contenido_posts')
      .insert({ tipo: input.tipo, caption, media: input.media, estado: 'borrador' })
      .select('id')
      .single();
    if (error) return { ok: false, error: `No se pudo guardar el borrador: ${error.message}` };
    return { ok: true, id: (data as { id: number }).id, estado: 'borrador' };
  }

  // ── Publicar / programar: primero la fila local (para tener el id que viaja
  // en metadata y que los webhooks post.* devuelven como eco), después Zernio.
  // Si Zernio falla, la fila queda en estado 'error' con el error VISIBLE. ──
  const conexion = await estadoConexionIg(ws);
  if (!conexion.cuenta) {
    return { ok: false, error: conexion.error ?? 'Conecta tu cuenta de Instagram antes de publicar.' };
  }

  const estadoInicial = input.modo === 'ahora' ? 'publicando' : 'programado';
  const { data: fila, error: errIns } = await db
    .from('contenido_posts')
    .insert({ tipo: input.tipo, caption, media: input.media, estado: estadoInicial, programado_at: programadoAt })
    .select('id')
    .single();
  if (errIns) return { ok: false, error: `No se pudo guardar la publicación: ${errIns.message}` };
  const id = (fila as { id: number }).id;

  try {
    // La URL firmada tiene que sobrevivir hasta que Zernio LEA el media: para un
    // post programado, hasta programado_at + 7 días de margen (gotcha del
    // contrato — una firma corta muere antes de que Zernio la procese).
    const hastaPublicar = programadoAt ? Math.max(0, Math.ceil((Date.parse(programadoAt) - Date.now()) / 1000)) : 0;
    const expiraSeg = hastaPublicar + MARGEN_FIRMA_SEG;
    const mediaItems: ZernioMediaItem[] = await Promise.all(
      input.media.map(async (m) => ({
        type: m.mime.startsWith('video/') ? 'video' as const : 'image' as const,
        url: await firmarMedia(ws, m.path, expiraSeg),
        mimeType: m.mime,
        filename: m.nombre,
      })),
    );

    const platformSpecificData =
      input.tipo === 'reel' ? { contentType: 'reel' }
      : input.tipo === 'story' ? { contentType: 'story' }
      : undefined;

    const r = await createPost(ws, {
      content: caption ?? undefined,
      mediaItems,
      platforms: [{
        platform: 'instagram',
        accountId: conexion.cuenta.id,
        ...(platformSpecificData ? { platformSpecificData } : {}),
      }],
      ...(input.modo === 'ahora'
        ? { publishNow: true }
        // ISO con Z = instante ABSOLUTO (el timezone se ignora): el cliente ya
        // convirtió la hora local a UTC. El bug clásico es mandar la hora naive.
        : { scheduledFor: programadoAt! }),
      metadata: { contenidoPostId: id },
      requestId: randomUUID(), // uuid POR post local, nunca reusado (pitfall n8n)
    });

    const estado = estadoDeZernio(r.post.status);
    await db
      .from('contenido_posts')
      .update({
        zernio_post_id: r.post._id,
        estado,
        publicado_at: estado === 'publicado' ? new Date().toISOString() : null,
        error: null,
      })
      .eq('id', id);
    return { ok: true, id, estado };
  } catch (e) {
    const detalle = e instanceof ZernioError && e.body?.error ? e.body.error : msg(e);
    await db.from('contenido_posts').update({ estado: 'error', error: detalle }).eq('id', id);
    return { ok: false, error: detalle };
  }
}

export async function listarPublicacionesAction(): Promise<{ ok: true; posts: PublicacionIg[] } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    return { ok: true, posts: await listarPublicaciones() };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Cancela una publicación PROGRAMADA: borra el post en Zernio (DELETE /v1/posts
 * solo acepta draft/scheduled) y la fila local vuelve a 'borrador'. Guard en
 * positivo: solo filas en estado 'programado' con zernio_post_id.
 */
export async function cancelarProgramacionAction(id: number): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  const db = await getTenantDb();
  const { data, error } = await db
    .from('contenido_posts')
    .select('id, zernio_post_id')
    .eq('id', id)
    .eq('estado', 'programado')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const zid = (data as { zernio_post_id: string | null } | null)?.zernio_post_id;
  if (!data || !zid) return { ok: false, error: 'Esa publicación no está programada.' };
  try {
    await deletePost(ctx.ws, zid);
  } catch (e) {
    // Si Zernio ya la publicó (400), el estado local está viejo: se sincroniza
    // en vez de mentir. Cualquier otro error se muestra tal cual.
    if (e instanceof ZernioError && e.status === 400) {
      await refrescarPublicacionAction(id);
      return { ok: false, error: 'Zernio ya no permite cancelarla (probablemente ya se publicó). Se actualizó el estado.' };
    }
    return { ok: false, error: msg(e) };
  }
  const { error: errUp } = await db
    .from('contenido_posts')
    .update({ estado: 'borrador', zernio_post_id: null, programado_at: null, error: null })
    .eq('id', id)
    .eq('estado', 'programado');
  if (errUp) return { ok: false, error: errUp.message };
  return { ok: true };
}

/** Re-lee el estado del post en Zernio y sincroniza la fila local (para ver
 *  'publicado'/'error' sin depender del webhook). */
export async function refrescarPublicacionAction(id: number): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  const db = await getTenantDb();
  const { data, error } = await db
    .from('contenido_posts')
    .select('id, zernio_post_id')
    .eq('id', id)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const zid = (data as { zernio_post_id: string | null } | null)?.zernio_post_id;
  if (!zid) return { ok: false, error: 'Esa publicación no está en Zernio.' };
  try {
    const post = await getPost(ctx.ws, zid);
    const estado = estadoDeZernio(post.status);
    const fallo = post.platforms?.find((p) => p.status === 'failed');
    await db
      .from('contenido_posts')
      .update({
        estado,
        publicado_at: estado === 'publicado'
          ? (post.platforms?.find((p) => p.publishedAt)?.publishedAt ?? new Date().toISOString())
          : null,
        error: estado === 'error' || estado === 'parcial'
          ? (fallo ? 'Instagram rechazó la publicación (ver Zernio para el detalle).' : null)
          : null,
      })
      .eq('id', id);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Preview firmada corta de un media local (para pintar miniaturas). */
export async function previewMediaAction(path: string): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  return { ok: true, url: await firmarPreview(ctx.ws, path) };
}

// ── Inbox de DMs ─────────────────────────────────────────────────────────────

export async function listarInboxAction(): Promise<{ ok: true; conversaciones: ConversacionIg[] } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    return { ok: true, conversaciones: await listarConversaciones() };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function listarMensajesAction(conversacionId: number): Promise<{ ok: true; mensajes: MensajeIg[] } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    return { ok: true, mensajes: await listarMensajes(conversacionId) };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Descarta un borrador del chatbot (solo filas estado='borrador': un mensaje
 *  ya enviado o recibido no se borra desde acá — guard en positivo). */
export async function descartarBorradorDmAction(mensajeId: number): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  const db = await getTenantDb();
  const { data, error } = await db
    .from('ig_mensajes')
    .delete()
    .eq('id', mensajeId)
    .eq('estado', 'borrador')
    .select('id');
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: 'Ese borrador ya no existe (¿se envió o se descartó en otra pestaña?).' };
  return { ok: true };
}

// ── Configuración de la tab ──────────────────────────────────────────────────

export async function getConfigIgAction(): Promise<
  { ok: true; autoRespuesta: boolean; conexion: EstadoConexionIg } | { ok: false; error: string }
> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const [flag, conexion] = await Promise.all([getSetting(KEY_IG_AUTO_RESPUESTA), estadoConexionIg(ctx.ws)]);
    // Fail-closed: sin setting = apagado. La respuesta automática manda DMs
    // reales sin que nadie los mire; nunca se hereda encendida.
    return { ok: true, autoRespuesta: flag === 'true', conexion };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function setAutoRespuestaAction(on: boolean): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    await setSetting(KEY_IG_AUTO_RESPUESTA, on ? 'true' : 'false');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

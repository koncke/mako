// =============================================================================
// api-mako/areas/instagram.helpers — lo del área `instagram` que lib/ no exporta
// =============================================================================
// Todo con getTenantDb() (scopea por el workspace en curso, que ejecutarOperacion
// fija con runWithWorkspace). Las LECTURAS de arriba no escriben; las ESCRITURAS de
// abajo solo las llama un ejecutar() (después de que una persona confirmó).
//
// ⚠️ DEUDA: esto debería vivir en lib/ig-chatbot.ts y en un lib/ig-publicar.ts.
// Está aquí porque el implementador del área no toca libs compartidas:
//   · editarBorradorIg()        copia el update inline de app/api/instagram/enviar/route.ts.
//   · descartarBorradorIg()     copia descartarBorradorDmAction (app/instagram/actions.ts).
//   · cancelarProgramacionIg()  copia cancelarProgramacionAction, sin ctxAdmin (lee sesión).
//   · sincronizarPublicacionIg() copia refrescarPublicacionAction, ídem.
//   · estadoDeZernio()          copia la función privada del mismo archivo.
//   · mensajesRecientesIg()     existe porque listarMensajes (app/instagram/ig-datos.ts)
//     ordena ASCENDENTE con .limit(300): en un hilo de más de 300 mensajes devuelve
//     los 300 MÁS VIEJOS y corta los recientes en silencio.
// Las server actions de app/instagram/actions.ts no se pueden llamar desde aquí:
// su ctxAdmin() lee el rol de la SESIÓN, que por HTTP y WhatsApp no existe.
// =============================================================================

import 'server-only';
import { getTenantDb } from '@/lib/workspace';
import { deletePost, getPost, ZernioError, type ZernioPost } from '@/lib/zernio';

type EstadoPost = 'borrador' | 'programado' | 'publicando' | 'publicado' | 'parcial' | 'error';

/** Estado local ← status de Zernio (copia de app/instagram/actions.ts). */
export function estadoDeZernio(z: ZernioPost['status']): EstadoPost {
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

// ── Lecturas ─────────────────────────────────────────────────────────────────

export type ConversacionFila = {
  id: number; username: string | null; zernio_conversation_id: string | null;
  zernio_account_id: string | null; ventana_expira_at: string | null; lead_id: number | null;
};

export async function leerConversacionIg(conversacionId: number): Promise<ConversacionFila | null> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('ig_conversaciones')
    .select('id, username, zernio_conversation_id, zernio_account_id, ventana_expira_at, lead_id')
    .eq('id', conversacionId)
    .maybeSingle();
  if (error) throw new Error(`ig_conversaciones: ${error.message}`);
  return (data as ConversacionFila | null) ?? null;
}

export type MensajeFila = {
  id: number; direccion: string; estado: string; texto: string | null;
  adjuntos: unknown; error: string | null; created_at: string;
};

/** Los `limite` mensajes MÁS RECIENTES del hilo, devueltos en orden cronológico. */
export async function mensajesRecientesIg(conversacionId: number, limite: number): Promise<{ filas: MensajeFila[]; total: number | null }> {
  const db = await getTenantDb();
  const { data, error, count } = await db
    .from('ig_mensajes')
    .select('id, direccion, estado, texto, adjuntos, error, created_at', { count: 'exact' })
    .eq('conversacion_id', conversacionId)
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw new Error(`ig_mensajes: ${error.message}`);
  return { filas: ((data ?? []) as MensajeFila[]).reverse(), total: count ?? null };
}

export type BorradorFila = { id: number; conversacion_id: number; texto: string | null; estado: string; error: string | null };

export async function leerBorradorIg(borradorId: number): Promise<BorradorFila | null> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('ig_mensajes')
    .select('id, conversacion_id, texto, estado, error')
    .eq('id', borradorId)
    .maybeSingle();
  if (error) throw new Error(`ig_mensajes: ${error.message}`);
  return (data as BorradorFila | null) ?? null;
}

/** El último mensaje REAL del hilo (sin borradores ni envíos con error): de quién es. */
export async function ultimoMensajeRealIg(conversacionId: number): Promise<{ direccion: string; texto: string | null } | null> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('ig_mensajes')
    .select('direccion, estado, texto')
    .eq('conversacion_id', conversacionId)
    .in('estado', ['recibido', 'enviado'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(`ig_mensajes: ${error.message}`);
  const f = ((data ?? []) as Array<{ direccion: string; texto: string | null }>)[0];
  return f ?? null;
}

/**
 * Borradores pendientes por conversación, contados SIN ventana. listarConversaciones
 * (app/instagram/ig-datos.ts) los cuenta dentro de los 600 mensajes más recientes de
 * las 100 conversaciones: un borrador de un hilo viejo quedaba fuera y daba 0, y el
 * filtro «¿a quién le debo contestar?» perdía justo a los que esperan hace más.
 * `tope` = cuántas filas se leyeron como máximo (PostgREST corta en 1000 en silencio).
 */
export async function borradoresPorConversacionIg(ids: number[]): Promise<{ porConv: Map<number, number>; leidas: number; tope: number }> {
  const tope = 1000;
  if (!ids.length) return { porConv: new Map(), leidas: 0, tope };
  const db = await getTenantDb();
  const { data, error } = await db
    .from('ig_mensajes')
    .select('conversacion_id')
    .eq('estado', 'borrador')
    .in('conversacion_id', ids)
    .limit(tope);
  if (error) throw new Error(`ig_mensajes: ${error.message}`);
  const porConv = new Map<number, number>();
  const filas = (data ?? []) as Array<{ conversacion_id: number }>;
  for (const f of filas) porConv.set(f.conversacion_id, (porConv.get(f.conversacion_id) ?? 0) + 1);
  return { porConv, leidas: filas.length, tope };
}

/** Local ids de las conversaciones espejadas cuyo id de Zernio está en la lista. */
export async function localesPorZernioId(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map();
  const db = await getTenantDb();
  const { data, error } = await db
    .from('ig_conversaciones')
    .select('id, zernio_conversation_id')
    .in('zernio_conversation_id', ids);
  if (error) throw new Error(`ig_conversaciones: ${error.message}`);
  return new Map(((data ?? []) as Array<{ id: number; zernio_conversation_id: string }>).map((r) => [r.zernio_conversation_id, r.id]));
}

export type PublicacionFila = {
  id: number; tipo: string; caption: string | null; estado: string;
  programado_at: string | null; zernio_post_id: string | null; error: string | null;
};

export async function leerPublicacionIg(publicacionId: number): Promise<PublicacionFila | null> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('contenido_posts')
    .select('id, tipo, caption, estado, programado_at, zernio_post_id, error')
    .eq('id', publicacionId)
    .maybeSingle();
  if (error) throw new Error(`contenido_posts: ${error.message}`);
  return (data as PublicacionFila | null) ?? null;
}

// ── Escrituras (solo desde ejecutar()) ───────────────────────────────────────

/** Pisa el texto de un borrador que SIGUE pendiente. false = ya no estaba en borrador. */
export async function editarBorradorIg(borradorId: number, texto: string): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('ig_mensajes')
    .update({ texto })
    .eq('id', borradorId)
    .eq('estado', 'borrador')
    .select('id');
  if (error) throw new Error(`ig_mensajes: ${error.message}`);
  return ((data ?? []) as unknown[]).length > 0;
}

/** DELETE físico de un borrador pendiente (guard en positivo: solo estado='borrador'). */
export async function descartarBorradorIg(borradorId: number): Promise<boolean> {
  const db = await getTenantDb();
  const { data, error } = await db
    .from('ig_mensajes')
    .delete()
    .eq('id', borradorId)
    .eq('estado', 'borrador')
    .select('id');
  if (error) throw new Error(`ig_mensajes: ${error.message}`);
  return ((data ?? []) as unknown[]).length > 0;
}

/**
 * Relee el post en Zernio y actualiza la fila local.
 * ⚠️ El `error` que escribió el webhook post.failed trae el detalle por plataforma
 * (app/api/webhooks/zernio/route.ts); getPost no lo trae. Si el estado sigue siendo
 * de fallo y la fila ya tiene un motivo, se CONSERVA: pisarlo con el genérico borraba
 * justo la respuesta a «¿por qué no salió?».
 */
export async function sincronizarPublicacionIg(ws: number, publicacionId: number): Promise<{ ok: true; estado: EstadoPost } | { ok: false; error: string }> {
  const fila = await leerPublicacionIg(publicacionId);
  if (!fila?.zernio_post_id) return { ok: false, error: 'Esa publicación no está en Zernio.' };
  const post = await getPost(ws, fila.zernio_post_id);
  const estado = estadoDeZernio(post.status);
  const fallo = post.platforms?.find((p) => p.status === 'failed');
  const db = await getTenantDb();
  const { error } = await db
    .from('contenido_posts')
    .update({
      estado,
      publicado_at: estado === 'publicado' ? (post.platforms?.find((p) => p.publishedAt)?.publishedAt ?? new Date().toISOString()) : null,
      error: estado === 'error' || estado === 'parcial'
        ? (fila.error ?? (fallo ? 'Instagram rechazó la publicación (ver Zernio para el detalle).' : null))
        : null,
    })
    .eq('id', publicacionId);
  if (error) return { ok: false, error: `contenido_posts: ${error.message}` };
  return { ok: true, estado };
}

/** Borra el post programado en Zernio y devuelve la fila local a 'borrador'. */
export async function cancelarProgramacionIg(ws: number, publicacionId: number): Promise<{ ok: boolean; error?: string }> {
  const fila = await leerPublicacionIg(publicacionId);
  if (!fila || fila.estado !== 'programado' || !fila.zernio_post_id) return { ok: false, error: 'Esa publicación no está programada.' };
  try {
    await deletePost(ws, fila.zernio_post_id);
  } catch (e) {
    // 400 = Zernio ya no la acepta (casi siempre: ya se publicó). Se sincroniza el
    // estado en vez de dejar la fila mintiendo.
    if (e instanceof ZernioError && e.status === 400) {
      await sincronizarPublicacionIg(ws, publicacionId).catch(() => null);
      return { ok: false, error: 'Zernio ya no permite cancelarla (probablemente ya se publicó). Se actualizó el estado.' };
    }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  const db = await getTenantDb();
  const { error } = await db
    .from('contenido_posts')
    .update({ estado: 'borrador', zernio_post_id: null, programado_at: null, error: null })
    .eq('id', publicacionId)
    .eq('estado', 'programado');
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

import 'server-only';

// =============================================================================
// comunidad-campana — la campana de notificaciones de la comunidad (leer y marcar leídas)
// =============================================================================
// Las notificaciones las ESCRIBE lib/comunidad-datos.ts (`notificar`: like, comentario, respuesta,
// mención, post seguido) y lib/comunidad-calendario.ts (`avisarEventosProximos`: el evento que empieza
// en las próximas 24 h). Acá se leen, se agrupan (los likes sobre la misma cosa van en un renglón,
// `agruparNotificaciones`, puro y con test) y se marcan leídas. La campana la tiene el equipo en su tab
// y el alumno en su portal: es UNA por persona y por comunidad.
//
// ⚠️ SIN MAILS (todavía): lo de Skool que llega por correo (el resumen diario, el recordatorio de 24 h)
//    queda anotado en lib/comunidad-notificaciones.ts.

import { getSupabaseServer } from './supabase';
import { leerTodo } from './supabase-paginado';
import { agruparNotificaciones, sinLeerDe, type FilaNotificacion } from './comunidad-notificaciones';
import { de, msg, infoDeMiembros, miembroVista, type Actor } from './comunidad-datos';
import { avisarEventosProximos, titulosDeEventos } from './comunidad-calendario';
import type { CampanaVista, NotificacionVista, Resultado } from './comunidad-tipos';

/** Cuántas filas lee la campana: lo de los últimos días de una comunidad activa, agrupado. */
const FILAS_CAMPANA = 80;
/** Cuántos renglones dibuja. */
const RENGLONES = 40;

/** La campana de quien mira: los renglones (más nuevos primero) y cuántos sin leer. */
export async function campanaComunidad(a: Actor): Promise<CampanaVista> {
  await avisarEventosProximos(a);
  const { data, error } = await de(a.ws, 'comunidad_notificaciones')
    .select('id, tipo, de_miembro, post_id, comentario_id, evento_id, ocurrencia, leida_at, created_at')
    .eq('producto_id', a.productoId).eq('para_miembro', a.clave)
    .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(FILAS_CAMPANA);
  if (error) throw new Error(error.message);
  const grupos = agruparNotificaciones((data ?? []) as FilaNotificacion[]).slice(0, RENGLONES);

  const quienes = new Set<string>();
  const posts = new Set<number>();
  const eventos = new Set<number>();
  for (const g of grupos) {
    g.de.slice(0, 3).forEach((k) => quienes.add(k));
    if (g.postId != null) posts.add(g.postId);
    if (g.eventoId != null) eventos.add(g.eventoId);
  }
  const [info, titulos, tituloEvento] = await Promise.all([
    infoDeMiembros(a.ws, quienes),
    titulosDePosts(a, [...posts]),
    titulosDeEventos(a, [...eventos]).catch(() => new Map<number, string>()),
  ]);
  const sinPuntos = new Map<string, number>();
  const items: NotificacionVista[] = grupos
    // Lo que se borró (el post, el evento) no se dibuja: un aviso que no lleva a ningún lado es ruido.
    .filter((g) => (g.postId == null || titulos.has(g.postId)) && (g.eventoId == null || tituloEvento.has(g.eventoId)))
    .map((g) => ({
      ids: g.ids,
      tipo: g.tipo,
      // El nivel no se dibuja en la campana (sólo la cara): no vale contar los likes de cada uno acá.
      quienes: g.de.slice(0, 3).map((k) => miembroVista(k, info, sinPuntos)),
      total: g.de.length,
      postId: g.postId,
      postTitulo: g.postId != null ? titulos.get(g.postId) ?? null : null,
      comentarioId: g.comentarioId,
      eventoId: g.eventoId,
      eventoTitulo: g.eventoId != null ? tituloEvento.get(g.eventoId) ?? null : null,
      ocurrencia: g.ocurrencia,
      creado: g.creado,
      leida: g.leida,
    }));
  // El globito cuenta RENGLONES sin leer de los que se dibujan (`sinLeerDe`): diez likes sobre el
  // mismo post son uno, y un aviso de algo que ya no está no enciende nada.
  return { items, sinLeer: sinLeerDe(items) };
}

async function titulosDePosts(a: Actor, ids: readonly number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (!ids.length) return out;
  const filas = await leerTodo<{ id: number; titulo: string }>(getSupabaseServer(), 'comunidad_posts', 'id, titulo', {
    orden: 'id', eq: { workspace_id: a.ws, producto_id: a.productoId }, filtros: (q) => q.in('id', ids.slice(0, 200)),
  });
  for (const f of filas) out.set(Number(f.id), f.titulo);
  return out;
}

/**
 * Marca leídas unas notificaciones (`ids`: las de un renglón) o TODAS (`'todas'`). Sólo las propias:
 * el filtro por `para_miembro` va siempre, así un id ajeno no marca nada.
 */
export async function marcarLeidas(a: Actor, idsRaw: unknown): Promise<Resultado> {
  try {
    const ahora = new Date().toISOString();
    let q = de(a.ws, 'comunidad_notificaciones').update({ leida_at: ahora })
      .eq('producto_id', a.productoId).eq('para_miembro', a.clave).is('leida_at', null);
    if (idsRaw !== 'todas') {
      const ids = Array.isArray(idsRaw) ? idsRaw.map(Number).filter((n) => Number.isSafeInteger(n) && n > 0).slice(0, 200) : [];
      if (!ids.length) return { ok: true };
      q = q.in('id', ids);
    }
    const { error } = await q;
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e, 'No se pudo marcar.') };
  }
}

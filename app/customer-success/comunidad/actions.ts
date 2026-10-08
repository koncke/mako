'use server';

// =============================================================================
// Server actions de la tab Comunidad (/customer-success/comunidad)
// =============================================================================
// Lo que el EQUIPO hace en la comunidad de un producto: leer, publicar, comentar, dar like, votar,
// moderar (fijar, borrar lo ajeno) y configurar (categorías, nombres de nivel). La lógica vive en
// lib/comunidad-datos.ts; acá está la PUERTA (./actor.ts), igual para todas.
//
// ⚠️ CADA ACTION AUTORIZA SOLA, y no por prolijidad: una server action es un POST que se puede
//    invocar directo, sin pasar por la página (Next 16,
//    node_modules/next/dist/docs/01-app/02-guides/data-security.md).
//
// ⚠️ SIN `revalidatePath`, a propósito, como las del curso: la pantalla aplica el cambio en el acto,
//    y releer la página entera por cada like pondría medio segundo detrás de cada clic.
//
// ⚠️ SÓLO SE EXPORTAN FUNCIONES ASYNC: en un archivo 'use server' un `export const` (o un tipo con
//    valor) tipa, pasa el typecheck y TIRA EL BUILD (AGENTS.md; guard en tests/campana-producto.test.ts).

import { actorDelEquipo } from './actor';
import {
  inicioComunidad, feedComunidad, detallePost, publicarPost, editarPost, borrarPost, fijarPost,
  comentar, editarComentario, borrarComentario, cambiarLike, votar, rankingComunidad, miembrosComunidad,
  perfilDe, guardarPerfil, urlSubidaAdjunto, descartarAdjunto, guardarCategoria, borrarCategoria,
  moverCategoria, guardarNombresNivel, seguirPost, aboutComunidad, guardarAbout, guardarAjustesComunidad,
  buscarEnComunidad, type Actor,
} from '@/lib/comunidad-datos';
import { calendarioComunidad, icsComunidad, guardarEvento, borrarEvento, opcionesDeEvento } from '@/lib/comunidad-calendario';
import { campanaComunidad, marcarLeidas } from '@/lib/comunidad-campana';
import { sacarAlumno, admitirAlumno, sacadosDeLaComunidad, cerrarComentarios } from '@/lib/comunidad-moderacion';

const fallo = (e: unknown, def: string) => ({ ok: false as const, error: e instanceof Error && e.message ? e.message : def });

/** Resuelve el actor y corre `fn`, o devuelve el porqué. Ninguna action tira: devuelve `{ ok: false }`. */
async function conActor<T extends object>(productoId: unknown, def: string, fn: (a: Actor) => Promise<({ ok: true } & T) | { ok: false; error: string }>) {
  try {
    const a = await actorDelEquipo(productoId);
    if (typeof a === 'string') return { ok: false as const, error: a };
    return await fn(a);
  } catch (e) {
    return fallo(e, def);
  }
}

export async function inicioComunidadAction(productoId: number) {
  return conActor(productoId, 'No pude cargar la comunidad.', async (a) => {
    const [comunidad, feed] = await Promise.all([inicioComunidad(a), feedComunidad(a, {})]);
    return { ok: true as const, comunidad, feed };
  });
}

export async function feedComunidadAction(productoId: number, q: { categoriaId: number | null; orden: string; pagina: number }) {
  return conActor(productoId, 'No pude cargar el feed.', async (a) => ({ ok: true as const, feed: await feedComunidad(a, q) }));
}

export async function detallePostAction(productoId: number, postId: number) {
  return conActor(productoId, 'No pude abrir el post.', async (a) => {
    const post = await detallePost(a, postId);
    return post ? { ok: true as const, post } : { ok: false as const, error: 'Ese post ya no está.' };
  });
}

export async function publicarPostAction(productoId: number, entrada: unknown) {
  return conActor(productoId, 'No se pudo publicar.', (a) => publicarPost(a, entrada));
}

export async function editarPostAction(productoId: number, postId: number, entrada: unknown) {
  return conActor(productoId, 'No se pudo guardar.', (a) => editarPost(a, postId, entrada));
}

export async function borrarPostAction(productoId: number, postId: number) {
  return conActor(productoId, 'No se pudo borrar.', (a) => borrarPost(a, postId));
}

export async function fijarPostAction(productoId: number, postId: number, si: boolean) {
  return conActor(productoId, 'No se pudo fijar.', (a) => fijarPost(a, postId, si === true));
}

export async function comentarAction(productoId: number, postId: number, entrada: unknown) {
  return conActor(productoId, 'No se pudo comentar.', (a) => comentar(a, postId, entrada));
}

export async function editarComentarioAction(productoId: number, comentarioId: number, entrada: unknown) {
  return conActor(productoId, 'No se pudo guardar.', (a) => editarComentario(a, comentarioId, entrada));
}

export async function borrarComentarioAction(productoId: number, comentarioId: number) {
  return conActor(productoId, 'No se pudo borrar.', (a) => borrarComentario(a, comentarioId));
}

export async function likeAction(productoId: number, objetivo: string, si: boolean) {
  return conActor(productoId, 'No se pudo guardar.', (a) => cambiarLike(a, objetivo, si === true));
}

export async function votarAction(productoId: number, postId: number, opcion: string) {
  return conActor(productoId, 'No se pudo votar.', (a) => votar(a, postId, opcion));
}

export async function rankingAction(productoId: number) {
  return conActor(productoId, 'No pude cargar el ranking.', async (a) => ({ ok: true as const, ranking: await rankingComunidad(a) }));
}

export async function miembrosAction(productoId: number, q: { filtro: string; q: string }) {
  return conActor(productoId, 'No pude cargar los miembros.', async (a) => ({ ok: true as const, miembros: await miembrosComunidad(a, q) }));
}

export async function perfilAction(productoId: number, clave: string) {
  return conActor(productoId, 'No pude abrir el perfil.', async (a) => {
    const perfil = await perfilDe(a, clave);
    return perfil ? { ok: true as const, perfil } : { ok: false as const, error: 'Esa persona ya no está.' };
  });
}

export async function guardarPerfilAction(productoId: number, entrada: unknown) {
  return conActor(productoId, 'No se pudo guardar.', (a) => guardarPerfil(a, entrada));
}

export async function subidaAdjuntoAction(productoId: number, mime: string, bytes: number) {
  return conActor(productoId, 'No pude preparar la subida.', (a) => urlSubidaAdjunto(a, mime, bytes));
}

export async function descartarAdjuntoAction(productoId: number, path: string) {
  return conActor(productoId, 'No se pudo descartar.', (a) => descartarAdjunto(a, path));
}

export async function guardarCategoriaAction(productoId: number, entrada: unknown) {
  return conActor(productoId, 'No se pudo guardar.', (a) => guardarCategoria(a, entrada));
}

export async function borrarCategoriaAction(productoId: number, categoriaId: number) {
  return conActor(productoId, 'No se pudo borrar.', (a) => borrarCategoria(a, categoriaId));
}

export async function moverCategoriaAction(productoId: number, categoriaId: number, dir: 'arriba' | 'abajo') {
  return conActor(productoId, 'No se pudo mover.', (a) => moverCategoria(a, categoriaId, dir));
}

export async function guardarNombresNivelAction(productoId: number, nombres: string[]) {
  return conActor(productoId, 'No se pudo guardar.', (a) => guardarNombresNivel(a, nombres));
}

// ── La segunda mitad: calendario, campana, About, búsqueda y moderación ──────────
// Cada una pasa por la MISMA puerta (`conActor`), y cada función de lib/ vuelve a preguntar su regla
// (`puedeGestionarEventos`, `puedeSacar`, `puedeModerar`, `puedeEditarAbout`…).

export async function calendarioAction(productoId: number, q: { desde: number; hasta: number }) {
  return conActor(productoId, 'No pude cargar el calendario.', async (a) => ({ ok: true as const, calendario: await calendarioComunidad(a, q) }));
}

export async function icsAction(productoId: number, q: { id: number; fecha: string | null; serie: boolean }) {
  return conActor(productoId, 'No pude armar el archivo.', (a) => icsComunidad(a, q));
}

export async function opcionesEventoAction(productoId: number) {
  return conActor(productoId, 'No pude preparar el evento.', (a) => opcionesDeEvento(a));
}

export async function guardarEventoAction(productoId: number, entrada: unknown) {
  return conActor(productoId, 'No se pudo guardar el evento.', (a) => guardarEvento(a, entrada));
}

export async function borrarEventoAction(productoId: number, q: { id: number; alcance: string; ocurrencia: string | null }) {
  return conActor(productoId, 'No se pudo borrar el evento.', (a) => borrarEvento(a, q));
}

export async function campanaAction(productoId: number) {
  return conActor(productoId, 'No pude cargar los avisos.', async (a) => ({ ok: true as const, campana: await campanaComunidad(a) }));
}

export async function leerCampanaAction(productoId: number, ids: number[] | 'todas') {
  return conActor(productoId, 'No se pudo marcar.', (a) => marcarLeidas(a, ids));
}

export async function seguirPostAction(productoId: number, postId: number, si: boolean) {
  return conActor(productoId, 'No se pudo guardar.', (a) => seguirPost(a, postId, si === true));
}

export async function aboutAction(productoId: number) {
  return conActor(productoId, 'No pude cargar el About.', async (a) => ({ ok: true as const, about: await aboutComunidad(a) }));
}

export async function guardarAboutAction(productoId: number, entrada: unknown) {
  return conActor(productoId, 'No se pudo guardar.', (a) => guardarAbout(a, entrada));
}

export async function guardarAjustesAction(productoId: number, entrada: unknown) {
  return conActor(productoId, 'No se pudo guardar.', (a) => guardarAjustesComunidad(a, entrada));
}

export async function buscarAction(productoId: number, q: string) {
  return conActor(productoId, 'No pude buscar.', async (a) => ({ ok: true as const, busqueda: await buscarEnComunidad(a, q) }));
}

export async function sacarAlumnoAction(productoId: number, clave: string, opts: { motivo: string; borrarContenido: boolean }) {
  return conActor(productoId, 'No se pudo sacar.', (a) => sacarAlumno(a, clave, opts));
}

export async function admitirAlumnoAction(productoId: number, clave: string) {
  return conActor(productoId, 'No se pudo admitir.', (a) => admitirAlumno(a, clave));
}

export async function sacadosAction(productoId: number) {
  return conActor(productoId, 'No pude leer a quién se sacó.', (a) => sacadosDeLaComunidad(a));
}

export async function cerrarComentariosAction(productoId: number, postId: number, si: boolean) {
  return conActor(productoId, 'No se pudo guardar.', (a) => cerrarComentarios(a, postId, si === true));
}

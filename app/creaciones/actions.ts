'use server';
// =============================================================================
// /creaciones — las acciones de la pantalla (y del botón «Publicar» que cada feature monta)
// =============================================================================
// Todo pasa por lib/creaciones.ts, que es lo mismo que corre la API de MaKo (área «creaciones»): una implementación,
// dos puertas. Sólo el ADMIN del negocio (como la pantalla, `requireRolWs([])`). En un archivo 'use server' sólo se
// exportan funciones async (AGENTS.md): los tipos van con `export type`, que no deja valor.
// =============================================================================

import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { rateLimit } from '@/lib/rate-limit';
import {
  CreacionError, FaltaTablaCreacionesError, compartirCreacion, darEstrella, guardarCreacion, listarCreaciones,
  misCreaciones, opcionesParaPublicar, plantillasDelTipo, publicarCreacion, quitarEstrella, rankingCreaciones,
  retirarCreacion, usarCreacion, verCreacion,
  type Creacion, type CreacionDetalle, type CreacionRankeada, type FiltroCreaciones,
} from '@/lib/creaciones';
import { esOrdenCreaciones, esPeriodoRanking, esTipoCreacion, sanearOrigenId } from '@/lib/creaciones-reglas';
import { esVisibilidad } from '@/lib/plantillas-propias-reglas';

type Puerta = { ws: number; email: string } | { error: string };

async function puerta(): Promise<Puerta> {
  const [sesion, rol] = await Promise.all([getUsuarioActual(), getRolWsEfectivo()]);
  if (!sesion || rol == null) return { error: 'Tu sesión venció. Vuelve a entrar.' };
  if (rol !== 'admin') return { error: 'Solo el administrador.' };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Entra a un negocio primero.' };
  return { ws, email: sesion.email ?? '' };
}

/** Lo que se le dice a la persona: el motivo si es suyo (no existe, no es tuya), genérico si es nuestro. */
function falla(que: string, ws: number, e: unknown): { error: string } {
  if (e instanceof CreacionError || e instanceof FaltaTablaCreacionesError) return { error: e.message };
  console.error(`[creaciones] ${que} (ws ${ws}): ${e instanceof Error ? e.message : String(e)}`);
  return { error: `No se pudo ${que}. Prueba de nuevo.` };
}

export async function listarCreacionesAction(f: FiltroCreaciones): Promise<{ creaciones: Creacion[]; hayMas: boolean } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  try {
    return await listarCreaciones(p.ws, {
      tipo: esTipoCreacion(f?.tipo) ? f.tipo : null,
      orden: esOrdenCreaciones(f?.orden) ? f.orden : null,
      q: typeof f?.q === 'string' ? f.q : null,
      pagina: typeof f?.pagina === 'number' ? f.pagina : null,
    });
  } catch (e) { return falla('cargar la galería', p.ws, e); }
}

export async function verCreacionAction(id: number): Promise<CreacionDetalle | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  try { return await verCreacion(p.ws, Number(id)); } catch (e) { return falla('abrir la creación', p.ws, e); }
}

export async function misCreacionesAction(): Promise<Creacion[] | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  try { return await misCreaciones(p.ws); } catch (e) { return falla('cargar lo que publicaste', p.ws, e); }
}

export async function estrellaAction(id: number, dar: boolean): Promise<{ estrellas: number; conEstrella: boolean } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!rateLimit(`creaciones:estrella:${p.ws}`, 60, 60_000)) return { error: 'Demasiados clics. Espera un minuto.' };
  try {
    const r = dar ? await darEstrella(p.ws, Number(id), p.email) : await quitarEstrella(p.ws, Number(id));
    return { estrellas: r.estrellas, conEstrella: dar };
  } catch (e) { return falla(dar ? 'dar la estrella' : 'quitar la estrella', p.ws, e); }
}

export async function opcionesPublicarAction(tipo: string): Promise<Array<{ id: string; nombre: string }> | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!esTipoCreacion(tipo)) return { error: 'Tipo desconocido.' };
  try { return await opcionesParaPublicar(tipo); } catch (e) { return falla('leer lo que puedes publicar', p.ws, e); }
}

export async function publicarCreacionAction(x: { tipo: string; origenId: string | number; titulo?: string; descripcion?: string; autorNombre?: string }): Promise<{ id: number; actualizada: boolean } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!esTipoCreacion(x?.tipo)) return { error: 'Tipo desconocido.' };
  const origenId = sanearOrigenId(x?.origenId);
  if (!origenId) return { error: 'Elige qué publicar.' };
  if (!rateLimit(`creaciones:publicar:${p.ws}`, 10, 60_000)) return { error: 'Demasiados intentos. Espera un minuto.' };
  try {
    const r = await publicarCreacion(p.ws, { tipo: x.tipo, origenId, titulo: x.titulo, descripcion: x.descripcion, autorNombre: x.autorNombre }, p.email);
    return { id: r.id, actualizada: r.actualizada };
  } catch (e) { return falla('publicar', p.ws, e); }
}

export async function retirarCreacionAction(id: number): Promise<{ ok: true } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  try { await retirarCreacion(p.ws, Number(id)); return { ok: true }; } catch (e) { return falla('retirar', p.ws, e); }
}

/** Usa la creación y devuelve a dónde ir. El `?ws=` de la pestaña se lo pega el navegador (`conWs`): el server no sabe
 *  si esta pestaña mira a un cliente. */
export async function usarCreacionAction(id: number): Promise<{ ruta: string; nombre: string; aviso: string | null } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!rateLimit(`creaciones:usar:${p.ws}`, 20, 60_000)) return { error: 'Demasiados intentos. Espera un minuto.' };
  try {
    const r = await usarCreacion(p.ws, Number(id));
    return { ruta: r.ruta, nombre: r.nombre, aviso: r.aviso };
  } catch (e) { return falla('usar la creación', p.ws, e); }
}

// ── Plantillas propias (6/11/2026) y el ranking ──────────────────────────────

/** «Guardar como plantilla» de una tab: sólo para el negocio (`privada`) o para todos (`publica`, sin sus datos). */
export async function guardarPlantillaAction(x: { tipo: string; origenId: string | number; visibilidad: string; titulo?: string; descripcion?: string; autorNombre?: string }): Promise<{ id: number; actualizada: boolean; estado: string } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!esTipoCreacion(x?.tipo)) return { error: 'Tipo desconocido.' };
  if (!esVisibilidad(x?.visibilidad)) return { error: 'Elige si es sólo para tu negocio o para todos.' };
  const origenId = sanearOrigenId(x?.origenId);
  if (!origenId) return { error: 'Elige qué guardar.' };
  if (!rateLimit(`creaciones:publicar:${p.ws}`, 10, 60_000)) return { error: 'Demasiados intentos. Espera un minuto.' };
  try {
    const r = await guardarCreacion(p.ws, { tipo: x.tipo, origenId, visibilidad: x.visibilidad, titulo: x.titulo, descripcion: x.descripcion, autorNombre: x.autorNombre }, p.email);
    return { id: r.id, actualizada: r.actualizada, estado: r.estado };
  } catch (e) { return falla('guardar la plantilla', p.ws, e); }
}

/** Comparte con la comunidad una plantilla que era sólo del negocio (crea su copia limpia; la privada queda). */
export async function compartirPlantillaAction(id: number, autorNombre?: string): Promise<{ id: number; actualizada: boolean } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!rateLimit(`creaciones:publicar:${p.ws}`, 10, 60_000)) return { error: 'Demasiados intentos. Espera un minuto.' };
  try {
    const r = await compartirCreacion(p.ws, Number(id), p.email, autorNombre);
    return { id: r.id, actualizada: r.actualizada };
  } catch (e) { return falla('compartir la plantilla', p.ws, e); }
}

/** Las plantillas de un tipo para «Nuevo …» de su tab: las tuyas y las mejores de la comunidad. */
export async function plantillasDelTipoAction(tipo: string): Promise<{ mias: Creacion[]; comunidad: Creacion[] } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!esTipoCreacion(tipo)) return { error: 'Tipo desconocido.' };
  try { return await plantillasDelTipo(p.ws, tipo); } catch (e) { return falla('cargar tus plantillas', p.ws, e); }
}

/** El ranking de lo publicado: de la semana, del mes o de siempre. */
export async function rankingAction(periodo: string, tipo?: string | null): Promise<CreacionRankeada[] | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!esPeriodoRanking(periodo)) return { error: 'Período desconocido.' };
  try { return await rankingCreaciones(p.ws, { periodo, tipo: esTipoCreacion(tipo) ? tipo : null }); } catch (e) { return falla('cargar el ranking', p.ws, e); }
}

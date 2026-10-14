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
  CreacionError, FaltaTablaCreacionesError, darEstrella, listarCreaciones, misCreaciones, opcionesParaPublicar,
  publicarCreacion, quitarEstrella, retirarCreacion, usarCreacion, verCreacion,
  type Creacion, type CreacionDetalle, type FiltroCreaciones,
} from '@/lib/creaciones';
import { esOrdenCreaciones, esTipoCreacion } from '@/lib/creaciones-reglas';

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

export async function opcionesPublicarAction(tipo: string): Promise<Array<{ id: number; nombre: string }> | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!esTipoCreacion(tipo)) return { error: 'Tipo desconocido.' };
  try { return await opcionesParaPublicar(tipo); } catch (e) { return falla('leer lo que puedes publicar', p.ws, e); }
}

export async function publicarCreacionAction(x: { tipo: string; origenId: number; titulo?: string; descripcion?: string; autorNombre?: string }): Promise<{ id: number; actualizada: boolean } | { error: string }> {
  const p = await puerta();
  if ('error' in p) return p;
  if (!esTipoCreacion(x?.tipo)) return { error: 'Tipo desconocido.' };
  if (!rateLimit(`creaciones:publicar:${p.ws}`, 10, 60_000)) return { error: 'Demasiados intentos. Espera un minuto.' };
  try {
    const r = await publicarCreacion(p.ws, { tipo: x.tipo, origenId: Number(x.origenId), titulo: x.titulo, descripcion: x.descripcion, autorNombre: x.autorNombre }, p.email);
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

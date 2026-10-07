'use server';

// =============================================================================
// Server actions de la tab Curso (/customer-success/curso)
// =============================================================================
// Crear, editar, borrar y ordenar las clases de un producto, y la subida de sus videos. Lo
// que se escribe y cómo se valida vive en lib/curso-admin.ts; acá está la PUERTA. Desde la
// mig 0208, también la marca de grabar (admin) y las notas del equipo (quien ve la tab, con la
// lógica en lib/curso-notas.ts).
//
// ⚠️ CADA ACTION AUTORIZA SOLA, y no por prolijidad: una server action es un POST que se
// puede invocar directo, sin pasar por la página (Next 16,
// node_modules/next/dist/docs/01-app/02-guides/data-security.md). Que el botón sólo se dibuje
// para un admin no protege nada — el guard de la página (`requireCapa`) tampoco corre acá.
//
// ⚠️ Y EDITAR ES DE UN ADMIN DEL WORKSPACE, igual que las etapas de la entrega
// (`guardarEtapasEntregaAction`): el curso es lo que ven TODOS los clientes en su portal, y
// borrar una clase se lleva el avance de cada uno. Mirar la tab alcanza con tenerla.
//
// ⚠️ SÓLO SE EXPORTAN FUNCIONES ASYNC: en un archivo 'use server' un `export const` tipa,
// pasa el typecheck y TIRA EL BUILD (AGENTS.md; guard en tests/campana-producto.test.ts).

import { revalidatePath } from 'next/cache';
import { getRolWsEfectivo, getCapaActual, adminDeWorkspaceActual } from '@/lib/workspace';
import { getUsuarioActual } from '@/lib/auth';
import { tabEnCapa } from '@/lib/capas';
import { guardarClase, borrarClase, moverClase, urlSubida, urlLectura, descartarVideo, marcarGrabar } from '@/lib/curso-admin';
import { notasDe, agregarNota, borrarNota, urlSubidaNota, descartarAdjunto, urlAdjunto, type Quien } from '@/lib/curso-notas';
import type { Clase } from '@/lib/curso';
import type { EntradaClase, EntradaNota, DestinoNota, NotaVista } from './reglas';
import { anotarVistaAbierta } from './onboarding-sync';

const RUTA = '/customer-success/curso';

/** ¿Puede MIRAR la tab? La misma pregunta que `requireCapa('customer-success')`, sin redirect. */
async function puedeVer(): Promise<string | null> {
  if (!(await getRolWsEfectivo())) return 'Tu sesión venció.';
  if (!tabEnCapa('customer-success', await getCapaActual())) return 'Tu plan no incluye Customer Success.';
  return null;
}

/** ¿Puede EDITAR el curso? Ver la tab, y además ser admin de este workspace. */
async function puedeEditar(): Promise<string | null> {
  const no = await puedeVer();
  if (no) return no;
  if (!(await adminDeWorkspaceActual())) return 'Solo un administrador edita el curso.';
  return null;
}

const fallo = (e: unknown, def: string) => ({ ok: false as const, error: e instanceof Error && e.message ? e.message : def });

/** Crea o edita una clase. Devuelve la clase como quedó, para dibujarla sin esperar a la página. */
export async function guardarClaseAction(entrada: EntradaClase): Promise<{ ok: true; clase: Clase } | { ok: false; error: string }> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    const r = await guardarClase(entrada);
    if (!r.ok) return r;
    revalidatePath(RUTA);
    return { ok: true, clase: r.clase };
  } catch (e) {
    return fallo(e, 'No se pudo guardar.');
  }
}

/** Borra una clase (y el avance de cada cliente en ella: la pantalla pregunta antes). */
export async function borrarClaseAction(claseId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    const r = await borrarClase(Number(claseId));
    if (!r.ok) return r;
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e, 'No se pudo borrar.');
  }
}

/**
 * Sube o baja una clase dentro de su etapa. Devuelve el orden que quedó en la base, para que
 * la pantalla corrija si su versión optimista no coincide (otra pestaña movió en el medio).
 *
 * ⚠️ SIN `revalidatePath`, a propósito: la pantalla ya movió la fila en el acto, y releer la
 * página entera (la entrega, los clientes, el avance) por cada flechita pone medio segundo de
 * espera detrás de un gesto que se repite cinco veces seguidas.
 */
export async function moverClaseAction(claseId: number, dir: 'arriba' | 'abajo'): Promise<{ ok: true; ids: number[] } | { ok: false; error: string }> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    return await moverClase(Number(claseId), dir);
  } catch (e) {
    return fallo(e, 'No se pudo mover.');
  }
}

/** La URL firmada para que el navegador suba un video directo al bucket (ver `urlSubida`). */
export async function urlSubidaVideoAction(productoId: number, mime: string, bytes: number): Promise<
  { ok: true; path: string; signedUrl: string; apikey: string | null } | { ok: false; error: string }
> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    return await urlSubida(Number(productoId), String(mime ?? ''), Number(bytes));
  } catch (e) {
    return fallo(e, 'No pude preparar la subida.');
  }
}

/** Borra un video subido que ninguna clase guardó (el editor se cerró sin guardar). */
export async function descartarVideoAction(path: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    return await descartarVideo(String(path ?? ''));
  } catch (e) {
    return fallo(e, 'No se pudo descartar.');
  }
}

/**
 * El ensayo del onboarding de la tab: alguien del equipo abrió la vista del alumno. Sólo anota
 * el paso (`curso_vista`): la vista previa no crea accesos ni escribe progreso.
 *
 * ⚠️ DE UN ADMIN, como el resto del onboarding de una tab (`marcarPasoCopyAction`): lo que se
 * anota es que el curso quedó revisado, y eso lo decide quien lo arma.
 */
export async function marcarVistaAlumnoAction(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    const steps = await anotarVistaAbierta();
    if (!steps?.curso_vista?.done) return { ok: false, error: 'Antes falta tu programa.' };
    revalidatePath(RUTA);
    return { ok: true };
  } catch (e) {
    return fallo(e, 'No se pudo anotar.');
  }
}

/** Un link de vida corta para ver un video subido. Alcanza con poder mirar la tab. */
export async function urlVerVideoAction(path: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const no = await puedeVer();
    if (no) return { ok: false, error: no };
    return await urlLectura(String(path ?? ''));
  } catch (e) {
    return fallo(e, 'No pude abrir el video.');
  }
}

// ── Grabar / no grabar (#693) ────────────────────────────────────────────────

/**
 * Marca una clase para grabar, para no grabar, o la deja sin decidir (`null`). Es de un ADMIN,
 * como editar la clase; el resto ve la marca.
 *
 * ⚠️ SIN `revalidatePath`, como `moverClaseAction`: la pantalla ya cambió la marca en el acto, y
 * releer la página entera por cada clic pone medio segundo detrás de un gesto que se repite
 * clase tras clase.
 */
export async function marcarGrabarAction(claseId: number, valor: boolean | null): Promise<{ ok: true; grabar: boolean | null } | { ok: false; error: string }> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    return await marcarGrabar(Number(claseId), valor);
  } catch (e) {
    return fallo(e, 'No se pudo marcar.');
  }
}

// ── Las notas del equipo (#692) ──────────────────────────────────────────────
// ⚠️ LA PUERTA ES `puedeVer` Y NO `puedeEditar`: comenta quien VE la tab (el equipo de Mauricio),
// no sólo un admin. Borrar una nota lo decide lib/curso-notas.ts (la autora o un admin), y el
// autor sale de la SESIÓN, nunca del pedido.

/** Quién está mirando, armado desde la sesión. `null` = no hay sesión. */
async function quienMira(): Promise<Quien | null> {
  const s = await getUsuarioActual();
  if (!s) return null;
  return { email: s.email ?? '', nombre: s.nombre ?? '', admin: (await adminDeWorkspaceActual()) != null };
}

/** Las notas de una clase o de una etapa. */
export async function notasAction(productoId: number, destino: DestinoNota): Promise<{ ok: true; notas: NotaVista[] } | { ok: false; error: string }> {
  try {
    const no = await puedeVer();
    if (no) return { ok: false, error: no };
    const quien = await quienMira();
    if (!quien) return { ok: false, error: 'Tu sesión venció.' };
    return await notasDe(Number(productoId), destino, quien);
  } catch (e) {
    return fallo(e, 'No pude leer las notas.');
  }
}

/** Guarda una nota (con su adjunto ya subido, si trae). */
export async function agregarNotaAction(entrada: EntradaNota): Promise<{ ok: true; nota: NotaVista } | { ok: false; error: string }> {
  try {
    const no = await puedeVer();
    if (no) return { ok: false, error: no };
    const quien = await quienMira();
    if (!quien) return { ok: false, error: 'Tu sesión venció.' };
    return await agregarNota(entrada, quien);
  } catch (e) {
    return fallo(e, 'No se pudo guardar la nota.');
  }
}

/** Borra una nota: la autora o un admin (lo decide lib/curso-notas.ts). */
export async function borrarNotaAction(notaId: number): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const no = await puedeVer();
    if (no) return { ok: false, error: no };
    const quien = await quienMira();
    if (!quien) return { ok: false, error: 'Tu sesión venció.' };
    return await borrarNota(Number(notaId), quien);
  } catch (e) {
    return fallo(e, 'No se pudo borrar la nota.');
  }
}

/** La URL firmada para que el navegador suba un adjunto directo al bucket `curso-notas`. */
export async function urlSubidaNotaAction(productoId: number, mime: string, bytes: number): Promise<
  { ok: true; path: string; signedUrl: string; apikey: string | null } | { ok: false; error: string }
> {
  try {
    const no = await puedeVer();
    if (no) return { ok: false, error: no };
    return await urlSubidaNota(Number(productoId), String(mime ?? ''), Number(bytes));
  } catch (e) {
    return fallo(e, 'No pude preparar la subida.');
  }
}

/** Borra un adjunto subido que no llegó a quedar en ninguna nota. */
export async function descartarAdjuntoNotaAction(path: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const no = await puedeVer();
    if (no) return { ok: false, error: no };
    return await descartarAdjunto(String(path ?? ''));
  } catch (e) {
    return fallo(e, 'No se pudo descartar.');
  }
}

/** Un link de vida corta para abrir el adjunto de una nota (por el id de la nota, no por la ruta). */
export async function urlAdjuntoNotaAction(notaId: number): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const no = await puedeVer();
    if (no) return { ok: false, error: no };
    return await urlAdjunto(Number(notaId));
  } catch (e) {
    return fallo(e, 'No pude abrir el archivo.');
  }
}

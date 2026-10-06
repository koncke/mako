'use server';

// =============================================================================
// Server actions de la tab Curso (/customer-success/curso)
// =============================================================================
// Crear, editar, borrar y ordenar las clases de un producto, y la subida de sus videos. Lo
// que se escribe y cómo se valida vive en lib/curso-admin.ts; acá está la PUERTA.
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
import { tabEnCapa } from '@/lib/capas';
import { guardarClase, borrarClase, moverClase, urlSubida, urlLectura, descartarVideo } from '@/lib/curso-admin';
import type { Clase } from '@/lib/curso';
import type { EntradaClase } from './reglas';

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

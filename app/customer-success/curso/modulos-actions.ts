'use server';

// =============================================================================
// Server actions de los MÓDULOS del curso, sus candados y la lección editable (/customer-success/curso)
// =============================================================================
// Pedido de Martín (07/10/2026, items 6, 7, 8, 11, 12 y 16): módulos que se renombran y se arrastran
// (y eso cambia las etapas del kanban), «Nuevo módulo», desvincular un módulo del kanban, clases que
// se bloquean con requisitos, «Nueva clase» primero, y la lección que se edita en su lugar. Las
// decisiones, en docs/diseno-curso-skool.md (D1, D2 y D4).
//
// Lo que se escribe y cómo se valida vive en lib/curso-modulos-datos.ts (módulos y candados) y en
// lib/curso-admin.ts (las clases); acá está la PUERTA (./puerta-curso.ts, la misma de ./actions.ts):
// editar es de un ADMIN del workspace, sobre un producto PROPIO. Cada action pregunta sola: una server
// action es un POST que se puede mandar sin pasar por la página.
//
// ⚠️ CADA ACTION DEVUELVE LO QUE LA PANTALLA NECESITA PARA NO RECARGAR: la lista de módulos como
// QUEDÓ (releída: no la que pidió la pantalla — un arrastre puede terminar distinto si el kanban
// agrupa por fases), o la clase como quedó.
//
// ⚠️ SIN `revalidatePath` SALVO DONDE CAMBIA EL KANBAN (crear, renombrar, vincular y reordenar
// módulos): la pantalla del curso ya tiene lo que vuelve, y releer la página entera por cada gesto
// pone medio segundo detrás de algo que se repite. El kanban de Clientes es otra página: ésa sí se
// marca para que la próxima vez lea las etapas nuevas.
//
// ⚠️ SÓLO SE EXPORTAN FUNCIONES ASYNC: en un archivo 'use server' un `export const` tipa, pasa el
// typecheck y TIRA EL BUILD (AGENTS.md; guard en tests/campana-producto.test.ts). Los tipos de lo que
// devuelven viven en lib/curso-modulos.ts, lib/curso-modulos-datos.ts y lib/curso.ts.

import { revalidatePath } from 'next/cache';
import { puedeEditar, productoPropio } from './puerta-curso';
import {
  crearModulo, renombrarModulo, vincularModulo, reordenarModulos, borrarModulo, guardarBloqueo,
  type ObjetivoBloqueo,
} from '@/lib/curso-modulos-datos';
import { crearClase, moverClaseA, guardarCampoClase, type CambioClase } from '@/lib/curso-admin';
import type { ModuloCurso } from '@/lib/curso-modulos';
import type { Bloqueo } from '@/lib/curso-bloqueo';
import type { Clase } from '@/lib/curso';

type Fallo = { ok: false; error: string };
const fallo = (e: unknown, def: string): Fallo => ({ ok: false, error: e instanceof Error && e.message ? e.message : def });

/** Admin y producto propio: la puerta de todo lo que toca un curso por su producto. */
async function puertaProducto(productoId: number): Promise<string | null> {
  const no = await puedeEditar();
  if (no) return no;
  return productoPropio(Number(productoId));
}

/** Marca el kanban de Clientes: lee las etapas en su próxima carga. */
const alKanban = () => revalidatePath('/customer-success');

// ── Los módulos ───────────────────────────────────────────────────────────────

/**
 * Crea un módulo después de `despuesDe` (`null` = al principio). Vinculado (el default) agrega su
 * etapa al kanban en ese lugar; nada va antes de la primera etapa del kanban.
 */
export async function crearModuloAction(
  productoId: number,
  datos: { nombre: string; vinculado?: boolean; despuesDe?: string | null },
): Promise<{ ok: true; clave: string; modulos: ModuloCurso[] } | Fallo> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    const r = await crearModulo(Number(productoId), datos ?? {});
    if (r.ok && datos?.vinculado !== false) alKanban();
    return r;
  } catch (e) {
    return fallo(e, 'No se pudo crear el módulo.');
  }
}

/** Renombra un módulo (el clic en su nombre). Uno vinculado renombra su etapa del kanban. */
export async function renombrarModuloAction(productoId: number, clave: string, nombre: string): Promise<{ ok: true; nombre: string; modulos: ModuloCurso[] } | Fallo> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    const r = await renombrarModulo(Number(productoId), String(clave ?? ''), nombre);
    if (r.ok && r.modulos.find((m) => m.clave === clave)?.vinculado) alKanban();
    return r;
  } catch (e) {
    return fallo(e, 'No se pudo renombrar.');
  }
}

/**
 * Desvincula un módulo del kanban (`vincular: false`: su etapa queda en el kanban sin ser módulo, y
 * sus clases pasan a un módulo suelto con clave nueva) o vincula un suelto (`true`: nace su etapa).
 * Devuelve la clave NUEVA del módulo.
 */
export async function vincularModuloAction(productoId: number, clave: string, vincular: boolean): Promise<{ ok: true; clave: string; modulos: ModuloCurso[] } | Fallo> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    if (typeof vincular !== 'boolean') return { ok: false, error: 'No se entiende qué hacer.' };
    const r = await vincularModulo(Number(productoId), String(clave ?? ''), vincular);
    if (r.ok) alKanban();
    return r;
  } catch (e) {
    return fallo(e, vincular ? 'No se pudo vincular.' : 'No se pudo desvincular.');
  }
}

/**
 * Reordena los módulos: `claves` es la lista ENTERA en el orden nuevo (el arrastre). Reordena las
 * etapas del kanban (sin mover la primera, con sus fases) y las anclas de los sueltos.
 */
export async function reordenarModulosAction(productoId: number, claves: string[]): Promise<{ ok: true; modulos: ModuloCurso[] } | Fallo> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    const r = await reordenarModulos(Number(productoId), claves);
    if (r.ok) alKanban();
    return r;
  } catch (e) {
    return fallo(e, 'No se pudo ordenar.');
  }
}

/** Borra un módulo SUELTO sin clases (una etapa se borra en el kanban). */
export async function borrarModuloAction(productoId: number, clave: string): Promise<{ ok: true; modulos: ModuloCurso[] } | Fallo> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    return await borrarModulo(Number(productoId), String(clave ?? ''));
  } catch (e) {
    return fallo(e, 'No se pudo borrar el módulo.');
  }
}

// ── Los candados (D2) ─────────────────────────────────────────────────────────

/**
 * El candado de un módulo (`{ modulo: clave }`) o de una clase (`{ clase: id }`). `bloqueo: null` =
 * el default (vinculado: su etapa; suelto: abierto; clase: hereda). Devuelve los módulos y, si fue
 * de una clase, la clase como quedó.
 */
export async function guardarBloqueoAction(
  productoId: number,
  objetivo: ObjetivoBloqueo,
  bloqueo: Bloqueo | null,
): Promise<{ ok: true; modulos: ModuloCurso[]; clase?: Clase } | Fallo> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    const o = objetivo as { modulo?: unknown; clase?: unknown } | null;
    const objetivoValido: ObjetivoBloqueo | null = o && typeof o.modulo === 'string' ? { modulo: o.modulo }
      : o && Number.isInteger(Number(o.clase)) && Number(o.clase) > 0 ? { clase: Number(o.clase) } : null;
    if (!objetivoValido) return { ok: false, error: 'No se entiende a qué ponerle el candado.' };
    return await guardarBloqueo(Number(productoId), objetivoValido, bloqueo);
  } catch (e) {
    return fallo(e, 'No se pudo guardar el candado.');
  }
}

// ── Las clases ────────────────────────────────────────────────────────────────

/** «Nueva clase» AL PRINCIPIO del módulo. Devuelve la clase: la pantalla la abre para editarla. */
export async function crearClaseAction(productoId: number, moduloClave: string): Promise<{ ok: true; clase: Clase } | Fallo> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    return await crearClase(Number(productoId), String(moduloClave ?? ''));
  } catch (e) {
    return fallo(e, 'No se pudo crear la clase.');
  }
}

/**
 * Lleva una clase a un módulo, antes de la clase `antesDe` (`null` = al final): el arrastre de una
 * clase, en su módulo o a otro. Devuelve la clase y el orden del módulo de destino como quedaron.
 */
export async function moverClaseAAction(claseId: number, moduloClave: string, antesDe: number | null): Promise<{ ok: true; clase: Clase; ids: number[] } | Fallo> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    return await moverClaseA(Number(claseId), String(moduloClave ?? ''), antesDe == null ? null : Number(antesDe));
  } catch (e) {
    return fallo(e, 'No se pudo mover la clase.');
  }
}

/**
 * Guarda UNA parte de la lección (D4): `{ titulo }`, `{ descripcionHtml }`, `{ video }`, `{ tarea }`,
 * `{ campos }`, `{ obligatoria }`, `{ porArea }`, `{ minutos }` o `{ tipo }`. Un `update` de sólo esas
 * columnas, nunca la fila entera. Devuelve la clase como quedó.
 */
export async function guardarCampoClaseAction(claseId: number, cambio: CambioClase): Promise<{ ok: true; clase: Clase } | Fallo> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    return await guardarCampoClase(Number(claseId), cambio);
  } catch (e) {
    return fallo(e, 'No se pudo guardar.');
  }
}

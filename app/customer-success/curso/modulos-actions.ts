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
// módulos, y desde el 08/10/2026 borrar uno vinculado y devolverlo con «Deshacer», que quitan y
// devuelven su columna) Y EN EL «GUARDAR» DE LA LECCIÓN (`guardarLeccionAction`: el Atrás, ver ahí): la pantalla del curso ya tiene lo que vuelve, y releer la página entera por cada gesto
// pone medio segundo detrás de algo que se repite. El kanban de Clientes es otra página: ésa sí se
// marca para que la próxima vez lea las etapas nuevas.
//
// ⚠️ SÓLO SE EXPORTAN FUNCIONES ASYNC: en un archivo 'use server' un `export const` tipa, pasa el
// typecheck y TIRA EL BUILD (AGENTS.md; guard en tests/campana-producto.test.ts). Los tipos de lo que
// devuelven viven en lib/curso-modulos.ts, lib/curso-modulos-datos.ts y lib/curso.ts.

import { revalidatePath } from 'next/cache';
import { puedeEditar, productoPropio } from './puerta-curso';
import {
  crearModulo, renombrarModulo, vincularModulo, reordenarModulos, borrarModulo, restaurarModulo, previaDeQuitar, guardarBloqueo,
  type ObjetivoBloqueo, type EtapaQuitada,
} from '@/lib/curso-modulos-datos';
import { crearClase, moverClaseA, guardarCampoClase, guardarLeccion, restaurarClases, type CambioClase, type ResultadoLeccion } from '@/lib/curso-admin';
import type { CambiosLeccion } from './leccion-reglas';
import { getUsuarioActual } from '@/lib/auth';
import type { ModuloCurso, PreguntaDestino } from '@/lib/curso-modulos';
import type { EtapaEntrega } from '@/lib/servicio-etapas';
import type { Bloqueo } from '@/lib/curso-bloqueo';
import type { Clase } from '@/lib/curso';

type Fallo = { ok: false; error: string };
/** Un rechazo que trae una PREGUNTA (a dónde van los clientes de una etapa que se quita). */
type FalloConPregunta = { ok: false; error: string; pregunta?: PreguntaDestino };
const fallo = (e: unknown, def: string): Fallo => ({ ok: false, error: e instanceof Error && e.message ? e.message : def });

/** Quién firma la línea del historial de un cliente que se muda: el email de quien está logueado, como en el CRM. */
async function autorActual(): Promise<string> {
  try {
    return (await getUsuarioActual())?.email?.trim() || 'CRM';
  } catch {
    return 'CRM';
  }
}

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
 * El interruptor «Etapa del kanban» (08/10/2026, item 15). APAGARLO QUITA LA ETAPA DEL KANBAN: si tiene
 * clientes y no llega `destino`, contesta la PREGUNTA (`pregunta`: cuántos y a dónde pueden ir) sin
 * escribir nada; con destino, los muda SIN MENSAJES y sus clases pasan a un módulo suelto con clave
 * nueva. PRENDERLO crea la etapa en su lugar; `devolver` (el «Deshacer» de haberlo apagado) la devuelve
 * con su misma clave y en su mismo lugar. Devuelve la clave NUEVA del módulo y, al apagar, la etapa
 * quitada (con cuántos clientes se mudaron).
 */
export async function vincularModuloAction(
  productoId: number,
  clave: string,
  vincular: boolean,
  destino?: string | null,
  devolver?: { etapa: EtapaEntrega; indice: number } | null,
): Promise<{ ok: true; clave: string; modulos: ModuloCurso[]; quitada?: EtapaQuitada } | FalloConPregunta> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    if (typeof vincular !== 'boolean') return { ok: false, error: 'No se entiende qué hacer.' };
    const r = await vincularModulo(Number(productoId), String(clave ?? ''), vincular, {
      destino: typeof destino === 'string' ? destino : null,
      devolver: devolver && typeof devolver === 'object' ? devolver : null,
      por: await autorActual(),
    });
    if (r.ok) alKanban();
    return r;
  } catch (e) {
    return fallo(e, vincular ? 'No se pudo vincular.' : 'No se pudo quitar la etapa.');
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

/**
 * «Eliminar módulo» (08/10/2026, item 15): a la PAPELERA, con sus clases. Uno vinculado quita además su
 * etapa del kanban: con clientes adentro y sin `destino`, contesta la PREGUNTA y no escribe nada.
 * Devuelve los ids de las clases que se fueron con él y la etapa quitada: es lo que necesita el
 * «Deshacer» (`restaurarModuloAction`).
 */
export async function borrarModuloAction(
  productoId: number,
  clave: string,
  destino?: string | null,
): Promise<{ ok: true; modulos: ModuloCurso[]; clases: number[]; movidos: number; quitada: EtapaQuitada | null } | FalloConPregunta> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    const r = await borrarModulo(Number(productoId), String(clave ?? ''), { destino: typeof destino === 'string' ? destino : null, por: await autorActual() });
    // Sólo si se quitó una columna: un suelto no cambia el kanban.
    if (r.ok && r.quitada) alKanban();
    return r;
  } catch (e) {
    return fallo(e, 'No se pudo borrar el módulo.');
  }
}

/**
 * Lo que pregunta «Eliminar módulo» ANTES de hacerlo: cuántos clientes hay en su etapa y a dónde pueden
 * ir (las clases las cuenta la pantalla). No escribe nada.
 */
export async function previaQuitarAction(productoId: number, clave: string): Promise<{ ok: true; clientes: number; destinos: Array<{ key: string; label: string }> } | Fallo> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    return await previaDeQuitar(Number(productoId), String(clave ?? ''));
  } catch (e) {
    return fallo(e, 'No pude contar sus clientes.');
  }
}

/**
 * El «Deshacer» de «Eliminar módulo»: el MISMO módulo (y su etapa en su lugar, si no tenía clientes),
 * sus clases de la papelera y el orden de antes. Ver `restaurarModulo` (lib/curso-modulos-datos.ts).
 */
export async function restaurarModuloAction(
  productoId: number,
  r: { clave: string; clases: number[]; orden: string[]; quitada?: { etapa: EtapaEntrega; indice: number } | null },
): Promise<{ ok: true; modulos: ModuloCurso[]; clases: Clase[] } | Fallo> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    const x = await restaurarModulo(Number(productoId), r ?? {});
    if (x.ok && r?.quitada) alKanban();
    return x;
  } catch (e) {
    return fallo(e, 'No se pudo devolver el módulo.');
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
 * El «Deshacer» de borrar una clase (08/10/2026, item 18): la saca de la PAPELERA (mig 0223) con todo
 * lo suyo y la devuelve como quedó. Sin `revalidatePath`, como el resto de este archivo: la pantalla
 * la vuelve a poner con lo que contesta esto.
 */
export async function restaurarClasesAction(productoId: number, ids: number[]): Promise<{ ok: true; clases: Clase[] } | Fallo> {
  try {
    const no = await puertaProducto(productoId);
    if (no) return { ok: false, error: no };
    return await restaurarClases(Number(productoId), ids);
  } catch (e) {
    return fallo(e, 'No se pudo devolver la clase.');
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
 * «Guardar» de la lección (audio del 08/10/2026, item 1: «prefiero que haya un botón que me obligue a
 * guardar de forma manual»): el BORRADOR de la clase de una vez, en UN `update` con compare-and-set
 * (`guardarLeccion`, lib/curso-admin.ts). `cambios` trae SÓLO las partes que cambiaron y `antes` lo que la
 * pantalla tenía de base en cada una: si otra pestaña la cambió, contesta `conflicto` con la clase como
 * está. Si algo está incompleto, `errores` dice qué, por campo (lo que la pantalla pinta en rojo).
 *
 * ⚠️ CON `revalidatePath` DEL CURSO, a diferencia de los gestos de este archivo (revisión final del 08/10/2026).
 *    El ATRÁS del navegador REUSA la página que ya bajó (node_modules/next/dist/docs, glosario «Client Cache»:
 *    «Pages are not cached by default but are reused during browser back/forward navigation»): guardar, ir a
 *    la Vista del alumno y volver con el Atrás redibujaba la clase de ANTES de guardar — la otra mitad del
 *    «vuelvo para atrás, no me aparece la edición» (15:40) — y el próximo «Guardar» chocaba consigo mismo
 *    («Cambió en otra pestaña»). Revalidar limpia esa caché del navegador. Cuesta releer la página en cada
 *    «Guardar», que es UN clic a mano y no un gesto que se repite (el porqué de no revalidar los demás).
 */
export async function guardarLeccionAction(claseId: number, cambios: CambiosLeccion, antes: CambiosLeccion): Promise<ResultadoLeccion> {
  try {
    const no = await puedeEditar();
    if (no) return { ok: false, error: no };
    const r = await guardarLeccion(Number(claseId), cambios, antes);
    if (r.ok) revalidatePath('/customer-success/curso');
    return r;
  } catch (e) {
    return fallo(e, 'No se pudo guardar.');
  }
}

/**
 * Guarda UNA parte de la clase: `{ obligatoria }` (el interruptor del menú «…», inmediato), `{ minutos }`
 * (los que dice solo el reproductor del video guardado) y las demás partes, que la lección ya no manda
 * sueltas desde el audio del 08/10/2026 (van con «Guardar», `guardarLeccionAction`). Un `update` de sólo
 * esas columnas, nunca la fila entera. Devuelve la clase como quedó.
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

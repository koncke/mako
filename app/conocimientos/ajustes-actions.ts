'use server';

// =============================================================================
// Las acciones del SUPER ADMIN sobre un curso de Conocimientos (item 1, D9)
// =============================================================================
// Lo que se cambia con los gestos del curso (un clic en un texto, la portada, arrastrar, ocultar) llega
// acá, se valida contra el CATÁLOGO del server y se guarda en `conocimiento_ajustes` (mig 0221). Cada
// una contesta con las filas del curso COMO QUEDARON: la pantalla las aplica y ésas mandan sobre lo que
// mostró en el acto.
//
// ⚠️ `getSesionAdmin()` EN LA PRIMERA LÍNEA DE CADA UNA, y no sólo «porque la pantalla es de admin».
//    El id de una server action viaja en el bundle y Next la ejecuta por cualquier puerta que la tenga
//    (AGENTS.md, «una página pública sólo se lee»): la pantalla no protege nada. Y la de datos vuelve a
//    preguntar (lib/conocimiento-ajustes-datos.ts). Lo fija tests/conocimiento-ajustes.test.ts.
// ⚠️ LA ACCIÓN RECIBE LA INTENCIÓN, NO LAS FILAS: «llevá la clase 12 antes de la 15». El orden que se
//    escribe se calcula acá desde las filas de la BASE, así dos pestañas no se pisan con un orden viejo.

import { getSesionAdmin } from '@/lib/auth';
import { buscarCurso, VISTA_PROPIA } from './catalogo';
import type { Curso } from './curso';
import {
  aplicarAjustes, esErrorGesto, planLlevarClase, planOrdenModulos, queValido, sanearValor,
  type Cambios, type CursoConAjustes, type QueAjuste, type ResultadoAjuste,
} from '@/lib/conocimiento-ajustes';
import { guardarAjustes, leerAjustes } from '@/lib/conocimiento-ajustes-datos';

const NO_ADMIN = 'Sólo el super admin edita los cursos.';

const mensaje = (e: unknown) => (e instanceof Error && e.message ? e.message : 'No se pudo guardar.');

/**
 * El curso de un slug, como lo ve el super admin HOY (con lo oculto). Por el slug CANÓNICO: los
 * reemplazados (`REEMPLAZADOS` del catálogo) se guardan a nombre del curso que los absorbió, que es el
 * único que se dibuja. Los dos que tienen vista propia (el Análisis y el Branding) no son un curso de
 * clases y no se editan acá.
 */
async function cursoEditable(slug: unknown): Promise<{ ok: true; curso: Curso; cur: CursoConAjustes } | { ok: false; error: string }> {
  const curso = typeof slug === 'string' ? buscarCurso(slug) : undefined;
  if (!curso || curso.slug === VISTA_PROPIA.analisis || curso.slug === VISTA_PROPIA.branding) {
    return { ok: false, error: 'Ese curso no se puede editar.' };
  }
  return { ok: true, curso, cur: aplicarAjustes(curso, await leerAjustes([curso.slug]), { conOcultos: true }) };
}

async function escribirYReleer(slug: string, cambios: Cambios): Promise<ResultadoAjuste> {
  if (cambios.poner.length || cambios.quitar.length) await guardarAjustes(slug, cambios);
  return { ok: true, filas: await leerAjustes([slug]) };
}

/**
 * UN ajuste: el título o la descripción del curso, su color, una portada, el nombre de un módulo, el
 * título de una clase, ocultar o mostrar. `valor` vacío o `null` = volver a lo de la ficha.
 */
export async function guardarAjusteConocimientoAction(slug: string, que: QueAjuste, valor: unknown): Promise<ResultadoAjuste> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    const c = await cursoEditable(slug);
    if (!c.ok) return c;
    const q = queValido(que);
    if (!q) return { ok: false, error: 'Ese cambio no existe.' };
    // El orden y el módulo de una clase se cambian con su gesto (las dos de abajo), que reescribe el
    // orden del módulo entero: suelto, un `orden` dejaría dos clases con el mismo número.
    if (q.campo === 'orden' || (q.objeto === 'clase' && q.campo === 'modulo')) return { ok: false, error: 'Eso se cambia arrastrando.' };
    // Contra el CATÁLOGO, no contra lo que dice la pantalla: un ajuste de un módulo o una clase que no
    // existe sería una fila huérfana desde el día uno.
    if (q.objeto === 'modulo' && !c.cur.modulos.some((m) => m.key === q.objetoId)) return { ok: false, error: 'Ese módulo ya no está. Recarga la página.' };
    if (q.objeto === 'clase' && !c.cur.clases.some((x) => String(x.n) === q.objetoId)) return { ok: false, error: 'Esa clase ya no está. Recarga la página.' };
    const v = sanearValor(q, valor);
    return await escribirYReleer(c.curso.slug, v == null ? { poner: [], quitar: [q] } : { poner: [{ ...q, valor: v }], quitar: [] });
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/** Arrastrar un módulo: la lista ENTERA de keys en el orden nuevo. */
export async function ordenarModulosConocimientoAction(slug: string, keys: string[]): Promise<ResultadoAjuste> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    const c = await cursoEditable(slug);
    if (!c.ok) return c;
    if (!Array.isArray(keys) || !keys.every((k) => typeof k === 'string')) return { ok: false, error: 'Ese orden no es válido.' };
    const plan = planOrdenModulos(c.cur, keys);
    if (esErrorGesto(plan)) return { ok: false, error: plan.error };
    return await escribirYReleer(c.curso.slug, plan);
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

/**
 * Llevar una clase a un módulo (el suyo u otro), antes de `antesDe` (`null` = al final): arrastrarla en
 * su grilla, soltarla sobre otro módulo de la barra, ↑ / ↓ y «Mover a» del menú.
 */
export async function llevarClaseConocimientoAction(slug: string, n: number, destino: string, antesDe: number | null): Promise<ResultadoAjuste> {
  const admin = await getSesionAdmin();
  if (!admin) return { ok: false, error: NO_ADMIN };
  try {
    const c = await cursoEditable(slug);
    if (!c.ok) return c;
    if (!Number.isInteger(n) || typeof destino !== 'string' || (antesDe !== null && !Number.isInteger(antesDe))) {
      return { ok: false, error: 'Ese movimiento no es válido.' };
    }
    const plan = planLlevarClase(c.cur, n, destino, antesDe);
    if (esErrorGesto(plan)) return { ok: false, error: plan.error };
    return await escribirYReleer(c.curso.slug, plan);
  } catch (e) {
    return { ok: false, error: mensaje(e) };
  }
}

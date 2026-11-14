// =============================================================================
// tope-cursos-reglas — cuántos CURSOS puede tener un negocio en Classroom según su plan (14/11/2026, puro)
// =============================================================================
// Martín (14/11/2026): «no pusiste nada de la parte de Classroom… seas más limitado en el de 47». La tabla es
// lib/topes-plan.ts → 'classroom.cursos' (MaKo Esencial, 1; Pro, sin tope). Esto decide si un cambio pasa el tope; lo
// pregunta lib/tope-cursos.ts (con la base) en cada puerta que crea un curso.
//
// ⚠️ QUÉ ES «UN CURSO», Y POR QUÉ NO ES «UN PRODUCTO». No hay una tabla `cursos`: Classroom dibuja un programa por cada
//    producto ofrecido (`productosDeLaEntrega`, app/customer-success/entrega.ts: la misma lista del kanban, del selector y de
//    `listar_cursos` de la API), y TODO producto activo aparece ahí, vacío, aunque nadie lo haya armado: el del CRM, los del
//    catálogo, los que siembra el onboarding. Contar productos sería contar el catálogo del CRM (y frenar «Nuevo producto»
//    del kanban de Clients, que es un servicio que se entrega, no un curso). Por eso un curso es un PROGRAMA CON AL MENOS UNA
//    CLASE VIVA (sin las de la papelera, mig 0223) — lo mismo que vende la tabla de /planes: «Cursos con módulos y clases».
//    Lo que CREA un curso es, entonces:
//      · la PRIMERA clase de un programa que no tenía ninguna (`crearClase`: «+ Clase» de la pantalla y `crear_clase_curso`);
//      · DUPLICAR un programa que tiene clases (la copia nace con ellas, lib/curso-duplicar.ts). Duplicar uno vacío no.
//    Crear módulos o clases en un programa que YA es un curso no se frena nunca.
// ⚠️ NADA SE SACA: quien ya tiene más cursos que el tope los sigue editando (sus programas ya tienen clases). Y los «Deshacer»
//    (restaurar una clase, un módulo o un programa eliminado) no pasan por acá: devuelven lo que la persona ya tenía.
// ⚠️ SÓLO AL ESENCIAL QUE MaKo COBRA (`esEsencialDe`, lib/plan-esencial.ts): es lo mismo que `aplicanTopes` con un tope que
//    sólo tiene Esencial, y no mete lib/cobros (que alcanza una IA) en el grafo de las acciones del curso. Ante la duda, pasa.
// =============================================================================

import { cabeOtra, textoTope, topeDe } from './topes-plan';

/** Cómo nace un curso: la primera clase de un programa, o la copia de uno que tiene clases. */
export type ComoNaceUnCurso = 'clase' | 'duplicar';

export type TopeCursoNuevo = { ok: true } | { ok: false; tope: number; texto: string };

/**
 * ¿Este cambio crea un curso? Una clase más en un curso que ya existe no crea otro; la copia de un programa vacío nace
 * vacía. `programaConClases`: el programa sobre el que se hace (al que se le suma la clase, o el que se duplica).
 */
export const creaUnCurso = (como: ComoNaceUnCurso, programaConClases: boolean): boolean =>
  como === 'clase' ? !programaConClases : programaConClases;

/**
 * ¿Pasa? `otrosCursos`: los OTROS programas ofrecidos del negocio que ya tienen clases (sin el de `programaConClases`).
 */
export function topeParaCursoNuevo(p: { esencial: boolean; como: ComoNaceUnCurso; programaConClases: boolean; otrosCursos: number }): TopeCursoNuevo {
  if (!p.esencial || !creaUnCurso(p.como, p.programaConClases)) return { ok: true };
  // Al duplicar, el original también es un curso de los que tiene.
  const cursos = p.otrosCursos + (p.como === 'duplicar' ? 1 : 0);
  if (cabeOtra('completo', 'classroom.cursos', cursos)) return { ok: true };
  const tope = topeDe('completo', 'classroom.cursos') ?? 0;
  return { ok: false, tope, texto: textoTope(tope) };
}

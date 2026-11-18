// =============================================================================
// knowledge-siembra/plan — qué hace la siembra con lo que YA hay en la base (18/11/2026)
// =============================================================================
// La siembra (scripts/sembrar-knowledge.mts) corre más de una vez: cuando se agrega una ficha, cuando se corrige una. Lo que
// decide qué se crea, qué se saltea y qué se reescribe vive acá, puro, para que tenga test:
//   · la clave es el CURSO del módulo + el TÍTULO, comparado sin tildes ni mayúsculas (una tilde no duplica una ficha);
//   · lo igual se saltea; lo distinto se INFORMA y sólo se reescribe con `actualizar` (el cuerpo de la base puede haberlo
//     corregido una persona desde Classroom › Methodology);
//   · una fila con esa clave que no es `fuente: 'mako'` (la cargó alguien a mano) no se toca NI se duplica: se informa.
// =============================================================================

import { moduloDeKey } from '../knowledge-modulos';
import { AUTOR_KNOWLEDGE, cursoDeModulo, type FichaKnowledge } from './tipos';

/** Lo que se inserta en `mako_knowledge` por una ficha (sin `de`: eso es para auditar, no viaja). */
export type FilaKnowledge = {
  titulo: string; categoria: string; cuerpo: string; curso: string; autor: string; area: string; fuente: 'mako'; activo: true;
};

/** Lo que la siembra lee de la base para decidir. */
export type FilaExistente = { id: number; curso: string | null; titulo: string; cuerpo: string; area: string; fuente: string; activo: boolean };

export type PlanSiembra = {
  crear: FilaKnowledge[];
  actualizar: Array<{ id: number; fila: FilaKnowledge }>;
  /** Distintas de lo que hay en el repo (se reescriben sólo con `actualizar`). */
  distintas: Array<{ id: number; titulo: string }>;
  /** Con la misma clave pero no son de la siembra (fuente ≠ 'mako'): no se tocan. */
  ajenas: Array<{ id: number; titulo: string; fuente: string }>;
  iguales: number;
};

const norm = (t: string): string => t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
const clave = (curso: string | null, titulo: string): string => `${norm(curso ?? '')}|${norm(titulo)}`;

/** La fila de una ficha. Tira si el módulo no existe: una ficha sin área no se puede sembrar. */
export function filaDeFicha(f: FichaKnowledge): FilaKnowledge {
  const m = moduloDeKey(f.modulo);
  if (!m) throw new Error(`La ficha «${f.titulo}» dice ser del módulo «${f.modulo}», que no existe en lib/knowledge-modulos.ts`);
  return {
    titulo: f.titulo.trim(), categoria: f.categoria.trim(), cuerpo: f.cuerpo.trim(),
    curso: cursoDeModulo(m.nombre), autor: AUTOR_KNOWLEDGE, area: m.area, fuente: 'mako', activo: true,
  };
}

export function planDeSiembra(existentes: readonly FilaExistente[], fichas: readonly FichaKnowledge[], opts: { actualizar: boolean }): PlanSiembra {
  const porClave = new Map<string, FilaExistente>();
  for (const e of existentes) if (!porClave.has(clave(e.curso, e.titulo))) porClave.set(clave(e.curso, e.titulo), e);
  const plan: PlanSiembra = { crear: [], actualizar: [], distintas: [], ajenas: [], iguales: 0 };
  for (const f of fichas) {
    const fila = filaDeFicha(f);
    const ya = porClave.get(clave(fila.curso, fila.titulo));
    if (!ya) { plan.crear.push(fila); continue; }
    if (ya.fuente !== 'mako') { plan.ajenas.push({ id: ya.id, titulo: ya.titulo, fuente: ya.fuente }); continue; }
    const igual = ya.cuerpo.trim() === fila.cuerpo && ya.area === fila.area;
    if (igual) { plan.iguales++; continue; }
    plan.distintas.push({ id: ya.id, titulo: ya.titulo });
    if (opts.actualizar) plan.actualizar.push({ id: ya.id, fila });
  }
  return plan;
}

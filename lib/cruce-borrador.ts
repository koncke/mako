// =============================================================================
// cruce-borrador — la regla PURA de cómo el cruce anti-duplicados marca un borrador
// =============================================================================
// 16/10/2026, «Fathom sin fricción». El cruce con IA de las tareas de una reunión contra el tablero
// («¿esto ya está en tu plan?») corría en el NAVEGADOR al abrir el modal de tareas recibidas, y el
// modal no dejaba cargar mientras tanto: «Cruzando con tu plan…» y el botón apagado, entre 20 y 40
// segundos. Martín, textual: «Que hoy en día tardan un montón porque "cruzan" con las otras tareas...
// Quiero que elimines eso y toda la fricción».
//
// Ahora corre del lado del server, ANTES de que nadie mire: en el cron, apenas se crea el borrador
// (lib/reunion-auto.ts), y en la lectura en segundo plano de una reunión o un archivo. Lo que
// encuentra queda escrito en cada tarea (`enriquece`) y el borrador se SELLA (`cruzado_at`): el
// modal sólo lo dibuja. Si el cruce no llegó, el modal carga igual — `aplicarPropuestas` tiene su
// propio anti-duplicado (`mismaTarea`), que no cuesta nada.
//
// Este módulo es la mitad que no habla con nadie: qué tareas entran al cruce y cómo se escribe lo
// que devolvió. Es la MISMA regla que tenía el modal (TareasRecibidasModal, hasta el 16/10), escrita
// una vez para el server y con test.
// =============================================================================

import type { PropuestaTarea } from './plan-propuesta';

/** Lo que se le muestra al modelo como «el plan»: el tablero y las tareas de los OTROS borradores. */
export type ItemUniverso = { id: string; titulo: string; detalle?: string };
/** Lo que devuelve `cruzarCandidatas` (lib/mako-guardian.ts), con su índice sobre las candidatas. */
export type CruceDevuelto = { i: number; idExistente: string | null; razon: string; confianza: 'alta' | 'media' };

/** El prefijo de los ids sintéticos: una tarea de OTRO borrador no es una tarjeta del tablero. */
export const PREFIJO_BORRADOR = 'borrador:';

const normTit = (t: string): string =>
  (t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Las tareas que entran al cruce: las TUYAS que todavía no tienen marca. Las de otra persona no
 * (no entran a tu plan, no hay con qué duplicarlas) y las que ya tienen `enriquece` tampoco: ahí
 * ya habló el cruce o el dueño, y un cruce nuevo pisaría lo que él decidió.
 */
export function candidatasDelCruce(tareas: PropuestaTarea[]): PropuestaTarea[] {
  return tareas.filter((t) => !t.esDeOtro && !t.enriquece);
}

/**
 * Escribe lo que encontró el cruce sobre las tareas FRESCAS del borrador (se releen justo antes de
 * guardar: entre que se leyó y que el modelo contestó, alguien pudo haber corregido la revisión).
 * Se casa por TÍTULO normalizado, no por índice. Sólo marca tareas sin marca y propias.
 *
 * ⚠️ SÓLO LA CONFIANZA ALTA DESTILDA. Un falso positivo destildado esconde un pedido real de una
 * reunión («Contratar el plan de $100…» marcada como «Reglas de presupuesto…» porque las dos
 * «hablan de presupuesto»): con confianza media se avisa y queda tildada, y decide la persona.
 */
export function aplicarCruces(
  frescas: PropuestaTarea[],
  candidatas: Array<{ titulo: string }>,
  cruces: CruceDevuelto[],
  universo: ItemUniverso[],
): { tareas: PropuestaTarea[]; marcadas: number } {
  const porTitulo = new Map<string, NonNullable<PropuestaTarea['enriquece']>>();
  for (const c of cruces) {
    const cand = candidatas[c.i];
    const ya = universo.find((u) => u.id === c.idExistente);
    if (!cand || !ya) continue;
    const enBorrador = ya.id.startsWith(PREFIJO_BORRADOR);
    porTitulo.set(normTit(cand.titulo), {
      id: enBorrador ? '' : ya.id,
      razon: `${enBorrador ? 'la misma reunión ya la trae como' : 'ya está en tu plan como'} «${ya.titulo}»${c.razon ? ` — ${c.razon}` : ''}`.slice(0, 400),
      confianza: c.confianza === 'alta' ? 'alta' : 'media',
    });
  }
  let marcadas = 0;
  const tareas = frescas.map((t) => {
    if (t.esDeOtro || t.enriquece) return t;
    const hit = porTitulo.get(normTit(t.titulo));
    if (!hit) return t;
    marcadas += 1;
    return { ...t, enriquece: hit, ...(hit.confianza === 'alta' ? { incluir: false as const } : {}) };
  });
  return { tareas, marcadas };
}

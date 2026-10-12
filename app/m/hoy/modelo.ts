// =============================================================================
// /m/hoy — lo PURO de Today v2: qué tareas van en «Para hoy», el título de lo que
// bloquea y la fila del trimestre
// =============================================================================
// Sin `server-only` ni 'use client': lo usan la página (server) y tests/m-hoy.test.ts. Las
// LECTURAS siguen en lib/hoy-movil.ts (`componerHoy`); aquí no se define ninguna regla nueva:
// «hoy» es `listaHoy` de /m/plan, la suma de lo que bloquea es `sumaDe` + `TIPOS_QUE_BLOQUEAN`,
// y el ritmo es el `Ritmo` que ya calculó `leerVistaGeneral` para /general.
//
// ⚠️ «PARA HOY» SON LAS PRIMERAS DE LA PESTAÑA «HOY» DE /m/plan, NO UNA SEGUNDA CUENTA. Qué
// es «hoy» (las prioridades que vencen hoy + `PlanHoy.hoy`, que viene SIN ellas) y cómo se
// dice el plazo viven en app/m/plan/formato.ts (`listaHoy`, `plazoCorto`, `colorProyecto`):
// el prototipo dibuja las dos listas con el mismo dato (`data-plan="hoy"`), y dos cuentas
// harían que la misma tarea diga una cosa en Today y otra en Plan. Lo ÚNICO propio de Today
// es el relleno: si a «Hoy» le faltan filas, se completan con las prioridades, para que un
// plan sin fechas (casi todos los clientes) no deje la sección vacía.
// =============================================================================

import { sumaDe, TIPOS_QUE_BLOQUEAN } from '@/lib/hoy-movil-modelo';
import { METRICA_LABEL, type Objective, type Ritmo, type UnidadObjetivo } from '@/lib/objectives-modelo';
import { fmtNum, fmtUSD } from '@/lib/format';
import { listaHoy } from '@/app/m/plan/formato';
import type { TipoDecision } from '@/lib/inbox-movil-reglas';
import type { ItemPlan } from '@/app/plan/board/hoy';

/** Cuántas tareas entran en «Para hoy» (el prototipo: las 3 primeras). El resto, en /m/plan. */
export const TOPE_PARA_HOY = 3;

/** Cuántos leads por decidir ve el closer/setter en Today. */
export const TOPE_LEADS_HOY = 3;

// ─────────────────────────────────────────────────────────────────────────────
// Para hoy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Las primeras `tope` tareas para hoy: las de la pestaña «Hoy» de /m/plan (`listaHoy`, la MISMA
 * cuenta y el mismo orden) y, si no llegan al tope, las prioridades que faltan, sin repetir.
 */
export function paraHoy(p: { prioridades: readonly ItemPlan[]; hoy: readonly ItemPlan[] }, tope = TOPE_PARA_HOY): ItemPlan[] {
  const out: ItemPlan[] = [];
  const vistos = new Set<string>();
  for (const i of [...listaHoy(p.prioridades, p.hoy), ...p.prioridades]) {
    if (out.length >= tope) break;
    if (vistos.has(i.id)) continue;
    vistos.add(i.id);
    out.push(i);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lo que bloquea (UNA tarjeta)
// ─────────────────────────────────────────────────────────────────────────────

/** Cómo se dice cada bandeja que bloquea, en singular y plural. */
const NOMBRE_BLOQUEO: Partial<Record<TipoDecision, readonly [string, string]>> = {
  pendiente: ['acción por confirmar', 'acciones por confirmar'],
  accion: ['acción para revisar', 'acciones para revisar'],
  confirmacion: ['cambio del CRM', 'cambios del CRM'],
};

const contar = (n: number, [uno, varios]: readonly [string, string]) => `${n} ${n === 1 ? uno : varios}`;

/**
 * La tarjeta de lo que bloquea, o null si no hay nada (o si una bandeja no se pudo leer:
 * `sumaDe` da null y no se inventa un número). Una sola bandeja: su nombre es el título.
 * Varias: el total es el título y el desglose va debajo.
 */
export function bloqueoDeHoy(porTipo: Partial<Record<TipoDecision, number | null>>): { titulo: string; consecuencia: string } | null {
  const n = sumaDe(porTipo, TIPOS_QUE_BLOQUEAN);
  if (n == null || n <= 0) return null;
  const partes: string[] = [];
  for (const t of TIPOS_QUE_BLOQUEAN) {
    const v = porTipo[t];
    const nombre = NOMBRE_BLOQUEO[t];
    if (v != null && v > 0 && nombre) partes.push(contar(v, nombre));
  }
  if (partes.length === 1) return { titulo: partes[0], consecuencia: 'Nada se aplica hasta que decidas.' };
  return { titulo: `${n} decisiones pendientes`, consecuencia: partes.join(' · ') };
}

// ─────────────────────────────────────────────────────────────────────────────
// El trimestre en una fila
// ─────────────────────────────────────────────────────────────────────────────

export type FilaTrimestre = {
  /** El título de la sección: «Trimestre», o «Año» si el objetivo que manda es anual. */
  titulo: string;
  /** «Cobrado · Q4». */
  rotulo: string;
  /** «$6,000», o «—» si no se pudo leer. */
  valor: string;
  /** «Meta $45,000» o «Sin meta». */
  meta: string;
  /** null = sin meta o sin lectura: no se dibuja una barra que mentiría. */
  barra: { avance: number; tiempo: number; atrasado: boolean } | null;
  /** «$620 arriba» / «$300 abajo» / «Meta superada». null = no se puede opinar todavía. */
  ritmo: { texto: string; sube: boolean } | null;
  /** «No se pudo leer» cuando el avance no se leyó. */
  nota: string | null;
};

const fmtValor = (n: number | null, unidad: UnidadObjetivo): string => (unidad === 'usd' ? fmtUSD(n) : fmtNum(n));
const entre01 = (x: number) => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));

/**
 * La fila del trimestre con lo que `leerVistaGeneral` ya calculó para /general.
 *
 * ⚠️ #165: sin fuentes de datos (`sinFuentes`) NO se dice «arriba» ni «abajo», igual que el
 * escritorio apaga el «vas al día». Y un avance sin leer es «—», nunca un cero.
 */
export function filaTrimestre(v: {
  /** El `objetivoPrincipal` de `VistaGeneral` (un `ObjectiveConAvance`). */
  objetivoPrincipal: (Pick<Objective, 'quarter' | 'anio' | 'metrica' | 'unidad' | 'metaValor'> & { actual: number | null; ritmo: Ritmo | null }) | null;
  fraccionObjetivo: number;
  objetivoAtrasado: boolean;
  sinFuentes: boolean;
}): FilaTrimestre | null {
  const o = v.objetivoPrincipal;
  if (!o) return null;
  const anual = o.quarter === null;
  const leido = o.actual !== null && Number.isFinite(o.actual);
  const conMeta = Number.isFinite(o.metaValor) && o.metaValor > 0;
  const actual = leido ? (o.actual as number) : 0;

  let ritmo: FilaTrimestre['ritmo'] = null;
  if (leido && conMeta && !v.sinFuentes) {
    if (actual >= o.metaValor) ritmo = { texto: 'Meta superada', sube: true };
    else if (o.ritmo && o.ritmo.desvioPct !== null && Number.isFinite(o.ritmo.desvio)) {
      const desvio = Math.abs(o.ritmo.desvio);
      ritmo = Math.round(desvio) === 0
        ? { texto: 'Al día', sube: true }
        : { texto: `${fmtValor(desvio, o.unidad)} ${o.ritmo.alDia ? 'arriba' : 'abajo'}`, sube: o.ritmo.alDia };
    }
  }

  return {
    titulo: anual ? 'Año' : 'Trimestre',
    rotulo: `${METRICA_LABEL[o.metrica]} · ${anual ? o.anio : `Q${o.quarter}`}`,
    valor: leido ? fmtValor(actual, o.unidad) : '—',
    meta: conMeta ? `Meta ${fmtValor(o.metaValor, o.unidad)}` : 'Sin meta',
    barra: leido && conMeta
      ? { avance: entre01(actual / o.metaValor), tiempo: entre01(v.fraccionObjetivo), atrasado: v.objetivoAtrasado }
      : null,
    ritmo,
    nota: leido ? null : 'No se pudo leer',
  };
}

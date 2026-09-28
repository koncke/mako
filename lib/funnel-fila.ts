// =============================================================================
// funnel-fila — de una fila de `funnels` al objeto que consume la app (PURO)
// =============================================================================
// Vive aparte de `lib/funnels.ts` y SIN `server-only` a propósito: lo que se
// decide acá —sobre todo de dónde sale `origen`— es la regla que ningún test
// podría importar si viviera al lado de las queries. Mismo criterio que
// `exigirClienteDePrueba` (AGENTS.md § «Un guard sobre algo destructivo…»).
// =============================================================================

import type { Stage, FunnelTransition, EntradaId, EventoFunnel } from './pipeline';
import {
  sanearLabels, DEFAULT_PIPELINE, generateFunnel, parseEntradas, parseEvento, sanearPipeline } from './pipeline';

export type { EventoFunnel };

/** Nombre del funnel que la migración 0170 le dio a todos los workspaces. */
export const FUNNEL_DEFAULT_NOMBRE = 'Funnel principal';

// Lo que se PERSISTE es el pipeline (Activo) + las nutriciones suprimidas + cómo
// ENTRA el lead; el funnel completo (stages + transitions) se DERIVA con
// generateFunnel.
export type FunnelConfig = {
  /** null = no hay fila (o no se pudo leer). Con id, es el funnel de verdad. */
  id: number | null;
  nombre: string;
  /** BOFU: dónde se cierra. null = hereda el canal del negocio. */
  canal: string | null;
  stages: Stage[];
  transitions: FunnelTransition[];
  pipeline: Stage[];
  suppressed: string[];
  /**
   * Los nombres propios de las etapas DERIVADAS (las tres terminales que no viven en el
   * pipeline). Las del pipeline guardan su label ahí mismo.
   */
  labels: Record<string, string>;
  /** Cómo entra un lead. `[]` es NO DECLARADO y nunca afirma nada. */
  entradas: EntradaId[];
  /** El evento de fecha fija, si el canal tiene uno (el taller de todos los miércoles). */
  evento: EventoFunnel | null;
  /**
   * De dónde salió esto. Existe para que la PANTALLA pueda decir la verdad y para
   * que el PROMPT no afirme nada que no se declaró: con `origen !== 'declarado'`,
   * `entradas` viene vacío aunque el pipeline caiga al default.
   */
  origen: 'declarado' | 'sin-fila' | 'error';
};

export type FunnelResumen = {
  id: number;
  nombre: string;
  canal: string | null;
  esDefault: boolean;
  declarado: boolean;
  /**
   * El PRODUCTO que vende este funnel, que es como lo llama el negocio.
   *
   * ⚠️ El desplegable del tablero mostraba el nombre del FUNNEL —«Funnel
   * principal» para todo el mundo, porque lo pone la migración— y eso no es un
   * nombre: es el nombre de la estructura, no el de lo que vende. Quien mira el
   * CRM piensa en su producto. Sale de `v_funnel_productos`; null cuando el
   * funnel todavía no tiene producto asociado, y ahí se cae al nombre del funnel.
   */
  producto: string | null;
};

export type FilaFunnel = {
  id: number;
  nombre: string | null;
  canal: string | null;
  data: unknown;
  declarado: boolean | null;
  es_default?: boolean | null;
};

export const COLS = 'id, nombre, canal, data, declarado, es_default';

export function buildFunnel(
  pipeline: Stage[],
  suppressed: string[],
  extra?: {
    id?: number | null; nombre?: string; canal?: string | null;
    entradas?: EntradaId[]; evento?: EventoFunnel | null; origen?: FunnelConfig['origen'];
    labels?: Record<string, string>;
  },
): FunnelConfig {
  const labels = extra?.labels ?? {};
  const { stages, transitions } = generateFunnel(pipeline, suppressed, labels);
  return {
    id: extra?.id ?? null,
    nombre: extra?.nombre ?? FUNNEL_DEFAULT_NOMBRE,
    canal: extra?.canal ?? null,
    stages, transitions, pipeline, suppressed, labels,
    entradas: extra?.entradas ?? [],
    evento: extra?.evento ?? null,
    origen: extra?.origen ?? 'sin-fila',
  };
}

/**
 * De una fila de `funnels` al objeto que consume la app.
 *
 * ⚠️ EL `origen` SALE DE LA COLUMNA `declarado`, NUNCA DE LA FORMA DE `data`.
 * La 0170 le da fila a los 3 workspaces que no tenían ninguna (ws 3, 5 y 9) con
 * `data = '{}'::jsonb`, y `{}` en JavaScript es TRUTHY: un lector traducido
 * literal del viejo `if (!data.data) → 'sin-fila'` los leería como «declarado» y
 * esos tres pasarían de «no declaró nada» a «declaró el funnel genérico», sin
 * error y sin log. Hay tres lectores de `origen` en producción
 * (lib/objectives.ts, lib/venta-por-llamada.ts, lib/acento-workspace.ts) y el
 * contrato que se rompería es el de «ningún prompt afirma un funnel que nadie
 * declaró». «Sin fila» no es «vacío» — ya escrito en docs/hallazgos-crm.md.
 */
export function filaAFunnel(f: FilaFunnel): FunnelConfig {
  const cfg = (f.data && typeof f.data === 'object' ? f.data : {}) as Record<string, unknown>;
  const declarado = f.declarado === true;
  const pipeline = sanearPipeline(cfg.pipeline) ?? DEFAULT_PIPELINE;
  const suppressed = Array.isArray(cfg.suppressed) ? cfg.suppressed.filter((s): s is string => typeof s === 'string') : [];
  return buildFunnel(pipeline, suppressed, {
    id: f.id,
    nombre: f.nombre ?? FUNNEL_DEFAULT_NOMBRE,
    canal: f.canal ?? null,
    // Lo declarado solo se emite si ESTÁ declarado: con `declarado=false` el
    // pipeline igual cae al default (una pantalla en blanco es peor), pero
    // `entradas` queda vacío y eso es lo que impide que un prompt afirme «dejó
    // sus datos en el anuncio» sobre un cliente que nunca declaró nada.
    // ⚠️ Los nombres NO cuelgan de `declarado`, a diferencia de `entradas` y `evento`.
    // Un nombre propio no AFIRMA nada del negocio —no dice por dónde entra la gente— y
    // esconderlo dejaría al cliente viendo «Perdido» después de haberlo renombrado.
    labels: sanearLabels(cfg.labels),
    entradas: declarado ? parseEntradas(cfg.entradas) : [],
    evento: declarado ? parseEvento(cfg.evento) : null,
    origen: declarado ? 'declarado' : 'sin-fila',
  });
}

/**
 * El funnel DEL NEGOCIO (el `es_default` del workspace).
 *
 * El `.order('es_default', desc)` en vez de `.eq('es_default', true)` es a
 * propósito: el índice único parcial garantiza que no haya DOS defaults, no que
 * haya UNO. Si un borrado dejó al workspace sin default, es mejor devolver su
 * otro funnel que devolverle el pipeline genérico del código.
 */

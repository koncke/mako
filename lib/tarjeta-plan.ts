// =============================================================================
// tarjeta-plan — lo PURO de la tarjeta de una tarea del Plan personalizable (21/10/2026)
// =============================================================================
// Martín, 21/10/2026: «poder ver TEMPLATES de estilos de tarjeta, no solo info, sino que otros estilos también… y puedes
// crear otras más… piensa en varios diseños» y «la personalización de las tarjetas en clientes, plan, etc.». El molde
// es el del CRM (lib/tarjeta-kanban.ts → PLANTILLAS_TARJETA_LEAD): UNA plantilla = una FORMA + los DATOS que lleva, en
// su orden; lo genérico (cuál está puesta, las propias) vive en lib/plantillas-tarjeta.ts.
//
// Qué sabe mostrar la tarjeta de una tarea (`CardTile`, app/plan/board/BoardShell.tsx):
//   · proyecto — el chip del proyecto (o su emoji, si no tiene);
//   · plazo    — la fecha límite, o el ritmo si se repite;
//   · bloqueo  — el candado de lo que la frena (dependencias);
//   · motivo   — por qué está atorada, en una línea debajo del título.
// El TÍTULO va siempre, y el check gris de completar y el tacho NO son datos: son acciones, quedan siempre.
// El ORDEN es el de la persona: acomoda el renglón de abajo (proyecto, plazo y candado); el motivo va siempre debajo del
// título, que es donde se lee.
//
// Se guarda POR PERSONA (`usuarios.perfil.planTarjeta`, lib/perfil.ts), como la del CRM: es cómo mira cada uno.
// Sin `server-only` ni `'use client'`: lo importan el tablero, el perfil, la API de MaKo y los tests.
// =============================================================================

import { plantillasPropiasDe, type PlantillaTarjeta } from './plantillas-tarjeta';

export const CAMPOS_TARJETA_PLAN = ['proyecto', 'plazo', 'bloqueo', 'motivo'] as const;
export type CampoTarjetaPlan = (typeof CAMPOS_TARJETA_PLAN)[number];
export const NOMBRE_CAMPO_TARJETA_PLAN: Readonly<Record<CampoTarjetaPlan, string>> = {
  proyecto: 'Proyecto', plazo: 'Fecha límite o repetición', bloqueo: 'Lo que la frena', motivo: 'Por qué está atorada',
};
/** Lo de siempre: la tarjeta del 18/10 (la familia de tarjetas), con todo. */
export const CAMPOS_TARJETA_PLAN_DEFAULT: readonly CampoTarjetaPlan[] = ['proyecto', 'plazo', 'bloqueo', 'motivo'];

/**
 * LAS FORMAS (cómo se DIBUJA; los datos van aparte):
 *   · completa: la de la familia, con el título en dos líneas;
 *   · compacta: el título en una línea y menos aire, para ver más tareas por columna;
 *   · color: una banda arriba con el color del primer proyecto, como la portada de la tarjeta de un cliente.
 */
export const FORMAS_TARJETA_PLAN = ['completa', 'compacta', 'color'] as const;
export type FormaTarjetaPlan = (typeof FORMAS_TARJETA_PLAN)[number];
export const NOMBRE_FORMA_TARJETA_PLAN: Readonly<Record<FormaTarjetaPlan, string>> = {
  completa: 'Completa', compacta: 'Compacta', color: 'Color del proyecto',
};
export const DETALLE_FORMA_TARJETA_PLAN: Readonly<Record<FormaTarjetaPlan, string>> = {
  completa: 'La de siempre.', compacta: 'Más tareas por columna.', color: 'Una banda arriba con el color de su proyecto.',
};

export type PlantillaTarjetaPlan = PlantillaTarjeta<FormaTarjetaPlan, CampoTarjetaPlan>;
export type PrefsTarjetaPlan = { forma: FormaTarjetaPlan; campos: CampoTarjetaPlan[]; plantillas: PlantillaTarjetaPlan[] };

/**
 * Lo guardado, limpio y EN EL ORDEN DE LA PERSONA: sin lo desconocido ni repetidos. Sin nada guardado (o algo que no
 * es una lista): lo de siempre. Una lista vacía es una elección (sólo el título).
 */
export function camposTarjetaPlanDe(raw: unknown): CampoTarjetaPlan[] {
  if (!Array.isArray(raw)) return [...CAMPOS_TARJETA_PLAN_DEFAULT];
  const vistos = new Set<string>();
  const out: CampoTarjetaPlan[] = [];
  for (const x of raw) {
    if (typeof x !== 'string' || vistos.has(x) || !(CAMPOS_TARJETA_PLAN as readonly string[]).includes(x)) continue;
    vistos.add(x);
    out.push(x as CampoTarjetaPlan);
  }
  return out;
}

/**
 * LAS PLANTILLAS DE FÁBRICA del Plan (21/10/2026). La primera es la de siempre. Cada una contesta una pregunta de quien
 * mira el tablero: ¿qué es y de qué proyecto? (Completa), ¿cuántas hay? (Compacta, Sólo el título), ¿cuándo vence?
 * (Sólo la fecha), ¿de qué proyecto, de un vistazo? (Color del proyecto; y Color sin chip, que no lo dice dos veces).
 * Sin proyecto es lo mismo sin el chip, para un tablero de un solo proyecto.
 */
export const PLANTILLAS_TARJETA_PLAN: readonly PlantillaTarjetaPlan[] = [
  { id: 'fabrica:completa', nombre: 'Completa', forma: 'completa', campos: CAMPOS_TARJETA_PLAN_DEFAULT },
  { id: 'fabrica:compacta', nombre: 'Compacta', forma: 'compacta', campos: ['proyecto', 'plazo'] },
  { id: 'fabrica:sin-proyecto', nombre: 'Sin proyecto', forma: 'completa', campos: ['plazo', 'bloqueo', 'motivo'] },
  { id: 'fabrica:color', nombre: 'Color del proyecto', forma: 'color', campos: CAMPOS_TARJETA_PLAN_DEFAULT },
  { id: 'fabrica:color-sin-chip', nombre: 'Color sin chip', forma: 'color', campos: ['plazo', 'bloqueo', 'motivo'] },
  { id: 'fabrica:fecha', nombre: 'Sólo la fecha', forma: 'compacta', campos: ['plazo'] },
  { id: 'fabrica:titulo', nombre: 'Sólo el título', forma: 'compacta', campos: [] },
];

/** Lo guardado en el perfil (`{ forma, campos, plantillas }`), limpio. Lo que no se entiende, lo de siempre. */
export function prefsTarjetaPlanDe(raw: unknown): PrefsTarjetaPlan {
  if (Array.isArray(raw)) return { forma: 'completa', campos: camposTarjetaPlanDe(raw), plantillas: [] };
  if (raw && typeof raw === 'object') {
    const o = raw as { forma?: unknown; campos?: unknown; plantillas?: unknown };
    const forma = (FORMAS_TARJETA_PLAN as readonly unknown[]).includes(o.forma) ? (o.forma as FormaTarjetaPlan) : 'completa';
    // Las propias, limpias con la MISMA regla que la tarjeta de todos los días.
    return { forma, campos: camposTarjetaPlanDe(o.campos), plantillas: plantillasPropiasDe(o.plantillas, FORMAS_TARJETA_PLAN, camposTarjetaPlanDe) };
  }
  return { forma: 'completa', campos: [...CAMPOS_TARJETA_PLAN_DEFAULT], plantillas: [] };
}

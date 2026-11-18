// =============================================================================
// periodo-de-la-hoja — qué período mira un bloque de General cuando la HOJA elige uno
// =============================================================================
// Pendiente O10 (3) de docs/pendientes-verificados-17-11.md: «que los bloques de General acepten el período y los
// filtros». El funnel ya llegaba (./funnels-de-la-hoja.ts, 18/11/2026); el PERÍODO de la hoja (su control «Período» de
// arriba, con lo que se eligió mirando) movía los gráficos y ningún bloque.
//
// QUÉ BLOQUE SIGUE EL PERÍODO, Y POR QUÉ LOS DEMÁS NO (como en Looker: lo que tiene una fecha):
//   · «El mes» SÍ: es un resumen de un período (lo gastado, las agendas, los cierres y lo cobrado, contra el anterior).
//     Con la hoja en «Últimos 30 días» decía igual el mes a la fecha, al lado de gráficos que decían otra cosa.
//   · «A quién cobrarle» NO: es la lista OPERATIVA de todo lo pendiente (reunión con Mauricio del 12/10/2026: «el cobranza
//     yo lo veo más operativo»; lo fija tests/general-cobranza.test.ts). Cortarla por el período escondería las cuotas
//     vencidas de antes de su primer día: el «nadie te debe» que no es cierto.
//   · «Tu funnel hoy», el Plan, Mi día, las llamadas, las publicaciones, el semáforo y los pendientes NO: dicen lo de AHORA
//     y su tiempo es parte de lo que dicen.
//   · La meta, los OKRs y los KPIs NO: son del trimestre (o del año) y de su cadencia.
// Sin control de período en la hoja, «El mes» sigue siendo el mes a la fecha (lo de siempre, también en el teléfono).
//
// LA REGLA DEL RANGO ES LA DE UN GRÁFICO DE LA MISMA HOJA (lib/graficos-datos.ts): el período se corta en HOY (el del
// negocio, `hastaHoy`) y se compara con el período anterior del MISMO largo (`periodoAnterior`), como un número con
// «comparar». Así «El mes» y los números de arriba de la hoja cuentan lo mismo contra lo mismo. «Todo» no se compara: el
// período anterior a 2020 no existe.
//
// Puro (sin React ni base): lo usan app/dashboard/ElementoGeneral.tsx (qué período mira el bloque), app/general/
// mes-del-periodo.ts (qué se lee) y tests/general-periodo-de-la-hoja.test.ts.
// =============================================================================

import { conVista, esElemento, nombrePreset, rangoDe, type Hoja, type Preset, type VistaValores } from '@/lib/graficos-catalogo';
import { periodoAnterior } from '@/lib/graficos-agregar';
import { DESDE_TODO, hastaHoy } from '@/lib/datos-comercial';
import { esFechaValida } from '@/lib/date-utils';

/** El período que la hoja eligió, ya resuelto a fechas (con el «hoy» del editor, el mismo que el de sus gráficos). */
export type PeriodoDeBloques = { desde: string; hasta: string; preset: Preset };

/** Lo que lee «El mes» para un período: hasta hoy, y contra qué se compara (null = no se compara: «Todo»). */
export type RangoDelResumen = {
  actual: { desde: string; hasta: string };
  anterior: { desde: string; hasta: string } | null;
  /** Lo que dice el bloque al lado de su título («vs. 19/10 – 31/10»). Vacío = no se compara. */
  etiqueta: string;
};

/**
 * El período del control «Período» de la HOJA, con lo que se eligió mirando (`conVista`: un control fijo vale lo guardado),
 * o null si la hoja no tiene ese control: entonces cada bloque mira su tiempo de siempre.
 */
export function periodoDeLosBloques(hoja: Pick<Hoja, 'controles'> | null | undefined, vista: VistaValores | null | undefined, hoy: string): PeriodoDeBloques | null {
  const c = (hoja?.controles ?? []).map((k) => conVista(k, vista ?? {})).find((k) => k.tipo === 'periodo');
  if (!c || !esFechaValida(hoy)) return null;
  const r = rangoDe(c.preset, hoy, c.desde, c.hasta);
  return { desde: r.desde, hasta: r.hasta, preset: c.preset };
}

/** Los bloques que siguen el período de la hoja (los demás dicen lo de ahora o lo del trimestre: ver arriba). */
export const PIEZAS_CON_PERIODO: readonly string[] = ['mes'];

/** ¿La hoja tiene un bloque que sigue su período? Sólo entonces la página lo lee de entrada (./datos.ts). */
export const hojaLeePeriodo = (hoja: Pick<Hoja, 'componentes'>): boolean =>
  hoja.componentes.some((c) => esElemento(c) && c.tipo === 'general' && !!c.general && PIEZAS_CON_PERIODO.includes(c.general.pieza));

/** La clave de un período pedido: lo que el navegador guarda y lo que el servidor contesta. */
export const claveDePeriodo = (p: { desde: string; hasta: string }): string => `${p.desde}|${p.hasta}`;

/** `2026-10-19` → `19/10`. */
const diaMes = (f: string): string => `${f.slice(8, 10)}/${f.slice(5, 7)}`;
/** `2026-10-19` → `19/10/2026`. */
const fechaLarga = (f: string): string => `${diaMes(f)}/${f.slice(0, 4)}`;
/** Un rango corto, con el año sólo si el rango cruza de año. */
const rangoCorto = (desde: string, hasta: string): string => {
  if (desde === hasta) return diaMes(desde);
  return desde.slice(0, 4) === hasta.slice(0, 4) ? `${diaMes(desde)} – ${diaMes(hasta)}` : `${fechaLarga(desde)} – ${fechaLarga(hasta)}`;
};

/**
 * Lo que lee «El mes» para el período pedido. `hoy`: el del NEGOCIO (lo pone el servidor). Un período que termina después
 * de hoy se corta en hoy; uno que empieza después de hoy queda en su primer día (`hastaHoy`, la regla de lo vendido y lo
 * cobrado). El anterior es el del mismo largo que termina el día antes (`periodoAnterior`), salvo con «Todo».
 */
export function rangoDelResumen(pedido: { desde: string; hasta: string }, hoy: string): RangoDelResumen {
  const actual = { desde: pedido.desde, hasta: hastaHoy(pedido.desde, pedido.hasta, hoy) };
  if (actual.desde <= DESDE_TODO) return { actual, anterior: null, etiqueta: '' };
  const anterior = periodoAnterior(actual.desde, actual.hasta);
  return { actual, anterior, etiqueta: rangoCorto(anterior.desde, anterior.hasta) };
}

/**
 * El título de «El mes» con el período de la hoja: «El mes» si la hoja mira el mes, el nombre del período si no («Últimos
 * 30 días», «El mes pasado»), o sus fechas si es personalizado. Sin período de la hoja, «El mes». Un título escrito en el
 * panel manda sobre éste (`TituloBloque`, ./bloques/comun.tsx).
 */
export function tituloDelPeriodo(p: PeriodoDeBloques | null): string {
  if (!p || p.preset === 'este_mes' || p.preset === 'este_mes_completo') return 'El mes';
  if (p.preset === 'personalizado') return rangoCorto(p.desde, p.hasta);
  return nombrePreset(p.preset);
}

// =============================================================================
// El mapa de calor del Dashboard mira lo MISMO que la hoja: período y filtros de los controles
// =============================================================================
// El gráfico «Mapa de calor de página» (`mapa_calor`, sobre el conjunto `toques`) no trae sus puntos por
// /api/graficos —un resultado agregado no tiene puntos—: los pide a /api/landing-analyst/mapa, como la tab
// vieja. Lo que cambia desde v5 (12/10/2026) es QUÉ pide: el período y los filtros que resolvió la hoja
// (`efectivoDe`: el control de período, la página, el dispositivo, lo que se tocó, botón o no), y no «sus 30
// días» de antes.
//
// ⚠️ LOS FILTROS SE APLICAN CON LA MISMA FUNCIÓN QUE EL AGREGADOR (`filtrarFilas`, lib/graficos-agregar.ts)
// sobre las MISMAS dimensiones que arma el lector del conjunto `toques` (lib/graficos-datos-extra.ts,
// `filasToques`). Si el mapa armara las suyas, el chip «Celular» de la hoja filtraría un número y no el otro.
// Los rótulos de cada valor viven acá y un test los compara contra el lector (tests/landing-mapa-vivo.test.ts).
//
// SIN `server-only`: lo usan la pantalla (app/dashboard/MapaCalor.tsx), la ruta y los tests.
// =============================================================================

import type { Dispositivo } from './landing-mapa';
import type { Filtro } from './graficos-agregar';

/** Las dimensiones del conjunto `toques` que el mapa sabe filtrar (las de tiempo no: el período ya recorta). */
export const DIMENSIONES_TOQUES = ['pagina', 'lugar', 'tipo', 'dispositivo'] as const;
export type DimensionToque = (typeof DIMENSIONES_TOQUES)[number];

/** Los valores de la dimensión `dispositivo` del conjunto `toques`. */
export const ROTULO_DISPOSITIVO: Readonly<Record<Dispositivo, string>> = { movil: 'Celular', escritorio: 'Computadora' };

/** Los valores de la dimensión `tipo` del conjunto `toques`. */
export const ROTULO_TIPO: Readonly<Record<'click' | 'clic_vacio', string>> = { click: 'Botón', clic_vacio: 'Fuera de un botón' };

const MAX_FILTROS = 8;
const MAX_VALORES = 50;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
/** Un período más largo que esto no es un período del Dashboard: es un pedido armado a mano. */
const MAX_DIAS = 800;

/** Los filtros de un gráfico que el mapa puede aplicar: los de las dimensiones de `toques`, sin los vacíos. */
export function filtrosDeToques(filtros: readonly Filtro[] | null | undefined): Filtro[] {
  const out: Filtro[] = [];
  for (const f of filtros ?? []) {
    if (!(DIMENSIONES_TOQUES as readonly string[]).includes(f.dimension)) continue;
    if (f.valores && f.valores.length) out.push({ dimension: f.dimension, valores: [...f.valores] });
    else if (f.texto && f.texto.trim()) out.push({ dimension: f.dimension, texto: f.texto.trim() });
  }
  return out;
}

/**
 * Los filtros que llegan por la URL (JSON), saneados: sólo las dimensiones de `toques`, con topes. Lo que no
 * tiene la forma se tira (es un pedido que no salió de la pantalla).
 */
export function sanearFiltrosToques(crudo: unknown): Filtro[] {
  let x: unknown = crudo;
  if (typeof crudo === 'string') {
    if (!crudo.trim()) return [];
    try { x = JSON.parse(crudo); } catch { return []; }
  }
  if (!Array.isArray(x)) return [];
  const out: Filtro[] = [];
  for (const f of x.slice(0, MAX_FILTROS)) {
    if (!f || typeof f !== 'object') continue;
    const o = f as { dimension?: unknown; valores?: unknown; texto?: unknown };
    if (typeof o.dimension !== 'string' || !(DIMENSIONES_TOQUES as readonly string[]).includes(o.dimension)) continue;
    if (Array.isArray(o.valores)) {
      const valores = o.valores.filter((v): v is string => typeof v === 'string' && v.length <= 500).slice(0, MAX_VALORES);
      if (valores.length) out.push({ dimension: o.dimension, valores });
    } else if (typeof o.texto === 'string' && o.texto.trim()) {
      out.push({ dimension: o.dimension, texto: o.texto.trim().slice(0, 80) });
    }
  }
  return out;
}

/** El período de la hoja, saneado: dos fechas `YYYY-MM-DD` válidas, en orden y no más de MAX_DIAS. */
export function sanearVentana(desde: unknown, hasta: unknown): { desde: string; hasta: string } | null {
  if (typeof desde !== 'string' || typeof hasta !== 'string' || !RE_FECHA.test(desde) || !RE_FECHA.test(hasta)) return null;
  const a = Date.parse(`${desde}T00:00:00Z`), b = Date.parse(`${hasta}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return null;
  // Una fecha que el parser corrige (2026-02-31 → 3 de marzo) no es la que se pidió.
  if (new Date(a).toISOString().slice(0, 10) !== desde || new Date(b).toISOString().slice(0, 10) !== hasta) return null;
  if ((b - a) / 86_400_000 > MAX_DIAS) return null;
  return { desde, hasta };
}

/** Cuántos días tiene un período (los dos extremos adentro). */
export function diasDe(v: { desde: string; hasta: string }): number {
  return Math.round((Date.parse(`${v.hasta}T00:00:00Z`) - Date.parse(`${v.desde}T00:00:00Z`)) / 86_400_000) + 1;
}

/**
 * Las dimensiones de un toque, con los valores del lector del conjunto `toques`. `pagina` llega ya armada
 * (es `ruta(landing_url)` de lib/graficos-lectura.ts, que es server-only) y `lugar` es su rótulo.
 */
export function dimensionesDeToque(x: { pagina: string | null; lugar: string; tipo: 'click' | 'clic_vacio'; disp: Dispositivo }): Record<DimensionToque, string | null> {
  return { pagina: x.pagina, lugar: x.lugar, tipo: ROTULO_TIPO[x.tipo], dispositivo: ROTULO_DISPOSITIVO[x.disp] };
}

// =============================================================================
// landing-diseno-muestra — los datos de EJEMPLO de la hoja Landing (la miniatura de «Nueva hoja» y el arnés de la copia)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/landing-corbel/mako.html), inventados: ningún cliente, página ni número
// real. Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts), así la miniatura
// pasa por el mismo `vistaLanding` que la hoja de verdad y no tiene una segunda forma de armarse.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './landing-diseno';
import { DIAS_SEMANA, FRANJAS_HORA } from './visitas-momento';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const un = (ids: string[], totales: number[], anterior?: number[], serie?: number[], hoy?: string): DatosPieza => ({
  resultado: {
    columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...(anterior ? { anterior } : {}),
    ...(serie && hoy ? { serie: serie.map((valor, i) => { const c = diaAntes(hoy, serie.length - 1 - i); return { clave: c, etiqueta: c, valor }; }) } : {}),
  } as Resultado,
});
const diaAntes = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };

/** Treinta días de visitas: una ola suave y determinista (sin azar: la miniatura no cambia entre cargas). */
function dias(hoy: string): Array<{ clave: string; visitas: number; personas: number }> {
  const out: Array<{ clave: string; visitas: number; personas: number }> = [];
  for (let i = 29; i >= 0; i--) {
    const k = 29 - i, ola = Math.sin(k / 2.6) * 0.18 + Math.sin(k / 1.3) * 0.07;
    const v = i === 0 ? 23 : Math.round(41 * (1 + k * 0.006 + ola));
    out.push({ clave: diaAntes(hoy, i), visitas: v, personas: Math.round(v * 0.79) });
  }
  return out;
}

// Las visitas por franja (filas: madrugada, mañana, tarde, noche) y día (lunes a domingo). La forma de Corbel: poca madrugada,
// mucha tarde y noche, y el fin de semana más fuerte a la mañana.
const CUANDO = [
  [6, 5, 6, 5, 6, 8, 9],
  [38, 22, 36, 34, 21, 52, 55],
  [41, 39, 40, 38, 37, 56, 58],
  [63, 61, 60, 62, 59, 40, 64],
];

export function datosLandingMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const ds = dias(hoy);
  const visitas = ds.reduce((a, d) => a + d.visitas, 0), personas = Math.round(visitas * 0.79);
  const porDia: Resultado = {
    columnas: col(['visitas', 'visitantes']), totales: [visitas, personas], fuera: 0, clase: 'tiempo',
    filas: ds.map((d) => ({ clave: d.clave, etiqueta: d.clave, valores: [d.visitas, d.personas] })),
  };
  const cuando: Resultado = {
    columnas: col(['visitas']), totales: [CUANDO.flat().reduce((a, b) => a + b, 0)], fuera: 0, clase: 'categoria',
    filas: FRANJAS_HORA.map((f, i) => ({ clave: f, etiqueta: f, valores: [CUANDO[i].reduce((a, b) => a + b, 0)] })),
    cruce: { claves: [...DIAS_SEMANA], celdas: CUANDO },
  };
  const origenes: Array<[string, number]> = [['instagram.com', 612], ['(sin dato)', visitas - 951], ['l.facebook.com', 241], ['google.com', 98]];
  const tot = origenes.reduce((a, x) => a + x[1], 0);
  const origen: Resultado = {
    columnas: col(['visitas']), totales: [tot], fuera: 0, clase: 'categoria',
    filas: origenes.map(([n, v]) => ({ clave: n, etiqueta: n, valores: [v] })),
  };
  const diagnostico: Resultado = {
    columnas: col(['puntaje']), totales: [72], fuera: 0, clase: 'categoria',
    filas: [['/clase-gratis', 81], ['/vsl', 64], ['/gracias', 71]].map(([n, v]) => ({ clave: String(n), etiqueta: String(n), valores: [Number(v)] })),
  };
  const mitad = [44, 46, 45, 47, 49, 48, 46, 47, 50, 49, 48, 51, 50, 49, 52, 51, 50, 49, 51, 53, 52, 51, 50, 52, 53, 52, 54, 53, 52, 53];
  const tocan = [4, 6, 5, 7, 6, 8, 7, 9, 8, 10, 9, 8, 7, 9, 10, 9, 8, 10, 11, 9, 10, 8, 9, 11, 10, 12, 11, 10, 12, 7];
  const r = (k: string | undefined, d: DatosPieza): Array<[string, DatosPieza]> => (k ? [[k, d]] : []);
  return Object.fromEntries([
    ...r(p.apertura, un(['visitas', 'visitantes'], [visitas, personas], [Math.round(visitas / 1.12), Math.round(personas / 1.1)])),
    ...r(p.mitad, un(['pct_50'], [51.2], [48.9], mitad, hoy)),
    ...r(p.final, un(['pct_100'], [18.4], [19.1], undefined, hoy)),
    ...r(p.tocan, un(['personas'], [264], [231], tocan, hoy)),
    ...r(p.puntaje, un(['puntaje'], [72])),
    ...r(p.diagnostico, { resultado: diagnostico }),
    ...r(p.scroll, un(['medidos', 'llegaron_25', 'llegaron_50', 'llegaron_75', 'llegaron_100'], [968, 812, 496, 301, 178])),
    ...r(p.visitas, { resultado: porDia }),
    ...r(p.cuando, { resultado: cuando }),
    ...r(p.origen, { resultado: origen }),
  ]);
}

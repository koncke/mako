// =============================================================================
// marketing-diseno-muestra — los datos de EJEMPLO de la hoja Marketing (la miniatura de «Nueva hoja» y el arnés de la copia)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/marketing-kestrel/mako.html), inventados: ningún cliente, anuncio ni
// número real. Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts), así la
// miniatura pasa por el mismo `vistaMarketing` que la hoja de verdad y no tiene una segunda forma de armarse.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './marketing-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const un = (ids: string[], totales: number[], anterior?: number[]): DatosPieza => ({ resultado: { columnas: col(ids), filas: [], totales, fuera: 0, clase: null, ...(anterior ? { anterior } : {}) } as Resultado });

const ANUNCIOS: Array<[string, string, number, number, number]> = [
  ['Video testimonio · Laura', 'Captación otoño', 612, 41, 9], ['Carrusel 3 errores', 'Captación otoño', 488, 33, 6],
  ['Reel clase gratis', 'Clase gratis', 402, 29, 4], ['Imagen oferta 48 h', 'Retargeting', 255, 18, 3],
  ['Video fundadora', 'Captación otoño', 318, 21, 2], ['Historia preguntas', 'Retargeting', 96, 7, 2],
  ['Carrusel antes y después', 'Clase gratis', 140, 9, 1], ['Reel detrás de escena', 'Clase gratis', 83, 6, 0],
  ['Imagen precio', 'Retargeting', 41, 2, 0], ['Video pregunta frecuente', 'Captación otoño', 25, 1, 0],
];

/** Un día con su gasto, leads y agendas: una caminata suave y determinista (sin azar: la miniatura no cambia entre cargas). */
function dias(hoy: string): Array<{ clave: string; v: [number, number, number] }> {
  const out: Array<{ clave: string; v: [number, number, number] }> = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - i);
    const k = 29 - i, ola = Math.sin(k / 3.1) * 0.12 + Math.sin(k / 1.7) * 0.06;
    out.push({ clave: d.toISOString().slice(0, 10), v: [Math.round(76 * (1 + k * 0.003 + ola)), Math.round(5 * (1 + k * 0.006 + ola * 1.4)), k % 7 === 0 || k === 26 || k === 28 ? 2 : 1] });
  }
  return out;
}

export function datosMarketingMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const ag = ANUNCIOS.reduce((a, x) => a + x[4], 0), g = ANUNCIOS.reduce((a, x) => a + x[2], 0), l = ANUNCIOS.reduce((a, x) => a + x[3], 0);
  const anuncios: Resultado = {
    columnas: col(['agendas', 'gasto', 'leads', 'cpa']), totales: [ag, g, l, g / ag], fuera: 0, clase: 'categoria',
    filas: ANUNCIOS.map(([nombre, campana, gasto, leads, agendas], i) => ({ clave: `ad${i + 1}`, etiqueta: nombre, ref: `ad${i + 1}`, extra: { campana }, valores: [agendas, gasto, leads, agendas ? gasto / agendas : null] })),
  };
  const porCampana = new Map<string, [number, number, number, number]>();
  for (const [, c, gasto, leads, agendas] of ANUNCIOS) { const x = porCampana.get(c) ?? [0, 0, 0, 0]; porCampana.set(c, [x[0] + agendas, x[1] + gasto, x[2] + leads, x[3] + 1]); }
  const campanas: Resultado = {
    columnas: col(['agendas', 'gasto', 'leads', 'cpa', 'anuncios']), totales: [ag, g, l, g / ag, ANUNCIOS.length], fuera: 0, clase: 'categoria',
    filas: [...porCampana].sort((a, b) => b[1][0] - a[1][0]).map(([c, [a, gg, ll, n]]) => ({ clave: c, etiqueta: c, valores: [a, gg, ll, a ? gg / a : null, n] })),
  };
  const ds = dias(hoy);
  const tendencias: Resultado = { columnas: col(['gasto', 'leads', 'agendas']), totales: [], fuera: 0, clase: 'tiempo', filas: ds.map((d) => ({ clave: d.clave, etiqueta: d.clave, valores: d.v })) };
  const plataforma: Resultado = {
    columnas: col(['agendas', 'impresiones', 'ctr', 'cpm']), totales: [27, 48210, 2.81, 51.03], fuera: 0, clase: 'categoria',
    filas: [['Instagram', 16], ['Facebook', 9], ['Messenger', 2]].map(([n, a]) => ({ clave: String(n), etiqueta: String(n), valores: [Number(a), null, null, null] })),
  };
  const r = (k: string | undefined, d: DatosPieza): Array<[string, DatosPieza]> => (k ? [[k, d]] : []);
  return Object.fromEntries([
    ...r(p.apertura, un(['gasto', 'agendas', 'cpa'], [2460, 27, 91.11], [2299, 24.8, 95.31])),
    ...r(p.cpa, un(['cpa'], [91.11], [95.31])),
    ...r(p.roas, un(['roas_cobrado'], [3.4], [3.1])),
    ...r(p.agendas, un(['agendas'], [27], [24.8])),
    ...r(p.gasto, un(['gasto'], [2460], [2299])),
    ...r(p.ctr, un(['ctr'], [2.8], [3.0])),
    ...r(p.cpl, un(['cpl'], [14.73], [15.83])),
    ...r(p.tendencias, { resultado: tendencias }),
    ...r(p.funnel, un(['impresiones', 'clics', 'vistas_landing', 'vistas_vsl', 'leads', 'agendas'], [48210, 1356, 1003, 412, 167, 27], [45110, 1264, 902, 380, 151, 25])),
    ...r(p.plataforma, { resultado: plataforma }),
    ...r(p.campanas, { resultado: campanas }),
    ...r(p.anuncios, { resultado: anuncios }),
  ]);
}

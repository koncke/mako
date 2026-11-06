// =============================================================================
// vsl-diseno-muestra — los datos de EJEMPLO de la hoja «VSL y YouTube» (la miniatura de «Nueva hoja» y el arnés de la captura)
// =============================================================================
// Inventados: ningún video, cliente ni número real. Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`,
// lib/graficos-agregar.ts), así la miniatura pasa por el mismo `vistaVsl` que la hoja de verdad. Las cifras cierran entre tarjetas:
// los play de los días suman el número grande, los de los videos también, y la curva llega al mismo «al final» que los días.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const r1 = (x: number) => Math.round(x * 10) / 10;

// De cada 100 que le dan play, cuántos siguen en cada corte (5%, 10%… 100%): se van muchos al principio y en la oferta (60-70%).
const SIGUEN = [86, 78, 71, 66, 62, 58, 55, 52, 50, 48, 46, 44, 38, 33, 31, 29, 27, 26, 25, 23];
// [tramo, leads, agendas, cierres]: los que más ven, más agendan.
const TRAMOS: Array<[string, number, number, number]> = [
  ['No lo vio', 64, 5, 1], ['Sin medir', 12, 1, 0], ['0-25%', 41, 4, 1], ['25-50%', 27, 6, 2], ['50-75%', 19, 7, 3], ['75-100%', 23, 12, 6],
];
// [video, play, un cuarto, la mitad, al final]: del más visto al menos visto.
const VIDEOS: Array<[string, number, number, number, number]> = [
  ['VSL principal (12 min)', 1840, 63.2, 48.6, 23.9], ['VSL corto (4 min)', 612, 71.4, 57.0, 34.8], ['Clase gratis: el embudo', 388, 58.1, 41.3, 19.6],
  ['Testimonio de una clienta', 214, 66.8, 52.2, 31.0], ['Preguntas frecuentes', 97, 49.5, 33.0, 15.5], ['Detrás de cámaras', 41, 44.0, 29.3, 12.2],
];
const PLAY = VIDEOS.reduce((a, v) => a + v[1], 0);

export function datosVslMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, x: Resultado) => { if (k) out[k] = { resultado: x }; };
  const kpi = (metrica: string, v: number): Resultado => ({ columnas: col([metrica]), filas: [], totales: [v], fuera: 0, clase: null });

  // Los 30 días: una ola suave que sube hacia hoy (sin azar: la miniatura no cambia entre cargas), escalada para sumar PLAY.
  const crudo = Array.from({ length: 30 }, (_, k) => 70 + Math.sin(k / 2.1) * 18 + Math.sin(k / 0.8) * 7 + k * 1.6);
  const escala = PLAY / crudo.reduce((a, b) => a + b, 0);
  let resto = PLAY;
  const play = crudo.map((x, k) => { const n = k === 29 ? resto : Math.round(x * escala); resto -= n; return n; });
  const filasDia = play.map((n, k) => {
    const medidos = Math.round(n * 0.94), q = 0.97 + Math.sin(k / 1.7) * 0.06;
    const fila = [n, medidos, Math.round(medidos * 0.62 * q), Math.round(medidos * 0.48 * q), Math.round(medidos * 0.33 * q), Math.round(medidos * 0.24 * q)];
    const c = dia(hoy, -(29 - k));
    return { clave: c, etiqueta: c, valores: fila };
  });
  const suma = (i: number) => filasDia.reduce((a, f) => a + f.valores[i], 0);
  const totDia = [0, 1, 2, 3, 4, 5].map(suma);

  poner(p.apertura, { columnas: col(['arrancaron', 'llegaron_final']), filas: [], totales: [totDia[0], totDia[5]], fuera: 0, clase: null });
  poner(p.final, kpi('tasa_final', r1((totDia[5] / totDia[1]) * 100)));
  poner(p.vistas, kpi('vistas_vsl', 14_380));
  poner(p.costo, kpi('costo_vsl', 0.21));
  poner(p.agendaron, kpi('agendaron', TRAMOS.reduce((a, t) => a + t[2], 0)));
  poner(p.curva, {
    columnas: col(['siguen']), fuera: 0, clase: 'categoria', totales: [null],
    filas: SIGUEN.map((s, i) => ({ clave: String((i + 1) * 5), etiqueta: `${(i + 1) * 5}%`, valores: [s] })),
  });
  poner(p.tramos, {
    columnas: col(['leads', 'agendas', 'cierres']), fuera: 0, clase: 'categoria',
    totales: [0, 1, 2].map((i) => TRAMOS.reduce((a, t) => a + (t[i + 1] as number), 0)),
    filas: TRAMOS.map(([k, l, a, c]) => ({ clave: k, etiqueta: k, valores: [l, a, c] })),
  });
  poner(p.videos, {
    columnas: col(['arrancaron', 'tasa_25', 'tasa_50', 'tasa_final']), fuera: 0, clase: 'categoria', totales: [PLAY, null, null, null],
    filas: VIDEOS.map(([k, n, a, b, c]) => ({ clave: k, etiqueta: k, valores: [n, a, b, c] })),
  });
  poner(p.dia, {
    columnas: col(['arrancaron', 'medidos', 'pasaron_25', 'pasaron_50', 'pasaron_75', 'llegaron_final']), fuera: 0, clase: 'tiempo', totales: totDia,
    filas: filasDia,
  });
  return out;
}

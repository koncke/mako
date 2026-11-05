// =============================================================================
// hooks-diseno-muestra — los datos de EJEMPLO de la hoja «Hooks y retención» (la miniatura de «Nueva hoja» y el arnés)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/hooks-ondra/), inventados: ningún anuncio, cliente ni número real.
// Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts), así la miniatura pasa por
// el mismo `vistaHooks` que la hoja de verdad. Las cifras cierran entre tarjetas: los guiones de cada gancho y de cada avatar suman
// los guiones analizados, y la cabecera dice lo mismo que el embudo del video.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const r1 = (x: number) => Math.round(x * 10) / 10;

/** 30 días de cada número: una ola suave (sin azar: la miniatura no cambia entre cargas). */
const ola = (base: number, a: number, b: number, k0 = 0) => Array.from({ length: 30 }, (_, k) => r1(base + Math.sin((k + k0) / 2.3) * a + Math.sin((k + k0) / 0.9) * b + k * 0.02));
// [gancho, guiones, hook rate, llegan al llamado, ThruPlay]
const GANCHOS: Array<[string, number, number, number, number]> = [
  ['Pregunta', 6, 36.2, 12.1, 19.4], ['Dato duro', 5, 33.8, 11.0, 18.2], ['Historia', 4, 30.9, 13.4, 21.0],
  ['Error común', 4, 27.5, 8.9, 15.1], ['Promesa', 3, 24.1, 7.6, 13.0], ['Testimonio', 2, 22.8, 9.8, 14.6],
];
// [guion, gancho, formato, hook rate, llegan al llamado, ThruPlay, al final]: del que más retiene al que menos.
const GUIONES: Array<[string, string, string, number, number, number, number]> = [
  ['Reel: ¿por qué nadie te agenda?', 'Pregunta', 'Reel', 41.3, 13.8, 22.4, 6.9], ['Video: el número que nadie mira', 'Dato duro', 'Video', 38.6, 12.2, 20.1, 6.1],
  ['Carrusel: cómo pasé de 2 a 9 llamadas', 'Historia', 'Carrusel', 34.9, 14.6, 23.3, 7.4], ['Reel: el error del primer mensaje', 'Error común', 'Reel', 31.2, 9.7, 16.8, 4.6],
  ['Video: en 30 días, tu agenda llena', 'Promesa', 'Video', 26.4, 8.1, 13.9, 3.8], ['Testimonio: una clienta cuenta su mes', 'Testimonio', 'Video', 23.5, 10.4, 15.2, 5.0],
];
// [avatar, guiones, hook rate, llegan al llamado]
const AVATARES: Array<[string, number, number, number]> = [
  ['Dueña de agencia', 7, 34.1, 11.8], ['Coach con poca agenda', 6, 32.0, 10.4], ['Emprendedor nuevo', 5, 29.3, 9.1],
  ['Asesor inmobiliario', 4, 27.9, 10.9], ['Mamá emprendedora', 2, 25.4, 8.0],
];
// Lo que vio la gente del video: 3 segundos, un cuarto, la mitad, tres cuartos y entero.
const VIDEO = [48200, 24100, 9640, 6170, 3860];

export function datosHooksMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, x: Resultado) => { if (k) out[k] = { resultado: x }; };
  const serie = (vs: number[]) => vs.map((valor, i) => { const c = dia(hoy, -(vs.length - 1 - i)); return { clave: c, etiqueta: c, valor }; });
  const kpi = (metrica: string, v: number, antes: number, vs: number[]): Resultado => ({ columnas: col([metrica]), filas: [], totales: [v], anterior: [antes], fuera: 0, clase: null, serie: serie(vs) });
  const guiones = GANCHOS.reduce((a, g) => a + g[1], 0);

  poner(p.apertura, { columnas: col(['plays_3s', 'p50', 'p100']), filas: [], totales: [VIDEO[0], VIDEO[2], VIDEO[4]], fuera: 0, clase: null });
  poner(p.hook, kpi('hook_rate', 31.4, 29.6, ola(31, 3.2, 1.4)));
  poner(p.cta, kpi('ret_cta', 10.2, 10.9, ola(10.2, 1.3, 0.6, 3)));
  poner(p.thruplay, kpi('thruplay_rate', 17.1, 16.4, ola(17, 1.8, 0.8, 5)));
  poner(p.guiones, kpi('guiones', guiones, 20, Array.from({ length: 30 }, (_, k) => Math.max(4, Math.round(9 + Math.sin(k / 2.6) * 3 + k * 0.08)))));
  poner(p.gancho, {
    columnas: col(['hook_rate', 'ret_cta', 'thruplay_rate', 'guiones']), fuera: 0, clase: 'categoria', totales: [31.4, 10.2, 17.1, guiones],
    filas: GANCHOS.map(([k, n, h, c, t]) => ({ clave: k, etiqueta: k, valores: [h, c, t, n] })),
  });
  poner(p.tabla, {
    columnas: col(['hook_rate', 'ret_cta', 'thruplay_rate', 'retencion_final']), fuera: guiones - GUIONES.length, clase: 'categoria', totales: [31.4, 10.2, 17.1, 5.2],
    columnasExtra: [{ id: 'gancho', nombre: 'Tipo de gancho' }, { id: 'formato', nombre: 'Formato' }],
    filas: GUIONES.map(([k, g, f, h, c, t, fin]) => ({ clave: k, etiqueta: k, valores: [h, c, t, fin], extra: { gancho: g, formato: f } })),
  });
  poner(p.video, { columnas: col(['plays_3s', 'p25', 'p50', 'p75', 'p100']), filas: [], totales: VIDEO, fuera: 0, clase: null });
  poner(p.avatar, {
    columnas: col(['hook_rate', 'ret_cta', 'guiones']), fuera: 0, clase: 'categoria', totales: [31.4, 10.2, guiones],
    filas: AVATARES.map(([k, n, h, c]) => ({ clave: k, etiqueta: k, valores: [h, c, n] })),
  });
  return out;
}

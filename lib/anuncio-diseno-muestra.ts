// =============================================================================
// anuncio-diseno-muestra — los datos de EJEMPLO de la hoja «Anuncio ganador» (la miniatura de «Nueva hoja» y el arnés)
// =============================================================================
// Son los de la adaptación (docs/diseno/mockups-dashboard/anuncio-prism/), inventados: ningún anuncio, cliente ni número real.
// Tienen la FORMA de lo que devuelven las piezas de la plantilla (`Resultado`, lib/graficos-agregar.ts), así la miniatura pasa por
// el mismo `vistaAnuncio` que la hoja de verdad. Las cifras cierran entre tarjetas: las semanas suman los días, lo invertido en cada
// veredicto suma lo invertido, y los guiones de cada confianza suman los de cada veredicto.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { VEREDICTO_ROTULO } from './ads-analyst-patrones';

const col = (ids: string[]) => ids.map((id) => ({ id, nombre: id, formato: 'numero' as const }));
const dia = (hoy: string, n: number) => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const lunes = (f: string) => { const d = new Date(`${f}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
const r = (x: number) => Math.round(x * 100) / 100;

/** 56 días de agendas: una ola suave que sube (sin azar: la miniatura no cambia entre cargas). */
const AGENDAS = Array.from({ length: 56 }, (_, k) => Math.max(0, Math.round(1.1 + k * 0.035 + Math.sin(k / 1.7) * 0.9 + Math.sin(k / 4.3) * 0.6)));
const GASTO_DIA = 6480 / 56;
const GANCHO = Array.from({ length: 56 }, (_, k) => [r(30 + Math.sin(k / 2.1) * 4 + Math.sin(k / 0.9) * 2 + k * 0.03), r(10 + Math.sin(k / 2.7) * 1.8 + Math.sin(k / 1.1)), r(17 + Math.sin(k / 3.1) * 2.2 + Math.sin(k / 1.3))]);
// [veredicto, guiones, invertido]
const VEREDICTOS: Array<[string, number, number]> = [
  [VEREDICTO_ROTULO.validar, 6, 330], [VEREDICTO_ROTULO.mejorar, 5, 1240], [VEREDICTO_ROTULO.escalar, 4, 2100],
  [VEREDICTO_ROTULO.repensar, 4, 960], [VEREDICTO_ROTULO.reescribir, 3, 1310], [VEREDICTO_ROTULO.imagen, 2, 540],
];
const CONFIANZA: Array<[string, number]> = [['Alta', 8], ['Media', 7], ['Baja', 9]];
// [guion, agendas, invertido]: los que tienen muestra, en el orden de la pieza (por agendas por US$1.000).
const GANADORES: Array<[string, number, number]> = [
  ['Reel: el error que te cuesta clientes', 14, 880], ['Video: cómo trabajamos, paso a paso', 11, 790], ['Carrusel: tres casos de éxito', 9, 760],
  ['Testimonio: una clienta cuenta su resultado', 8, 700], ['Imagen: la oferta de noviembre', 4, 620], ['Video: preguntas frecuentes', 2, 540],
];
// Los seis meses cerrados, [agendas, invertido], del más viejo al más nuevo.
const MESES: Array<[number, number]> = [[38, 3100], [44, 3350], [51, 3600], [63, 4100], [72, 4450], [89, 4900]];

export function datosAnuncioMuestra(hoja: Pick<Hoja, 'diseno'>, hoy: string): Record<string, DatosPieza> {
  const p = hoja.diseno?.piezas ?? {};
  const out: Record<string, DatosPieza> = {};
  const poner = (k: string | undefined, x: Resultado) => { if (k) out[k] = { resultado: x }; };
  const agendas = AGENDAS.reduce((a, b) => a + b, 0), gasto = 6480;
  // Los cierres: los de cada semana caen en su primer día (el diseño suma las semanas desde los días; los de la cabecera son su suma).
  const CIERRES = [1, 2, 1, 2, 3, 2, 3, 2, 2];
  const semanasVistas: string[] = [];
  const cierresDia = AGENDAS.map((_, i) => {
    const k = lunes(dia(hoy, -(AGENDAS.length - 1 - i)));
    if (semanasVistas.includes(k)) return 0;
    semanasVistas.push(k);
    return CIERRES[semanasVistas.length - 1] ?? 1;
  });
  const cierres = cierresDia.reduce((a, b) => a + b, 0);
  const cat = (metricas: string[], filas: Array<[string, ...number[]]>, totales: Array<number | null>): Resultado => ({
    columnas: col(metricas), totales, fuera: 0, clase: 'categoria', filas: filas.map(([k, ...v]) => ({ clave: k, etiqueta: k, valores: v })),
  });
  const kpi = (metrica: string, v: number, antes: number, serie: number[]): Resultado => ({
    columnas: col([metrica]), filas: [], totales: [v], anterior: [antes], fuera: 0, clase: null,
    serie: serie.map((valor, i) => { const c = dia(hoy, -(serie.length - 1 - i)); return { clave: c, etiqueta: c, valor }; }),
  });

  poner(p.apertura, { columnas: col(['agendas', 'cierres', 'cpa', 'gasto']), filas: [], totales: [agendas, cierres, r(gasto / agendas), gasto], fuera: 0, clase: null });
  poner(p.dia, {
    columnas: col(['agendas', 'cierres']), fuera: 0, clase: 'tiempo', totales: [agendas, cierres], anterior: [Math.round(agendas * 0.88), cierres - 2],
    filas: AGENDAS.map((v, i) => { const c = dia(hoy, -(AGENDAS.length - 1 - i)); return { clave: c, etiqueta: c, valores: [v, cierresDia[i]] }; }),
  });
  poner(p.veredicto, cat(['guiones'], VEREDICTOS.map(([k, n]) => [k, n]), [VEREDICTOS.reduce((a, v) => a + v[1], 0)]));
  poner(p.invertido, cat(['gasto'], VEREDICTOS.map(([k, , g]) => [k, g]), [gasto]));
  poner(p.confianza, cat(['guiones'], CONFIANZA, [24]));
  const gAg = GANADORES.reduce((a, g) => a + g[1], 0), gGa = GANADORES.reduce((a, g) => a + g[2], 0);
  poner(p.ganadores, cat(['agendas_1k', 'agendas', 'gasto'], GANADORES.map(([k, a, g]) => [k, r((a / g) * 1000), a, g]), [r((gAg / gGa) * 1000), gAg, gGa]));
  poner(p.cpa, kpi('cpa', r(gasto / agendas), 72.4, [81, 78, 84, 76, 74, 79, 71, 73, 69, 70, 66, 67.5]));
  poner(p.cierre, kpi('costo_cierre', 360, 341, [330, 338, 352, 340, 347, 361, 349, 356, 372, 365, 358, 360]));
  poner(p.sinretorno, kpi('gasto', 980, 1210, [140, 120, 132, 110, 96, 104, 88, 92, 80, 84, 72, 70]));
  // Los últimos 12 meses (`ult12m`): los seis cerrados de MESES, los cinco de antes más chicos y el de hoy, a medias.
  const mes = (n: number) => { const [y, m] = hoy.split('-').map(Number); const t = (y * 12 + (m - 1)) - n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}-01`; };
  const doce: Array<[number, number]> = [[20, 2100], [24, 2300], [27, 2500], [31, 2700], [33, 2900], ...MESES, [14, 820]];
  poner(p.meses, {
    columnas: col(['agendas', 'gasto']), fuera: 0, clase: 'tiempo', totales: [doce.reduce((a, m) => a + m[0], 0), doce.reduce((a, m) => a + m[1], 0)],
    filas: doce.map(([a, g], i) => { const c = mes(doce.length - 1 - i); return { clave: c, etiqueta: c, valores: [a, g] }; }),
  });
  poner(p.gancho, {
    columnas: col(['hook_rate', 'ret_cta', 'thruplay_rate']), fuera: 0, clase: 'tiempo', totales: [31.4, 10.2, 17.1],
    filas: GANCHO.map((v, i) => { const c = dia(hoy, -(GANCHO.length - 1 - i)); return { clave: c, etiqueta: c, valores: v }; }),
  });
  poner(p.guiones, cat(['agendas', 'hook_rate', 'retencion_final', 'cpa'], [
    [GANADORES[0][0], 14, 34.2, 6.1, r(880 / 14)], [GANADORES[1][0], 11, 31.8, 5.2, r(790 / 11)], [GANADORES[2][0], 9, 29.4, 4.8, r(760 / 9)],
  ], [agendas, 31.4, 5.0, r(gasto / agendas)]));
  return out;
}

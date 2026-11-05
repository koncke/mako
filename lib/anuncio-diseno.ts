// =============================================================================
// anuncio-diseno — lo que dibuja la hoja «Anuncio ganador» con su DISEÑO PROPIO (la copia de Prism), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/anuncio-prism/; acá, de dónde sale cada número con los DATOS REALES: los componentes de la hoja
// (`hoja.diseno.piezas`, lib/graficos-plantillas-analysts.ts, ADS), todos de los guiones analizados de tus anuncios. La pregunta
// de la hoja es «¿cuál creativo gana, y con cuánta confianza?»:
//   · «Revenue» → las agendas que trajeron tus anuncios, por día, con su promedio de 7 días y el último día;
//   · «Traffic sources» → qué hacer con cada guion (el veredicto: escalar, mejorar el gancho, reescribir el cuerpo…);
//   · «Revenue by region» → con cuánta muestra: cuántos guiones juntaron impresiones suficientes para juzgarlos;
//   · «Campaign ROAS» → qué guion rinde más: las agendas por cada US$1.000 de los que tienen muestra, contra tu promedio;
//   · «Key metrics» → el costo por agenda, el costo por cierre y lo gastado sin una sola agenda, con su cambio y su curva;
//   · «Platform health» → listos para escalar: qué parte de lo invertido va a los guiones que conviene escalar;
//   · «Quarterly revenue» y «Active customers» → las agendas y lo invertido de los seis meses cerrados (no obedecen al período);
//   · «Signups & activations» → las agendas y los cierres por semana (la suma de los días), y cuántas agendas cerraron;
//   · «Checkout latency» → el gancho en el tiempo: hook rate, llegan al llamado y ThruPlay, contra el buen gancho (28%);
//   · «Feed» → el guion que más agendó y los atajos (Ads Manager, Ads Writer, Hooks y retención, la grilla).
//
// LO QUE PRISM TIENE Y MaKo NO HACE NO SE INVENTA: el «Live» y los cubos de 15 s (los datos de Meta son por día), el pronóstico
// (la línea es un promedio de lo medido), las regiones, la salud de la plataforma y la latencia. Y la «confianza» es la de la
// MUESTRA (impresiones, lib/ads-analyst-patrones.ts), no una prueba estadística entre dos creativos: ésa no se mide todavía.
//
// UNA HOJA LLEVA HASTA 14 PANELES (tests/graficos-corbel.test.ts): cuántos guiones hay para escalar sale de la fila «Escalar» del
// veredicto, y las semanas de los días, en vez de pedirse como otras piezas.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaAnuncio.tsx) y el test. Lo que no llegó es `null`,
// nunca un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { HOOK_MID, IMPR_ALTA, IMPR_MEDIA, VEREDICTO_ROTULO } from './ads-analyst-patrones';
import { plata, rotuloDia } from './marketing-diseno';
import { marcasDelEje, topeDe } from './curso-diseno';

export type { DatosPieza };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const anteriorDe = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && r.anterior && i >= 0 ? num(r.anterior[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const SIN = '(sin dato)';

/** «4.2»: las agendas por US$1.000 y los «×» van con un decimal. */
export const uno = (v: number) => (Math.round(v * 10) / 10).toFixed(1);
/** «28%»; debajo de 10, con un decimal («8.4%»). */
export const pct = (v: number) => (Math.abs(v) < 10 ? `${uno(v)}%` : `${Math.round(v)}%`);
/** «US$4.2k» en un centro chico; debajo de US$10.000, entero. */
export const plataCorta = (n: number) => (Math.abs(n) >= 10_000 ? `US$${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : `US$${Math.round(n).toLocaleString('en-US')}`);

/** El cambio contra el período anterior, en % con un decimal («+8.0%»), y si eso es bueno (en un costo, bajar es bueno). */
export type Cambio = { texto: string; sube: boolean; bueno: boolean };
export function cambio(actual: number | null, anterior: number | null, menosEsMejor = false): Cambio | null {
  if (actual == null || anterior == null || !anterior) return null;
  const p = Math.round(((actual - anterior) / Math.abs(anterior)) * 1000) / 10;
  if (p === 0) return null;
  return { texto: `${p > 0 ? '+' : '−'}${Math.abs(p).toFixed(1)}%`, sube: p > 0, bueno: menosEsMejor ? p < 0 : p > 0 };
}

// ── «Revenue» → las agendas por día ─────────────────────────────────────────────────────────────────────────────
/** Cuántos días dibuja la tarjeta de arriba: los últimos del período (Prism dibuja 60 cubos; con días, seis semanas se leen). */
export const DIAS_AGENDAS = 42;
export type AgendasAn = {
  total: number | null;
  cambio: Cambio | null;
  /** Los días dibujados (los últimos DIAS_AGENDAS del período), con su rótulo. */
  dias: Array<{ clave: string; rotulo: string; valor: number }>;
  /** El promedio de los 7 días que terminan en cada uno (con los días de antes del recorte), o null con menos de 3 días medidos. */
  ritmo: Array<number | null>;
  tope: number;
  /** Los días que llevan rótulo abajo (índices de `dias`), a la misma distancia contando desde el último. */
  marcas: number[];
  /** Si el período es más largo que lo dibujado (el subtítulo lo dice). */
  recortado: boolean;
};
export function agendasDe(r: Resultado | null): AgendasAn | null {
  if (!r) return null;
  const todos = r.filas.map((f) => ({ clave: f.clave, valor: enFila(r, f, 'agendas') ?? 0 }));
  const desde = Math.max(0, todos.length - DIAS_AGENDAS);
  const dias = todos.slice(desde).map((d) => ({ ...d, rotulo: rotuloDia(d.clave) }));
  const ritmo = dias.map((_, i) => {
    const ventana = todos.slice(Math.max(0, desde + i - 6), desde + i + 1);
    return ventana.length >= 3 ? ventana.reduce((a, d) => a + d.valor, 0) / ventana.length : null;
  });
  const max = Math.max(0, ...dias.map((d) => d.valor), ...ritmo.map((v) => v ?? 0));
  const t = total(r, 'agendas');
  return { total: t, cambio: cambio(t, anteriorDe(r, 'agendas')), dias, ritmo, tope: topeDe(max), marcas: marcasDelEje(dias.length, 7), recortado: desde > 0 };
}

// ── los anillos: «Qué hacer con cada uno» y «Con cuánta muestra» ────────────────────────────────────────────────────
export type Tono = 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 'sm';
export type Gajo = { clave: string; nombre: string; n: number; parte: number; tono: Tono; regla?: string };
export type AnilloAn = { total: number; gajos: Gajo[] };
/** El color de cada veredicto, por su rótulo (los de la tab, lib/ads-analyst-patrones.ts). */
export const TONO_VEREDICTO: Readonly<Record<string, Tono>> = {
  [VEREDICTO_ROTULO.escalar]: 's1', [VEREDICTO_ROTULO.mejorar]: 's5', [VEREDICTO_ROTULO.reescribir]: 's4',
  [VEREDICTO_ROTULO.repensar]: 's2', [VEREDICTO_ROTULO.validar]: 'sm', [VEREDICTO_ROTULO.imagen]: 's6',
};
const parte = (n: number, de: number) => (de > 0 ? Math.round((n / de) * 1000) / 10 : 0);

export function veredictosDe(r: Resultado | null): AnilloAn | null {
  if (!r) return null;
  // «Validar (poco spend)» es el rótulo de la tab: en la lista, «Validar» (el porqué ya lo dice la tarjeta de la muestra).
  const nombre = (f: Resultado['filas'][number]) => (f.clave === SIN ? 'Sin veredicto' : f.etiqueta === VEREDICTO_ROTULO.validar ? 'Validar' : f.etiqueta);
  const filas = r.filas.map((f) => ({ clave: f.clave, nombre: nombre(f), n: enFila(r, f, 'guiones') ?? 0, tono: TONO_VEREDICTO[f.etiqueta] ?? 'sm' as Tono })).filter((f) => f.n > 0);
  const tot = filas.reduce((a, f) => a + f.n, 0);
  if (!tot) return { total: 0, gajos: [] };
  const gajos = filas.sort((a, b) => b.n - a.n).slice(0, 6).map((f) => ({ ...f, parte: parte(f.n, tot) }));
  return { total: tot, gajos };
}

/** La confianza, en su orden (de la que más se puede creer a la que menos), con la regla que la decide (las impresiones). */
const CONFIANZAS: ReadonlyArray<{ clave: string; tono: Tono; regla: string }> = [
  { clave: 'Alta', tono: 's1', regla: `≥${IMPR_ALTA / 1000} mil` },
  { clave: 'Media', tono: 's3', regla: `≥${IMPR_MEDIA / 1000} mil` },
  { clave: 'Baja', tono: 's2', regla: `<${IMPR_MEDIA / 1000} mil` },
];
export type MuestraAn = AnilloAn & { conMuestra: number | null };
export function muestraDe(r: Resultado | null): MuestraAn | null {
  if (!r) return null;
  const n = (clave: string) => { const f = r.filas.find((x) => x.clave === clave); return f ? enFila(r, f, 'guiones') ?? 0 : 0; };
  const tot = CONFIANZAS.reduce((a, c) => a + n(c.clave), 0);
  if (!tot) return { total: 0, gajos: [], conMuestra: null };
  const gajos = CONFIANZAS.map((c) => ({ clave: c.clave, nombre: c.clave, n: n(c.clave), parte: parte(n(c.clave), tot), tono: c.tono, regla: c.regla }));
  return { total: tot, gajos, conMuestra: Math.round(((n('Alta') + n('Media')) / tot) * 100) };
}

// ── «Campaign ROAS» → qué guion rinde más ───────────────────────────────────────────────────────────────────────
/** Cuántos guiones entran en la lista (los de Prism). */
export const FILAS_GANADORES = 6;
export type FilaGanador = { clave: string; nombre: string; valor: number; sobre: boolean; ancho: number };
export type GanadoresAn = { filas: FilaGanador[]; promedio: number | null; tope: number; meta: number | null };
/** El tope de la escala: un número entero un 25% arriba del máximo (Prism: 6.0 en una escala de 8). */
export const topeGanadores = (max: number) => (max >= 1 ? Math.ceil(max * 1.25) : topeDe(max * 1.25));

export function ganadoresDe(r: Resultado | null, promedio: number | null): GanadoresAn | null {
  if (!r) return null;
  const filas = r.filas
    .map((f) => ({ clave: f.clave, nombre: f.etiqueta, valor: enFila(r, f, 'agendas_1k') }))
    .filter((f): f is { clave: string; nombre: string; valor: number } => f.valor != null && f.clave !== SIN)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, FILAS_GANADORES);
  const tope = topeGanadores(Math.max(0, ...filas.map((f) => f.valor), promedio ?? 0));
  return {
    filas: filas.map((f) => ({ ...f, sobre: promedio != null && f.valor > promedio, ancho: tope > 0 ? Math.min(100, (f.valor / tope) * 100) : 0 })),
    promedio, tope, meta: promedio != null && tope > 0 ? Math.min(100, (promedio / tope) * 100) : null,
  };
}

// ── «Key metrics» → los tres costos ─────────────────────────────────────────────────────────────────────────────
export type IdNumero = 'cpa' | 'costo_cierre' | 'sin_retorno';
export type NumeroAn = { id: IdNumero; titulo: string; texto: string | null; cambio: Cambio | null; chispa: Array<number | null> | null; tono: Tono };
/** La curva chica de un número: los últimos 12 puntos de su evolución (el «12-step trend» de Prism), de 0 a 1. */
export function chispaDe(r: Resultado | null): Array<number | null> | null {
  const vs = (r?.serie ?? []).slice(-12).map((s) => num(s.valor));
  const con = vs.filter((v): v is number => v != null);
  if (con.length < 2) return null;
  const min = Math.min(...con), max = Math.max(...con);
  return vs.map((v) => (v == null ? null : max > min ? (v - min) / (max - min) : 0.5));
}
export function numerosDe(cpa: Resultado | null, cierre: Resultado | null, sinRetorno: Resultado | null): NumeroAn[] {
  const uno = (id: IdNumero, titulo: string, r: Resultado | null, metrica: string, tono: Tono): NumeroAn => {
    const v = total(r, metrica);
    return { id, titulo, texto: v != null ? plata(v) : null, cambio: cambio(v, anteriorDe(r, metrica), true), chispa: chispaDe(r), tono };
  };
  return [
    uno('cpa', 'Costo por agenda', cpa, 'cpa', 's1'),
    uno('costo_cierre', 'Costo por cierre', cierre, 'costo_cierre', 's2'),
    uno('sin_retorno', 'Sin retorno', sinRetorno, 'gasto', 's4'),
  ];
}

// ── «Platform health» → listos para escalar ─────────────────────────────────────────────────────────────────────
export type EscalarAn = {
  /** Cuántos guiones conviene escalar (el ancla de la hoja). */
  n: number | null;
  /** Qué parte de lo invertido (0 a 100) fue a los guiones que conviene escalar. */
  parte: number | null;
  invertido: number | null;
  porMil: number | null;
  cierres: number | null;
};
/** La fila «Escalar» de un resultado por veredicto, o undefined si no la hay. */
const filaEscalar = (r: Resultado) => r.filas.find((f) => f.clave === VEREDICTO_ROTULO.escalar || f.etiqueta === VEREDICTO_ROTULO.escalar);
/**
 * `veredicto`: los guiones por veredicto (el anillo «Qué hacer con cada uno»): cuántos hay para escalar sale de su fila «Escalar», y no
 * de otra pieza (5/11/2026: una hoja lleva hasta 14 paneles, y lo que se puede calcular se calcula acá). `porVeredicto`: lo invertido en
 * cada veredicto (la pieza «Lo invertido en cada veredicto»: un anillo lleva una sola métrica).
 */
export function escalarDe(veredicto: Resultado | null, porVeredicto: Resultado | null, apertura: Resultado | null): EscalarAn {
  const gastoTotal = total(porVeredicto, 'gasto');
  const fila = porVeredicto ? filaEscalar(porVeredicto) : undefined;
  const gastoEscalar = porVeredicto ? (fila ? enFila(porVeredicto, fila, 'gasto') ?? 0 : 0) : null;
  const filaN = veredicto ? filaEscalar(veredicto) : undefined;
  const invertido = total(apertura, 'gasto'), agendas = total(apertura, 'agendas');
  return {
    n: veredicto ? (filaN ? enFila(veredicto, filaN, 'guiones') ?? 0 : 0) : null,
    parte: gastoTotal && gastoEscalar != null ? Math.round((gastoEscalar / gastoTotal) * 100) : null,
    invertido,
    porMil: invertido && agendas != null ? (agendas / invertido) * 1000 : null,
    cierres: total(apertura, 'cierres'),
  };
}
/** Las agendas por cada US$1.000 de TODOS los guiones: el promedio contra el que se mide cada uno. */
export const promedioPorMil = (apertura: Resultado | null): number | null => {
  const g = total(apertura, 'gasto'), a = total(apertura, 'agendas');
  return g && a != null ? (a / g) * 1000 : null;
};

// ── «Quarterly revenue» y «Active customers» → los seis meses cerrados ──────────────────────────────────────────
export const MESES_LARGOS = 6;
export type MesAn = { clave: string; rotulo: string; agendas: number; gasto: number; cambioGasto: string | null };
export type MesesAn = { meses: MesAn[]; cambioAgendas: string | null };
/** Los seis meses CERRADOS antes del de hoy (el mes en curso, a medias, contra uno entero mentiría). */
export function mesesDe(r: Resultado | null, hoy: string): MesesAn | null {
  if (!r) return null;
  const actual = `${hoy.slice(0, 7)}-01`;
  const cerrados = r.filas.filter((f) => f.clave < actual).slice(-MESES_LARGOS);
  const meses = cerrados.map((f, i, xs) => {
    const gasto = enFila(r, f, 'gasto') ?? 0, antes = i > 0 ? enFila(r, xs[i - 1], 'gasto') ?? 0 : null;
    const c = antes ? Math.round(((gasto - antes) / antes) * 100) : null;
    const [y, m] = f.clave.split('-');
    return { clave: f.clave, rotulo: `${MESES[Number(m) - 1]} '${y.slice(2)}`, agendas: enFila(r, f, 'agendas') ?? 0, gasto, cambioGasto: c == null ? null : `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c)}%` };
  });
  const a0 = meses[0]?.agendas ?? 0, a1 = meses[meses.length - 1]?.agendas ?? 0;
  const c = meses.length >= 2 && a0 > 0 ? Math.round(((a1 - a0) / a0) * 100) : null;
  return { meses, cambioAgendas: c == null ? null : `${c > 0 ? '+' : c < 0 ? '−' : ''}${Math.abs(c)}% en ${meses.length} meses` };
}

// ── «Signups & activations» → agendas y cierres por semana ──────────────────────────────────────────────────────
export const SEMANAS = 7;
/** Un tope con la mitad entera (2, 3, 4, 6, 8 o 10 por una potencia de 10): el eje dice el tope, la mitad y el cero, como Prism (20, 10, 0). */
export function topePar(max: number): number {
  if (max <= 2) return 2;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  for (const k of [2, 3, 4, 6, 8, 10]) if (k * p >= max) return k * p;
  return 20 * p;
}
export type SemanasAn = { semanas: Array<{ clave: string; rotulo: string; agendas: number; cierres: number }>; agendas: number | null; tasa: number | null; tope: number };
/** El lunes de la semana de un día (`YYYY-MM-DD`): la clave con que el Dashboard agrupa por semana. */
export function lunesDe(dia: string): string {
  const d = new Date(`${dia.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
/**
 * `r`: las agendas y los cierres POR DÍA (la pieza de la tarjeta de arriba): las semanas son la suma de sus días (5/11/2026: una hoja
 * lleva hasta 14 paneles, así que no se piden aparte). Los totales son los del período, como los de la pieza.
 */
export function semanasDe(r: Resultado | null): SemanasAn | null {
  if (!r) return null;
  const porSemana = new Map<string, { agendas: number; cierres: number }>();
  for (const f of r.filas) {
    const k = lunesDe(f.clave);
    const x = porSemana.get(k) ?? { agendas: 0, cierres: 0 };
    x.agendas += enFila(r, f, 'agendas') ?? 0;
    x.cierres += enFila(r, f, 'cierres') ?? 0;
    porSemana.set(k, x);
  }
  const semanas = [...porSemana].sort(([a], [b]) => a.localeCompare(b)).slice(-SEMANAS).map(([clave, x]) => ({ clave, rotulo: rotuloDia(clave), ...x }));
  const agendas = total(r, 'agendas'), cierres = total(r, 'cierres');
  return { semanas, agendas, tasa: agendas && cierres != null ? (cierres / agendas) * 100 : null, tope: topePar(Math.max(0, ...semanas.map((s) => Math.max(s.agendas, s.cierres)))) };
}

// ── «Checkout latency» → el gancho en el tiempo ─────────────────────────────────────────────────────────────────
export type LineaGancho = { id: 'hook_rate' | 'ret_cta' | 'thruplay_rate'; nombre: string; tono: Tono; valores: Array<number | null>; total: number | null };
export type GanchoAn = { lineas: LineaGancho[]; dias: string[]; meta: number; tope: number };
export function ganchoDe(r: Resultado | null): GanchoAn | null {
  if (!r) return null;
  const filas = r.filas.slice(-DIAS_AGENDAS);
  const linea = (id: LineaGancho['id'], nombre: string, tono: Tono): LineaGancho => ({ id, nombre, tono, valores: filas.map((f) => enFila(r, f, id)), total: total(r, id) });
  const lineas = [linea('hook_rate', 'Gancho', 's1'), linea('ret_cta', 'Llegan al llamado', 's2'), linea('thruplay_rate', 'ThruPlay', 's3')];
  const max = Math.max(HOOK_MID, ...lineas.flatMap((l) => l.valores.filter((v): v is number => v != null)));
  return { lineas, dias: filas.map((f) => rotuloDia(f.clave)), meta: HOOK_MID, tope: Math.ceil((max * 1.08) / 5) * 5 };
}

// ── «Feed» → el guion que más agendó ────────────────────────────────────────────────────────────────────────────
export type GanadorAn = { clave: string; nombre: string; agendas: number; cpa: number | null };
export function ganadorDe(r: Resultado | null): GanadorAn | null {
  if (!r) return null;
  const f = r.filas.find((x) => x.clave !== SIN && (enFila(r, x, 'agendas') ?? 0) > 0);
  return f ? { clave: f.clave, nombre: f.etiqueta, agendas: enFila(r, f, 'agendas') ?? 0, cpa: enFila(r, f, 'cpa') } : null;
}

// ── la hoja entera ──────────────────────────────────────────────────────────────────────────────────────────────
export type VistaAnuncio = {
  agendas: AgendasAn | null;
  veredictos: AnilloAn | null;
  muestra: MuestraAn | null;
  ganadores: GanadoresAn | null;
  numeros: NumeroAn[];
  escalar: EscalarAn;
  meses: MesesAn | null;
  semanas: SemanasAn | null;
  gancho: GanchoAn | null;
  ganador: GanadorAn | null;
  /** Lo que todavía se está leyendo (la tarjeta muestra su esqueleto). */
  cargando: boolean;
  /** Si no hay ni un guion analizado: la hoja lo dice y lleva a Ads Writer. */
  vacia: boolean;
};

export function vistaAnuncio(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, hoy: string): VistaAnuncio {
  const p = hoja.diseno?.piezas ?? {};
  const r = (k: string) => res(datos, p[k]);
  const apertura = r('apertura'), veredicto = r('veredicto');
  const veredictos = veredictosDe(veredicto);
  return {
    agendas: agendasDe(r('dia')),
    veredictos,
    muestra: muestraDe(r('confianza')),
    ganadores: ganadoresDe(r('ganadores'), promedioPorMil(r('ganadores')) ?? promedioPorMil(apertura)),
    numeros: numerosDe(r('cpa'), r('cierre'), r('sinretorno')),
    escalar: escalarDe(veredicto, r('invertido'), apertura),
    meses: mesesDe(r('meses'), hoy),
    semanas: semanasDe(r('dia')),
    gancho: ganchoDe(r('gancho')),
    ganador: ganadorDe(r('guiones')),
    cargando: Object.values(p).some((id) => datos[id]?.cargando),
    vacia: veredictos != null && veredictos.total === 0,
  };
}

// =============================================================================
// vsl-diseno — lo que dibuja la hoja «VSL y YouTube» con su DISEÑO PROPIO (la copia de Pelago), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación con
// Maco... copiarlo todo, desde las animaciones de entrada, las animaciones de hover, las animaciones de clic». La copia y sus capturas
// están en docs/diseno/mockups-dashboard/vsl-pelago/; aquí, de dónde sale cada número con los DATOS REALES: los componentes de la hoja
// (`hoja.diseno.piezas`, lib/graficos-plantillas-analysts.ts, VSL), del video de ventas que mide el Pixel y de los leads que pasaron por
// tu página. La pregunta de la hoja es «¿quién llega al final, y ésos compran más?»:
//   · la cabecera → cuántos le dieron play, cuántos lo vieron entero y cuánto agendan los que vieron más de la mitad;
//   · «Revenue» → cuántos le dieron play, día por día (el último es hoy), qué parte llega al final, a la mitad o se va antes, y las
//     vistas del VSL, el costo por vista y los que agendaron;
//   · «Today, by the hour» → dónde se van: la curva del video como rayos de un reloj (arriba el inicio y el final, a la derecha el 25%,
//     abajo la mitad, a la izquierda el 75%); el rayo de color es donde más gente se va;
//   · «From the kiln» → tus videos, del más visto al menos visto;
//   · «Demand by category» → ¿los que más ven, más agendan?: los leads de cada tramo de lo que vieron, partidos en los que compraron,
//     los que agendaron y los que no; el riel y el panel dicen el tramo elegido;
//   · «Latest orders» → los últimos días: los play y cuántos pasan un cuarto, la mitad y el final;
//   · «Best sellers» → dónde más se van, los seis tramos del video que más gente pierden;
//   · «Where each $100 goes» → de cada 100 que le dan play, en qué parte se va cada uno y cuántos llegan al final;
//   · «Activity» → lo que escribió MaKo sobre tu video (la caja de IA de la hoja, que nunca corre al abrir).
//
// LO QUE PELAGO TIENE Y MaKo NO MIDE NO SE INVENTA: el rango de 7 y 30 días y el mes (el período es el de la hoja), la comparación
// contra el año pasado y el ritmo del mes, el cambio contra el período anterior del número grande (cada comparación es otra lectura de
// los eventos del video, lo más pesado del Dashboard), las fotos de producto y la actividad de un equipo. La retención es por CORTES de
// 5% del avance máximo de cada persona (el resumen del Pixel), no segundo a segundo.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaVsl.tsx) y el test. Lo que no llegó es `null`, nunca un
// cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { TRAMOS_VISTO } from './graficos-datos-puro';
import { entero, plata, rotuloDia } from './marketing-diseno';

export type { DatosPieza };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const SIN = '(sin dato)';
const parte = (n: number | null, de: number | null): number | null => (n == null || !de ? null : (n / de) * 100);

/** «22%», o «6.4%» debajo de 10 (una parte chica sin decimal se lee como cero). */
export const pct = (v: number) => (Math.abs(v) < 10 && Math.round(v) !== v ? `${(Math.round(v * 10) / 10).toFixed(1)}%` : `${Math.round(v)}%`);
/** «1.2k», «9,201»: lo grande en corto, como el «$55,239» de Pelago pero de personas. */
export const corto = (n: number) => (Math.abs(n) >= 10_000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : entero(n));

// ── «Revenue» → le dieron play ───────────────────────────────────────────────────────────────────────────────────────
/** Cuántos días dibuja la tarjeta de arriba (Pelago dibuja 30). */
export const DIAS_PLAY = 30;
export type DiaVsl = { clave: string; rotulo: string; play: number | null; medidos: number | null; p25: number | null; p50: number | null; p75: number | null; final: number | null };
export type MezclaVsl = { final: number; mitad: number; antes: number };
export type PlayVsl = {
  total: number | null;
  /** Los últimos días del período, del más viejo al de hoy (el último se pinta distinto). */
  dias: DiaVsl[];
  tope: number;
  /** De los que dejaron un avance medible: qué parte llega al final, cuál pasa la mitad sin llegar, y cuál se va antes. */
  mezcla: MezclaVsl | null;
  /** Los que llegan al final, en %, sobre los medidos (la pastilla del número grande). */
  tasaFinal: number | null;
};
export function diasDe(r: Resultado | null): DiaVsl[] {
  if (!r) return [];
  return r.filas.filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f.clave)).map((f) => ({
    clave: f.clave, rotulo: rotuloDia(f.clave), play: enFila(r, f, 'arrancaron'), medidos: enFila(r, f, 'medidos'),
    p25: enFila(r, f, 'pasaron_25'), p50: enFila(r, f, 'pasaron_50'), p75: enFila(r, f, 'pasaron_75'), final: enFila(r, f, 'llegaron_final'),
  })).sort((a, b) => a.clave.localeCompare(b.clave));
}
export function playDe(dia: Resultado | null, apertura: Resultado | null): PlayVsl {
  const dias = diasDe(dia).slice(-DIAS_PLAY);
  const medidos = total(dia, 'medidos'), p50 = total(dia, 'pasaron_50'), fin = total(dia, 'llegaron_final');
  const max = Math.max(0, ...dias.map((d) => d.play ?? 0));
  const mezcla = medidos && p50 != null && fin != null
    ? { final: (fin / medidos) * 100, mitad: (Math.max(0, p50 - fin) / medidos) * 100, antes: (Math.max(0, medidos - p50) / medidos) * 100 }
    : null;
  return { total: total(dia, 'arrancaron') ?? total(apertura, 'arrancaron'), dias, tope: max > 0 ? max : 1, mezcla, tasaFinal: parte(fin, medidos) };
}

// ── «Today, by the hour» → dónde se van ──────────────────────────────────────────────────────────────────────────────
export type CorteVsl = { corte: number; siguen: number | null; /** Lo que se fue desde el corte anterior (en puntos de 100). */ caida: number | null };
export type CurvaVsl = { cortes: CorteVsl[]; /** El índice del corte donde más gente se va (el rayo de color), o −1. */ fuga: number };
export function curvaDe(r: Resultado | null): CurvaVsl | null {
  if (!r) return null;
  const porCorte = new Map(r.filas.map((f) => [Number(f.clave), enFila(r, f, 'siguen')]));
  const cortes: CorteVsl[] = [];
  let antes: number | null = 100;
  for (let c = 5; c <= 100; c += 5) {
    const s = porCorte.get(c) ?? null;
    cortes.push({ corte: c, siguen: s, caida: s != null && antes != null ? Math.max(0, antes - s) : null });
    antes = s;
  }
  if (cortes.every((c) => c.siguen == null)) return null;
  const fuga = cortes.reduce((m, c, i) => ((c.caida ?? -1) > (m >= 0 ? cortes[m].caida ?? -1 : -1) ? i : m), -1);
  return { cortes, fuga };
}
/** El largo de un rayo (px): 11 sin nadie, hasta 38 con todos (el más largo de Pelago mide ~37). */
export const largoRayo = (siguen: number) => 11 + 0.27 * Math.max(0, Math.min(100, siguen));
/** Dónde más se van: los tramos del video que más gente pierden, del que más al que menos (Pelago dibuja seis «best sellers»). */
export const FUGAS = 6;
export type FugaVsl = { desde: number; hasta: number; caida: number; siguen: number; ancho: number };
export function fugasDe(c: CurvaVsl | null): FugaVsl[] | null {
  if (!c) return null;
  const f = c.cortes.filter((x) => x.caida != null && x.siguen != null && (x.caida ?? 0) > 0)
    .map((x) => ({ desde: x.corte - 5, hasta: x.corte, caida: x.caida!, siguen: x.siguen! }))
    .sort((a, b) => b.caida - a.caida || a.desde - b.desde).slice(0, FUGAS);
  const max = Math.max(1e-9, ...f.map((x) => x.caida));
  return f.map((x) => ({ ...x, ancho: x.caida / max }));
}

// ── «Demand by category» → ¿los que más ven, más agendan? ────────────────────────────────────────────────────────────
export type TramoVsl = {
  clave: string; nombre: string; corto: string;
  leads: number; agendas: number; cierres: number;
  /** De los leads de ese tramo, cuántos agendaron (%), o null sin leads. */
  tasa: number | null;
};
export type TramosVsl = {
  /** En el orden del gráfico: de «No lo vio» a «75-100%» (de izquierda a derecha, como los meses de Pelago). */
  tramos: TramoVsl[];
  todos: Omit<TramoVsl, 'clave' | 'nombre' | 'corto'>;
  /** El tramo que más agenda (con al menos un lead), o null. */
  mejor: TramoVsl | null;
};
const NOMBRE_TRAMO: Readonly<Record<string, [string, string]>> = {
  'No lo vio': ['No lo vio', 'Nada'], 'Sin medir': ['Le dio play, sin medir', 'Sin medir'],
  '0-25%': ['Vio menos de un cuarto', '0-25%'], '25-50%': ['Vio hasta la mitad', '25-50%'], '50-75%': ['Vio más de la mitad', '50-75%'], '75-100%': ['Lo vio casi entero', '75-100%'],
};
export function tramosDe(r: Resultado | null): TramosVsl | null {
  if (!r) return null;
  const tramos = (TRAMOS_VISTO as readonly string[]).map((k) => {
    const f = r.filas.find((x) => x.clave === k);
    const leads = f ? enFila(r, f, 'leads') ?? 0 : 0, agendas = f ? enFila(r, f, 'agendas') ?? 0 : 0, cierres = f ? enFila(r, f, 'cierres') ?? 0 : 0;
    const [nombre, c] = NOMBRE_TRAMO[k] ?? [k, k];
    return { clave: k, nombre, corto: c, leads, agendas, cierres, tasa: leads ? (agendas / leads) * 100 : null };
  });
  const leads = tramos.reduce((a, t) => a + t.leads, 0), agendas = tramos.reduce((a, t) => a + t.agendas, 0), cierres = tramos.reduce((a, t) => a + t.cierres, 0);
  const conLeads = tramos.filter((t) => t.leads > 0);
  const mejor = conLeads.length ? conLeads.reduce((m, t) => ((t.tasa ?? -1) > (m.tasa ?? -1) ? t : m)) : null;
  return { tramos, todos: { leads, agendas, cierres, tasa: leads ? (agendas / leads) * 100 : null }, mejor };
}
/** Los que vieron más de la mitad (50-75% y 75-100%) contra los que no lo vieron: lo que contesta la pregunta de la hoja. */
export type RespuestaVsl = { mitad: number | null; nada: number | null; leadsMitad: number };
export function respuestaDe(t: TramosVsl | null): RespuestaVsl | null {
  if (!t) return null;
  const mas = t.tramos.filter((x) => x.clave === '50-75%' || x.clave === '75-100%');
  const leads = mas.reduce((a, x) => a + x.leads, 0), agendas = mas.reduce((a, x) => a + x.agendas, 0);
  const nada = t.tramos.find((x) => x.clave === 'No lo vio');
  return { mitad: leads ? (agendas / leads) * 100 : null, nada: nada && nada.leads ? nada.tasa : null, leadsMitad: leads };
}
/** Los tres pisos de una columna, de abajo arriba: no agendaron, agendaron sin comprar y compraron. Un cierre sin agenda cuenta como
 *  compra, y nada pasa de los leads del tramo (la pila nunca es más alta que la columna). */
export type PilaVsl = { nada: number; agendo: number; compro: number };
export function pilaDe(t: Pick<TramoVsl, 'leads' | 'agendas' | 'cierres'>): PilaVsl {
  const leads = Math.max(0, t.leads), compro = Math.min(Math.max(0, t.cierres), leads), conAgenda = Math.min(Math.max(t.agendas, compro), leads);
  return { nada: leads - conAgenda, agendo: conAgenda - compro, compro };
}
/** El cambio del tramo elegido contra todos, en puntos: «+29 pts» (bueno si agenda más que el promedio). */
export function contraTodos(t: TramoVsl, todos: TramosVsl['todos']): { texto: string; bueno: boolean } | null {
  if (t.tasa == null || todos.tasa == null) return null;
  const d = Math.round(t.tasa - todos.tasa);
  return d === 0 ? { texto: 'igual que todos', bueno: true } : { texto: `${d > 0 ? '+' : '−'}${Math.abs(d)} pts vs todos`, bueno: d > 0 };
}

// ── «From the kiln» → tus videos ─────────────────────────────────────────────────────────────────────────────────────
/** Cuántos videos se dibujan (Pelago dibuja tres y tres). */
export const VIDEOS = 6;
export type VideoVsl = { clave: string; nombre: string; play: number; t25: number | null; t50: number | null; tFinal: number | null };
export function videosDe(r: Resultado | null): { filas: VideoVsl[]; total: number } | null {
  if (!r) return null;
  const todas = r.filas.filter((f) => f.clave !== SIN).map((f) => ({
    clave: f.clave, nombre: f.etiqueta || f.clave, play: enFila(r, f, 'arrancaron') ?? 0,
    t25: enFila(r, f, 'tasa_25'), t50: enFila(r, f, 'tasa_50'), tFinal: enFila(r, f, 'tasa_final'),
  })).filter((v) => v.play > 0).sort((a, b) => b.play - a.play);
  return { filas: todas.slice(0, VIDEOS), total: todas.length + r.fuera };
}

// ── «Latest orders» → los últimos días ──────────────────────────────────────────────────────────────────────────────
/** Cuántos días lista la tabla (Pelago lista seis pedidos). */
export const DIAS_TABLA = 6;
export type FilaDiaVsl = { clave: string; rotulo: string; play: number; t25: number | null; t50: number | null; tFinal: number | null };
export function ultimosDiasDe(dias: DiaVsl[]): FilaDiaVsl[] {
  return dias.filter((d) => (d.play ?? 0) > 0).slice(-DIAS_TABLA).reverse().map((d) => ({
    clave: d.clave, rotulo: d.rotulo, play: d.play ?? 0, t25: parte(d.p25, d.medidos), t50: parte(d.p50, d.medidos), tFinal: parte(d.final, d.medidos),
  }));
}
/** «hoy», «ayer», «hace 3 días»: lo de abajo del día en la tabla. */
export function haceCuanto(clave: string, hoy: string): string {
  const d = Math.round((Date.parse(`${hoy}T12:00:00Z`) - Date.parse(`${clave.slice(0, 10)}T12:00:00Z`)) / 864e5);
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`;
}

// ── «Where each $100 goes» → de cada 100 que le dan play ─────────────────────────────────────────────────────────────
export type TrozoCien = { id: 'q1' | 'q2' | 'q3' | 'q4' | 'final'; nombre: string; valor: number };
export type CienVsl = { final: number; trozos: TrozoCien[] };
/** De los medidos: se van antes de un cuarto, entre un cuarto y la mitad, entre la mitad y tres cuartos, de ahí al final, y llegan. */
export function cienDe(dia: Resultado | null): CienVsl | null {
  const m = total(dia, 'medidos'), p25 = total(dia, 'pasaron_25'), p50 = total(dia, 'pasaron_50'), p75 = total(dia, 'pasaron_75'), f = total(dia, 'llegaron_final');
  if (!m || p25 == null || p50 == null || p75 == null || f == null) return null;
  const c = (n: number) => Math.max(0, (n / m) * 100);
  const trozos: TrozoCien[] = [
    { id: 'q1', nombre: 'Se van antes del 25%', valor: c(m - p25) },
    { id: 'q2', nombre: 'Del 25% al 50%', valor: c(p25 - p50) },
    { id: 'q3', nombre: 'Del 50% al 75%', valor: c(p50 - p75) },
    { id: 'q4', nombre: 'Del 75% al final', valor: c(p75 - f) },
    { id: 'final', nombre: 'Llegan al final', valor: c(f) },
  ];
  return { final: c(f), trozos };
}
/** Los trozos redondeados que suman 100 (el método del resto mayor): «38 de cada 100», sin que la leyenda sume 99 o 101. */
export function enteros(valores: number[]): number[] {
  const piso = valores.map((v) => Math.floor(v));
  let falta = 100 - piso.reduce((a, b) => a + b, 0);
  const orden = valores.map((v, i) => ({ i, r: v - Math.floor(v) })).sort((a, b) => b.r - a.r);
  for (const { i } of orden) { if (falta <= 0) break; piso[i] += 1; falta -= 1; }
  return piso;
}

// ── los tres números de abajo de «Revenue» ───────────────────────────────────────────────────────────────────────────
export type NumeroVsl = { id: 'vistas' | 'costo' | 'agendaron'; nombre: string; texto: string | null };
export function numerosDe(vistas: Resultado | null, costo: Resultado | null, agendaron: Resultado | null): NumeroVsl[] {
  const v = total(vistas, 'vistas_vsl'), c = total(costo, 'costo_vsl'), a = total(agendaron, 'agendaron');
  return [
    { id: 'vistas', nombre: 'Vistas del VSL', texto: v == null ? null : corto(v) },
    { id: 'costo', nombre: 'Costo por vista', texto: c == null ? null : plata(c) },
    { id: 'agendaron', nombre: 'Agendaron', texto: a == null ? null : entero(a) },
  ];
}

// ── la hoja entera ──────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaVsl = {
  apertura: { play: number | null; final: number | null };
  play: PlayVsl;
  numeros: NumeroVsl[];
  curva: CurvaVsl | null;
  /** Los que llegan al final (%), del número de la hoja: el centro del reloj. */
  tasaFinal: number | null;
  tramos: TramosVsl | null;
  respuesta: RespuestaVsl | null;
  videos: { filas: VideoVsl[]; total: number } | null;
  ultimos: FilaDiaVsl[];
  fugas: FugaVsl[] | null;
  cien: CienVsl | null;
  /** Lo que todavía se está leyendo (la tarjeta muestra su esqueleto). */
  cargando: boolean;
  /** Si nadie le dio play y no hay leads que hayan pasado por la página: la hoja lo dice y lleva a tu página. */
  vacia: boolean;
};
export function vistaVsl(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>): VistaVsl {
  const p = hoja.diseno?.piezas ?? {};
  const r = (k: string) => res(datos, p[k]);
  const play = playDe(r('dia'), r('apertura'));
  const curva = curvaDe(r('curva'));
  const tramos = tramosDe(r('tramos'));
  const finalPieza = total(r('final'), 'tasa_final');
  const apertura = { play: total(r('apertura'), 'arrancaron') ?? play.total, final: total(r('apertura'), 'llegaron_final') ?? total(r('dia'), 'llegaron_final') };
  // Vacía: nadie le dio play (el número dice 0) y los leads que pasaron por la página llegaron sin ninguno. Lo que no llegó no la vacía.
  const vacia = apertura.play === 0 && tramos != null && tramos.todos.leads === 0;
  return {
    apertura,
    play,
    numeros: numerosDe(r('vistas'), r('costo'), r('agendaron')),
    curva,
    tasaFinal: finalPieza ?? play.tasaFinal,
    tramos,
    respuesta: respuestaDe(tramos),
    videos: videosDe(r('videos')),
    ultimos: ultimosDiasDe(diasDe(r('dia'))),
    fugas: fugasDe(curva),
    cien: cienDe(r('dia')),
    cargando: Object.entries(p).some(([k, id]) => k !== 'ia' && datos[id]?.cargando),
    vacia,
  };
}

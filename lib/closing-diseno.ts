// =============================================================================
// closing-diseno — lo que dibuja la hoja Closing con su DISEÑO PROPIO (la copia de Halden), sacado de sus piezas
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la
// adaptación con Maco». La copia y la adaptación están en docs/diseno/mockups-dashboard/closing/; acá, de dónde sale cada
// número con los DATOS REALES: los de los componentes de la hoja (los mismos de la grilla), que el diseño encuentra por
// las piezas de `hoja.diseno` (lib/graficos-catalogo.ts), más la agenda de las llamadas que vienen
// (lib/closing-diseno-server.ts), que ningún componente lee.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaClosing.tsx) y el test. Un dato que no llegó
// es `null`, nunca un cero: el bloque dice que no hay, no inventa.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import { estadoDeLlamada, type LlamadaDeVenta } from './calendario-llamadas';

/** Lo que la pantalla tiene de cada gráfico: cargando, el resultado o el error. */
export type DatosPieza = { cargando?: boolean; resultado?: Resultado | null; error?: string } | undefined;

/** La llamada que sigue en la agenda del CRM (la R1 o la R2 de un lead). */
export type ProximaLlamada = { nombre: string; cual: 'R1' | 'R2'; inicio: string; diaCompleto: boolean; closer: string | null; leadId: number };
/** Lo que el diseño lee de la agenda: cuántas hay agendadas por día (hacia adelante) y la próxima. */
export type AgendaClosing = { porDia: Record<string, number>; proxima: ProximaLlamada | null; /** La zona del negocio («En 2 h», «Mañana»). */ tz: string };

export type Segmento = { id: 'r1' | 'r2' | 'sin' | 'perdida'; nombre: string; n: number; pct: number };
export type DiaSemana = { dia: string; etiqueta: string; valor: number | null; tipo: 'hecho' | 'hoy' | 'agenda' };
export type FilaLlamada = { clave: string; ref: string | null; nombre: string; reunion: string | null; closer: string | null; dia: string | null; puntaje: number | null; duracion: number | null };
export type FilaCloser = { nombre: string; tasa: number | null; ganadas: number | null; llamadas: number | null };

export type VistaClosing = {
  tasa: { valor: number | null; anterior: number | null; delta: number | null };
  cierres: { ganadas: number | null; de: number | null };
  stats: { analizadas: number | null; puntaje: number | null; ganadas: number | null };
  desenlace: { llamadas: number | null; ganadas: number | null; perdidas: number | null; segmentos: Segmento[] } | null;
  semana: { dias: DiaSemana[]; hechas: number; agendadas: number } | null;
  ultimas: FilaLlamada[];
  closers: FilaCloser[];
  duracion: { minutos: number | null; llamadas: number | null };
  proxima: ProximaLlamada | null;
};

const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** El total de la métrica `metrica` de un resultado (por el id de su columna). */
function total(r: Resultado | null, metrica: string): number | null {
  if (!r) return null;
  const i = r.columnas.findIndex((c) => c.id === metrica);
  return i < 0 ? null : num(r.totales[i]);
}
function anteriorDe(r: Resultado | null, metrica: string): number | null {
  if (!r?.anterior) return null;
  const i = r.columnas.findIndex((c) => c.id === metrica);
  return i < 0 ? null : num(r.anterior[i]);
}

/** El lunes de la semana de `dia` (YYYY-MM-DD), como Halden: la semana va de lunes a domingo. */
export function lunesDe(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`);
  const desde = (d.getUTCDay() + 6) % 7; // lunes = 0
  d.setUTCDate(d.getUTCDate() - desde);
  return d.toISOString().slice(0, 10);
}
const sumar = (dia: string, n: number): string => { const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ETIQUETAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/** El día (YYYY-MM-DD) de un instante en la zona del negocio. */
export const diaEnZona = (iso: string, tz: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

/**
 * La semana como las barras de Halden: lo que ya pasó (y hoy) con las llamadas ANALIZADAS de ese día; lo que viene,
 * rayado, con las AGENDADAS. Sin la pieza `semana` no hay barras (null); sin agenda, los días que vienen van vacíos.
 */
export function semanaDe(r: Resultado | null, agenda: AgendaClosing | null, hoy: string): VistaClosing['semana'] {
  if (!r) return null;
  const porDia = new Map<string, number | null>();
  for (const f of r.filas) porDia.set(f.clave, num(f.valores[0]));
  const lunes = lunesDe(hoy);
  let hechas = 0, agendadas = 0;
  const dias: DiaSemana[] = ETIQUETAS.map((etiqueta, i) => {
    const dia = sumar(lunes, i);
    if (dia <= hoy) {
      const v = porDia.get(dia) ?? 0;
      hechas += v ?? 0;
      return { dia, etiqueta, valor: v, tipo: dia === hoy ? 'hoy' : 'hecho' };
    }
    const v = agenda ? agenda.porDia[dia] ?? 0 : null;
    agendadas += v ?? 0;
    return { dia, etiqueta, valor: v, tipo: 'agenda' };
  });
  return { dias, hechas, agendadas };
}

/** Cómo terminaron: ganada en la R1, ganada en la R2, sin decisión y perdida. Los tramos en cero no se dibujan. */
export function desenlaceDe(r: Resultado | null): VistaClosing['desenlace'] {
  if (!r) return null;
  const llamadas = total(r, 'llamadas'), ganadas = total(r, 'ganadas'), r2 = total(r, 'ganadas_r2'), perdidas = total(r, 'perdidas');
  if (llamadas == null) return { llamadas: null, ganadas, perdidas, segmentos: [] };
  const g2 = Math.min(r2 ?? 0, ganadas ?? 0);
  const g1 = Math.max(0, (ganadas ?? 0) - g2);
  const p = Math.max(0, perdidas ?? 0);
  const sin = Math.max(0, llamadas - g1 - g2 - p);
  const base = g1 + g2 + sin + p;
  const pct = (n: number) => (base ? Math.round((n / base) * 100) : 0);
  const segmentos: Segmento[] = [
    { id: 'r1' as const, nombre: 'Cerró en la R1', n: g1, pct: pct(g1) },
    { id: 'r2' as const, nombre: 'Cerró en la R2', n: g2, pct: pct(g2) },
    { id: 'sin' as const, nombre: 'Sin decisión', n: sin, pct: pct(sin) },
    { id: 'perdida' as const, nombre: 'Perdida', n: p, pct: pct(p) },
  ].filter((s) => s.n > 0);
  return { llamadas, ganadas, perdidas, segmentos };
}

/** Las últimas llamadas: la tabla de los últimos 14 días, de la más nueva a la más vieja. */
/**
 * El día de una fila a partir de su columna `dia`: el agregador la escribe como su ETIQUETA («03/11», `etiquetaTiempo`), sin
 * año. Se lo pone el de hoy, o el anterior si esa fecha cae después de hoy (una tabla de los últimos días no mira al futuro).
 * ⚠️ Ordenar las etiquetas como texto ponía el 28/10 después del 03/11 (bug de «Últimas llamadas», 4/11/2026).
 */
export function diaDeEtiqueta(etiqueta: string | null | undefined, hoy: string): string | null {
  if (!etiqueta) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(etiqueta)) return etiqueta.slice(0, 10);
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(etiqueta.trim());
  if (!m) return null;
  const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0');
  const y = Number(hoy.slice(0, 4));
  const conAnio = `${y}-${mm}-${dd}`;
  return conAnio > hoy ? `${y - 1}-${mm}-${dd}` : conAnio;
}

export function ultimasDe(r: Resultado | null, max = 5, hoy?: string): FilaLlamada[] {
  if (!r) return [];
  const dia = (et: string | null) => (hoy ? diaDeEtiqueta(et, hoy) : et);
  const iP = r.columnas.findIndex((c) => c.id === 'puntaje'), iD = r.columnas.findIndex((c) => c.id === 'duracion');
  return r.filas
    .map((f) => ({
      clave: f.clave, ref: f.ref ?? null, nombre: f.etiqueta, reunion: f.extra?.reunion ?? null, closer: f.extra?.closer ?? null, dia: dia(f.extra?.dia ?? null),
      puntaje: iP < 0 ? null : num(f.valores[iP]), duracion: iD < 0 ? null : num(f.valores[iD]),
    }))
    .sort((a, b) => (b.dia ?? '').localeCompare(a.dia ?? ''))
    .slice(0, max);
}

/** Cada closer con su tasa de cierre, de la más alta a la más baja (los sin tasa, al final). */
export function closersDe(r: Resultado | null, max = 5): FilaCloser[] {
  if (!r) return [];
  const i = (m: string) => r.columnas.findIndex((c) => c.id === m);
  const iT = i('tasa_cierre'), iG = i('ganadas'), iL = i('llamadas');
  return r.filas
    .filter((f) => f.etiqueta && f.clave !== '(sin dato)')
    .map((f) => ({ nombre: f.etiqueta, tasa: iT < 0 ? null : num(f.valores[iT]), ganadas: iG < 0 ? null : num(f.valores[iG]), llamadas: iL < 0 ? null : num(f.valores[iL]) }))
    .sort((a, b) => (b.tasa ?? -1) - (a.tasa ?? -1))
    .slice(0, max);
}

/** Todo lo que dibuja la hoja, de sus piezas. */
export function vistaClosing(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, agenda: AgendaClosing | null, hoy: string): VistaClosing {
  const p = hoja.diseno?.piezas ?? {};
  const tasaR = res(datos, p.tasa);
  const valor = total(tasaR, 'tasa_cierre');
  const anterior = anteriorDe(tasaR, 'tasa_cierre');
  const embudo = res(datos, p.embudo);
  const desenlace = desenlaceDe(res(datos, p.desenlace));
  const analizadas = total(res(datos, p.analizadas), 'llamadas');
  const duracion = total(res(datos, p.duracion), 'duracion');
  return {
    tasa: { valor, anterior, delta: valor != null && anterior != null ? Math.round(valor - anterior) : null },
    cierres: { ganadas: total(embudo, 'ganadas_r2'), de: total(embudo, 'r2') },
    stats: { analizadas, puntaje: total(res(datos, p.puntaje), 'puntaje'), ganadas: desenlace?.ganadas ?? null },
    desenlace,
    semana: semanaDe(res(datos, p.semana), agenda, hoy),
    ultimas: ultimasDe(res(datos, p.ultimas), 5, hoy),
    closers: closersDe(res(datos, p.closers)),
    duracion: { minutos: duracion, llamadas: analizadas },
    proxima: agenda?.proxima ?? null,
  };
}

/** El día de una llamada, dicho como lo dice la tarjeta: «Hoy», «Mañana» o el día de la semana con su número («jue 6»). */
export function rotuloDelDia(iso: string, hoy: string, tz: string): string {
  const dia = diaEnZona(iso, tz);
  if (dia === hoy) return 'Hoy';
  if (dia === sumar(hoy, 1)) return 'Mañana';
  return new Intl.DateTimeFormat('es-MX', { timeZone: tz, weekday: 'short', day: 'numeric' }).format(new Date(iso)).replace(/\.|,/g, '');
}

/** «En 2 h 15 min», «En 25 min», «Mañana», o null si ya empezó. Sin hora cargada, el día. */
export function cuandoEs(p: Pick<ProximaLlamada, 'inicio' | 'diaCompleto'>, ahoraMs: number, hoy: string, tz: string): string | null {
  const t = Date.parse(p.inicio);
  if (!Number.isFinite(t)) return null;
  const dia = diaEnZona(p.inicio, tz);
  if (p.diaCompleto) return dia === hoy ? 'Hoy' : dia === sumar(hoy, 1) ? 'Mañana' : null;
  const min = Math.round((t - ahoraMs) / 60000);
  if (min < 0) return null;
  if (min < 60) return `En ${min} min`;
  if (dia !== hoy) return dia === sumar(hoy, 1) ? 'Mañana' : null;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `En ${h} h ${m} min` : `En ${h} h`;
}

/**
 * La agenda que lee el diseño, de las llamadas de venta del CRM (las mismas del Calendario, `leerLlamadasDeVenta`):
 * cuántas quedan AGENDADAS por día después de hoy (las barras rayadas) y la próxima que todavía no empezó. Una
 * cancelada, una que ya pasó o una marcada no cuentan.
 */
export function agendaDe(lista: readonly LlamadaDeVenta[], hoy: string, tz: string, ahoraIso: string): AgendaClosing {
  const porDia: Record<string, number> = {};
  let proxima: LlamadaDeVenta | null = null;
  const ahora = Date.parse(ahoraIso);
  for (const l of lista) {
    if (estadoDeLlamada(l, ahoraIso) !== 'agendada') continue;
    const dia = diaEnZona(l.inicio, tz);
    if (dia > hoy) porDia[dia] = (porDia[dia] ?? 0) + 1;
    // La próxima: la primera que todavía no empezó (una de día completo cuenta desde el comienzo de su día).
    if (Date.parse(l.inicio) >= ahora || (l.diaCompleto && dia >= hoy)) {
      if (!proxima || Date.parse(l.inicio) < Date.parse(proxima.inicio)) proxima = l;
    }
  }
  const p = proxima as LlamadaDeVenta | null;
  return {
    porDia, tz,
    proxima: p ? { nombre: p.nombre, cual: p.cual, inicio: p.inicio, diaCompleto: p.diaCompleto, closer: p.closer, leadId: p.leadId } : null,
  };
}

/** La duración promedio (minutos) como el reloj de Halden: [hh, mm, ss]. */
export function relojDe(minutos: number | null): [number, number, number] {
  const s = Math.max(0, Math.round((minutos ?? 0) * 60));
  return [Math.floor(s / 3600) % 100, Math.floor((s % 3600) / 60), s % 60];
}

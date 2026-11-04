// =============================================================================
// cobranza-diseno — lo que dibuja la hoja Cobranza con su DISEÑO PROPIO (la copia de Coffer), sacado de sus piezas
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la
// adaptación con Maco». La copia y la adaptación están en docs/diseno/mockups-dashboard/cobranza/; acá, de dónde sale cada
// número con los DATOS REALES: los de los componentes de la hoja (los mismos de la grilla), que el diseño encuentra por las
// piezas de `hoja.diseno` (lib/graficos-plantillas-generales.ts, la plantilla «cobranza»).
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaCobranza.tsx) y el test. Un dato que no llegó es
// `null`, nunca un cero: el bloque dice que no hay, no inventa.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import { TRAMOS_ATRASO } from './graficos-datos-puro';
import { diaDeEtiqueta, type DatosPieza } from './closing-diseno';

export type { DatosPieza };

/** Un tramo de la barra de Coffer: lo que se debe con ese atraso, cuántas cuotas y su color. */
export type TramoAtraso = { nombre: (typeof TRAMOS_ATRASO)[number]; monto: number; cuotas: number; color: string };
export type Comparado = { valor: number | null; anterior: number | null };
export type MesFlujo = { clave: string; etiqueta: string; entro: number; sinPagar: number };
export type FilaPerseguir = { clave: string; nombre: string; cuota: string | null; dias: number | null; monto: number | null };
export type FilaCobro = { clave: string; nombre: string; cuota: string | null; dia: string | null; monto: number };
export type FilaMonto = { clave: string; nombre: string; monto: number };

export type VistaCobranza = {
  /** Lo que te deben, de la barra de atraso (todo lo que se debe hoy). null = sin la pieza o sin datos. */
  deben: { total: number; cuotas: number; clientes: number | null; vencido: number; vencidas: number; tramos: TramoAtraso[] } | null;
  cobrado: Comparado;
  vence: Comparado;
  falta: Comparado;
  /** Cuántos días después del vencimiento se cobra, en promedio (negativo = antes). */
  demora: Comparado;
  meses: MesFlujo[] | null;
  perseguir: FilaPerseguir[];
  ultimos: FilaCobro[];
  pagaron: FilaMonto[];
  funnel: { total: number; filas: FilaMonto[] } | null;
};

/** Los colores de los tramos en el DISEÑO, los de Coffer (medidos en su valores.json: --age0 a --age3). En la grilla van tokens. */
export const COLORES_COFFER: Readonly<Record<(typeof TRAMOS_ATRASO)[number], string>> = { 'Al día': '#3a4150', '1-30 días': '#d7a33c', '31-60 días': '#df6e2c', '60+ días': '#c0352f' };

const SIN_DATO = '(sin dato)';
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const col = (r: Resultado, metrica: string) => r.columnas.findIndex((c) => c.id === metrica);
function total(r: Resultado | null, metrica: string): number | null {
  if (!r) return null;
  const i = col(r, metrica);
  return i < 0 ? null : num(r.totales[i]);
}
function comparado(r: Resultado | null, metrica: string): Comparado {
  if (!r) return { valor: null, anterior: null };
  const i = col(r, metrica);
  return { valor: i < 0 ? null : num(r.totales[i]), anterior: i < 0 || !r.anterior ? null : num(r.anterior[i]) };
}
const filas = (r: Resultado | null) => (r ? r.filas.filter((f) => f.clave !== SIN_DATO && f.etiqueta) : []);

/** La barra de Coffer: los cuatro tramos SIEMPRE, en su orden (uno sin cuotas dice «0»), con lo que se debe en cada uno. */
export function debenDe(r: Resultado | null): VistaCobranza['deben'] {
  if (!r) return null;
  const iP = col(r, 'pendiente'), iC = col(r, 'pagos');
  if (iP < 0) return null;
  const por = new Map(r.filas.map((f) => [f.clave, f]));
  const tramos: TramoAtraso[] = TRAMOS_ATRASO.map((nombre) => {
    const f = por.get(nombre);
    return { nombre, monto: num(f?.valores[iP]) ?? 0, cuotas: iC < 0 ? 0 : num(f?.valores[iC]) ?? 0, color: COLORES_COFFER[nombre] };
  });
  const totalP = tramos.reduce((s, t) => s + t.monto, 0);
  const cuotas = tramos.reduce((s, t) => s + t.cuotas, 0);
  if (!cuotas && !totalP) return { total: 0, cuotas: 0, clientes: total(r, 'clientes') ?? 0, vencido: 0, vencidas: 0, tramos };
  const vencidos = tramos.slice(1);
  return {
    total: totalP, cuotas, clientes: total(r, 'clientes'),
    vencido: vencidos.reduce((s, t) => s + t.monto, 0), vencidas: vencidos.reduce((s, t) => s + t.cuotas, 0), tramos,
  };
}

/** El flujo de Coffer: de lo que vencía cada mes, lo que entró (arriba) y lo que sigue sin pagar (abajo). */
export function mesesDe(r: Resultado | null): MesFlujo[] | null {
  if (!r) return null;
  const iE = col(r, 'cobrado'), iS = col(r, 'pendiente');
  if (iE < 0 || iS < 0) return null;
  return r.filas.map((f) => ({ clave: f.clave, etiqueta: f.etiqueta, entro: num(f.valores[iE]) ?? 0, sinPagar: num(f.valores[iS]) ?? 0 }));
}

/** «A quién perseguir»: los de la tabla de cobranza, el más atrasado arriba (los días al vencimiento, de menor a mayor). */
export function perseguirDe(r: Resultado | null, max = 3): FilaPerseguir[] {
  if (!r) return [];
  const iD = col(r, 'dias'), iM = col(r, 'proxima_monto');
  return filas(r)
    .map((f) => ({ clave: f.clave, nombre: f.etiqueta, cuota: f.extra?.proxima ?? null, dias: iD < 0 ? null : num(f.valores[iD]), monto: iM < 0 ? null : num(f.valores[iM]) }))
    .sort((a, b) => (a.dias ?? Infinity) - (b.dias ?? Infinity))
    .slice(0, max);
}

/** «Lo último que entró»: cada cuota cobrada («Ana Ruiz · Cuota 2»), la más nueva arriba. */
export function ultimosDe(r: Resultado | null, hoy: string, max = 7): FilaCobro[] {
  if (!r) return [];
  const iM = col(r, 'cobrado');
  return filas(r)
    .map((f) => {
      const [nombre, ...resto] = f.etiqueta.split(' · ');
      return { clave: f.clave, nombre, cuota: resto.join(' · ') || null, dia: diaDeEtiqueta(f.extra?.dia ?? null, hoy), monto: iM < 0 ? 0 : num(f.valores[iM]) ?? 0 };
    })
    .filter((f) => f.monto > 0)
    .sort((a, b) => (b.dia ?? '').localeCompare(a.dia ?? '') || b.monto - a.monto)
    .slice(0, max);
}

/** Una lista de montos por nombre, de mayor a menor (los que más pagaron, lo pendiente por funnel). */
export function montosDe(r: Resultado | null, metrica: string): FilaMonto[] {
  if (!r) return [];
  const i = col(r, metrica);
  if (i < 0) return [];
  return filas(r).map((f) => ({ clave: f.clave, nombre: f.etiqueta, monto: num(f.valores[i]) ?? 0 })).filter((f) => f.monto > 0).sort((a, b) => b.monto - a.monto);
}

/** El anillo de Coffer: los cinco funnels con más pendiente y, si hay más, «Otros» con el resto. */
export function funnelDe(r: Resultado | null, max = 5): VistaCobranza['funnel'] {
  const todas = montosDe(r, 'pendiente');
  if (!r) return null;
  const totalP = todas.reduce((s, f) => s + f.monto, 0);
  if (todas.length <= max) return { total: totalP, filas: todas };
  const resto = todas.slice(max - 1);
  return { total: totalP, filas: [...todas.slice(0, max - 1), { clave: 'otros', nombre: 'Otros', monto: resto.reduce((s, f) => s + f.monto, 0) }] };
}

/** Todo lo que dibuja la hoja, de sus piezas. */
export function vistaCobranza(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, hoy: string): VistaCobranza {
  const p = hoja.diseno?.piezas ?? {};
  return {
    deben: debenDe(res(datos, p.atraso)),
    cobrado: comparado(res(datos, p.cobrado), 'cobrado'),
    vence: comparado(res(datos, p.vence), 'monto'),
    falta: comparado(res(datos, p.falta), 'pendiente'),
    demora: comparado(res(datos, p.demora), 'atraso_pago'),
    meses: mesesDe(res(datos, p.meses)),
    perseguir: perseguirDe(res(datos, p.perseguir)),
    ultimos: ultimosDe(res(datos, p.ultimos), hoy),
    pagaron: montosDe(res(datos, p.pagaron), 'cobrado').slice(0, 5),
    funnel: funnelDe(res(datos, p.funnel)),
  };
}

// ── lo que se escribe ─────────────────────────────────────────────────────────────────────────

/** La plata como la escribe Coffer, en dólares: «US$41,179» (con centavos sólo si se piden). */
export function plata(n: number, centavos = false): string {
  const s = Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits: centavos ? 2 : 0, maximumFractionDigits: centavos ? 2 : 0 });
  return `${n < 0 ? '−' : ''}US$${s}`;
}
/** La plata corta del centro del anillo: «US$41.2K». */
export function plataCorta(n: number): string {
  const a = Math.abs(n);
  if (a < 1000) return plata(n);
  const k = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1)}M` : `${(a / 1000).toFixed(1)}K`;
  return `${n < 0 ? '−' : ''}US$${k.replace('.0', '')}`;
}
/** «N cuotas» / «1 cuota». */
export const cuotas = (n: number) => `${n.toLocaleString('es-MX')} ${n === 1 ? 'cuota' : 'cuotas'}`;

/** Lo que dice «A quién perseguir» del atraso de un cliente: «67 días tarde», «Vence hoy», «Vence en 3 días». */
export function textoDeDias(dias: number | null): { texto: string; tarde: boolean } | null {
  if (dias == null) return null;
  if (dias < 0) return { texto: `${-dias} ${dias === -1 ? 'día' : 'días'} tarde`, tarde: true };
  if (dias === 0) return { texto: 'Vence hoy', tarde: false };
  return { texto: `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`, tarde: false };
}

/** El día de un cobro como Coffer («Today», «Yesterday»): «Hoy», «Ayer» o «Lun 2». */
export function rotuloDia(dia: string | null, hoy: string): string {
  if (!dia) return '';
  if (dia === hoy) return 'Hoy';
  const ayer = new Date(`${hoy}T12:00:00Z`);
  ayer.setUTCDate(ayer.getUTCDate() - 1);
  if (dia === ayer.toISOString().slice(0, 10)) return 'Ayer';
  const t = new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short', day: 'numeric' }).format(new Date(`${dia}T12:00:00Z`)).replace(/\.|,/g, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Cómo se nombra el período de la hoja y el de antes, para los rótulos y las notas de Coffer («Paid this month»,
 * «Oct: $18,385»): «Cobrado este mes», «Mes pasado: US$18,385». Sale del NOMBRE del período (`nombrePreset`, el de la
 * barra de controles); uno que no está en la lista dice «en el período» y «Período anterior», que siempre es verdad.
 */
export function nombresDelPeriodo(periodo: string): { en: string; anterior: string; queAnterior: string } {
  const p = periodo.trim().toLowerCase();
  const ult = /^últimos (\d+) (días|meses)$/.exec(p);
  if (p === 'hoy') return { en: 'hoy', anterior: 'Ayer', queAnterior: 'que ayer' };
  if (p === 'ayer') return { en: 'ayer', anterior: 'Anteayer', queAnterior: 'que anteayer' };
  if (p === 'este mes' || p === 'este mes completo') return { en: 'este mes', anterior: 'Mes pasado', queAnterior: 'que el mes pasado' };
  if (p === 'el mes pasado') return { en: 'el mes pasado', anterior: 'El mes anterior', queAnterior: 'que el mes anterior' };
  if (p === 'este año') return { en: 'este año', anterior: 'Año pasado', queAnterior: 'que el año pasado' };
  if (p === 'el año pasado') return { en: 'el año pasado', anterior: 'El año anterior', queAnterior: 'que el año anterior' };
  if (ult) return { en: `en los últimos ${ult[1]} ${ult[2]}`, anterior: `Los ${ult[1]} ${ult[2]} anteriores`, queAnterior: `que los ${ult[1]} ${ult[2]} anteriores` };
  return { en: 'en el período', anterior: 'Período anterior', queAnterior: 'que el período anterior' };
}

/** La nota de abajo de cada número («Oct: $18,385»): lo mismo del período anterior, o nada si no se sabe. */
export function notaAnterior(c: Comparado, formato: (n: number) => string, periodo = ''): string | null {
  return c.anterior == null ? null : `${nombresDelPeriodo(periodo).anterior}: ${formato(c.anterior)}`;
}

/** La nota del atraso al pagar («1 days slower than…»), en rojo si empeoró. */
export function notaDemora(c: Comparado, periodo = ''): { texto: string; peor: boolean } | null {
  if (c.valor == null || c.anterior == null) return null;
  const que = nombresDelPeriodo(periodo).queAnterior;
  const d = Math.round(c.valor) - Math.round(c.anterior);
  if (d === 0) return { texto: `Igual ${que}`, peor: false };
  const n = Math.abs(d);
  return { texto: `${n} ${n === 1 ? 'día' : 'días'} ${d > 0 ? 'más' : 'menos'} ${que}`, peor: d > 0 };
}

/** Los días de atraso al pagar, como el número grande: «6 días», «2 días antes» si pagan antes de vencer. */
export function textoDemora(v: number): string {
  const n = Math.round(Math.abs(v));
  const d = `${n} ${n === 1 ? 'día' : 'días'}`;
  return v < -0.5 ? `${d} antes` : d;
}

/**
 * La escala del flujo: de un múltiplo «redondo» por debajo del mínimo a uno por encima del máximo, en 4 tramos como Coffer
 * (−$20K … $60K). Sin datos, 0 a 1 (nada se dibuja).
 */
export function escalaFlujo(meses: readonly MesFlujo[]): { min: number; max: number; paso: number } {
  const alto = Math.max(0, ...meses.map((m) => m.entro));
  const bajo = Math.max(0, ...meses.map((m) => m.sinPagar));
  if (!alto && !bajo) return { min: 0, max: 1, paso: 1 };
  const bruto = (alto + bajo) / 4;
  const mag = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((k) => k >= bruto) ?? 10 * mag;
  return { min: bajo ? -Math.ceil(bajo / paso) * paso : 0, max: Math.max(paso, Math.ceil(alto / paso) * paso), paso };
}

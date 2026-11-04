// =============================================================================
// comercial-diseno — lo que dibuja la hoja Comercial con su DISEÑO PROPIO (la copia de Selvar), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/comercial-selvar/; acá, de dónde sale cada número con los DATOS REALES: los componentes de la hoja
// (`hoja.diseno.piezas`, lib/graficos-plantillas.ts, COMERCIAL) y las llamadas de venta de hoy (la agenda del CRM, que trae la página).
// La pregunta de la hoja es «¿convierte, y a qué costo?»:
//   · la cabecera: de cuántas agendas salieron cuántos cierres, lo vendido y lo que costó cada cierre en anuncios;
//   · «Vendido» (el «Closed-won» de Selvar): lo vendido contra el período anterior, lo invertido, y qué pasó con las agendas;
//   · los cuatro números: la tasa de cierre, el ticket, los días hasta el cierre y el costo por cierre;
//   · «Por qué no se cerró» (el «Copilot»), «Lo vendido» («Bookings»), «De agenda a cierre» («Where deals sit»), «Hoy»
//     («Today»), «De dónde vienen los que cierran» («Deals that need you») y «Quién cierra» («Quota race»).
//
// LO QUE SELVAR TIENE Y MaKo NO HACE NO SE INVENTA: el «Pace today», el «Forecast» y la cuota (MaKo no tiene una cuota ni un
// pronóstico de ventas), los botones de IA de cada señal y la caja para preguntarle.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaComercial.tsx) y el test. Lo que no llegó es `null`,
// nunca un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import { estadoDeLlamada, type LlamadaDeVenta } from './calendario-llamadas';
import type { DatosPieza } from './closing-diseno';
import { diaEnZona, horaEn } from './focus-diseno';
import { cambio } from './general-diseno';

export type { DatosPieza };

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
/** El total de una métrica de la pieza, por su id (no por la posición: la pieza puede traer otras). */
const total = (r: Resultado | null, metrica: string): number | null => {
  const i = r ? r.columnas.findIndex((c) => c.id === metrica) : -1;
  return r && i >= 0 ? num(r.totales[i]) : null;
};
const anteriorDe = (r: Resultado | null, metrica: string): number | null => {
  const i = r ? r.columnas.findIndex((c) => c.id === metrica) : -1;
  return r && r.anterior && i >= 0 ? num(r.anterior[i]) : null;
};
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => {
  const i = r.columnas.findIndex((c) => c.id === metrica);
  return i >= 0 ? num(f.valores[i]) : null;
};
const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-MX')} ${n === 1 ? uno : varios}`;

/** «US$96,000». */
export function plata(n: number): string {
  return `${n < 0 ? '−' : ''}US$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}
/** «28.6%». */
export const pct = (n: number) => `${Math.round(n * 10) / 10}%`;

export type Trozo = { tipo: 'texto'; s: string } | { tipo: 'fuerte'; s: string };
export type Segmento = { id: 'cerraron' | 'vinieron' | 'no-vino' | 'sin-marcar'; nombre: string; n: number; pct: number };
export type NumeroCm = {
  id: 'tasa' | 'ticket' | 'ciclo' | 'costo';
  titulo: string;
  valor: string | null;
  /** El cambio contra el período anterior («+12%»); null sin anterior. */
  cambio: string | null;
  /** ¿El cambio es bueno? La tasa y el ticket, si suben; los días y el costo, si bajan. */
  bueno: boolean | null;
  baja: boolean;
  pie: string | null;
  serie: number[] | null;
};
export type SerieVentas = { x: Array<{ clave: string; rotulo: string }>; series: Array<{ nombre: string; valores: number[] }>; total: number; promedio: number };
export type PasoEmbudo = { nombre: string; n: number; pasa: string | null };
export type LlamadaHoy = { id: string; leadId: number; hora: string; cual: string; nombre: string; closer: string | null; estado: 'paso' | 'viene'; detalle: string };
export type FilaOrigen = { clave: string; nombre: string; agendas: number; cierres: number; tasa: number | null; vendido: number | null; bueno: boolean | null };
export type FilaCloser = { clave: string; nombre: string; tasa: number; cierres: number | null; bueno: boolean | null };
export type FilaMotivo = { clave: string; nombre: string; n: number; pct: number };

export type VistaComercial = {
  frase: Trozo[];
  vendido: { valor: number | null; anterior: number | null; cambio: string | null; sube: boolean | null };
  inversion: { gasto: number | null; cpa: number | null; roas: number | null };
  desenlace: { agendas: number; vinieron: number; segmentos: Segmento[] } | null;
  /** La tasa de cierre de todo el período (cierres ÷ las que vinieron): con ella se pinta cada origen y cada closer. */
  tasa: number | null;
  numeros: NumeroCm[];
  motivos: { total: number; filas: FilaMotivo[] } | null;
  ventas: { semanas: SerieVentas | null; meses: SerieVentas | null };
  embudo: PasoEmbudo[] | null;
  hoy: { llamadas: LlamadaHoy[]; ahora: number; hora: string } | null;
  origenes: FilaOrigen[] | null;
  closers: FilaCloser[] | null;
};

/** Las llamadas de venta de hoy (las del CRM, sin las canceladas): la página las lee y la hoja las dibuja. */
export type AgendaComercial = { tz: string; llamadas: LlamadaDeVenta[] };

/** Lo que pasó con las agendas del período: cerraron, vinieron y no cerraron, no vinieron y sin marcar. */
export function desenlaceDe(r: Resultado | null): VistaComercial['desenlace'] {
  const agendas = total(r, 'agendas');
  if (agendas == null || agendas <= 0) return null;
  const cierres = Math.max(0, total(r, 'cierres') ?? 0);
  // Un cierre sin la asistencia marcada también vino: las que vinieron son, como mínimo, las que cerraron.
  const vinieron = Math.max(total(r, 'asistencias') ?? 0, cierres);
  const noVino = Math.max(0, total(r, 'no_show') ?? 0);
  const sinMarcar = Math.max(0, agendas - vinieron - noVino);
  const base = Math.max(agendas, vinieron + noVino) || 1;
  const seg = (id: Segmento['id'], nombre: string, n: number): Segmento => ({ id, nombre, n, pct: (n / base) * 100 });
  return {
    agendas, vinieron,
    segmentos: [seg('cerraron', 'Cerraron', cierres), seg('vinieron', 'Vinieron y no cerraron', vinieron - cierres), seg('no-vino', 'No vinieron', noVino), seg('sin-marcar', 'Sin marcar', sinMarcar)],
  };
}

/** Un número con su cambio y su línea (la serie diaria de la pieza: sólo si tiene dos puntos o más). */
function numero(id: NumeroCm['id'], titulo: string, r: Resultado | null, metrica: string, formato: (n: number) => string, baja: boolean, pie: string | null): NumeroCm {
  const v = total(r, metrica), ant = anteriorDe(r, metrica);
  const c = v != null && ant != null ? cambio(v, ant) : null;
  const serie = r?.serie?.map((p) => num(p.valor) ?? 0) ?? null;
  const dif = v != null && ant != null ? v - ant : 0;
  return {
    id, titulo, valor: v == null ? null : formato(v), cambio: c, baja: dif < 0,
    bueno: c == null || dif === 0 ? null : baja ? dif < 0 : dif > 0,
    pie, serie: serie && serie.length > 1 ? serie : null,
  };
}

const rotuloSemana = (clave: string) => { const [, m, d] = clave.split('-').map(Number); return `${d} ${MESES[m - 1] ?? ''}`.trim(); };
const rotuloMes = (clave: string) => MESES_CORTOS[Number(clave.slice(5, 7)) - 1] ?? clave;

/** Lo vendido por semana o por mes, apilado por funnel (el desglose de la pieza), con el promedio. */
export function ventasDe(r: Resultado | null, dim: 'semana' | 'mes'): SerieVentas | null {
  if (!r || !r.filas.length) return null;
  const x = r.filas.map((f) => ({ clave: f.clave, rotulo: dim === 'semana' ? rotuloSemana(f.clave) : rotuloMes(f.clave) }));
  const series = r.cruce && r.cruce.claves.length
    ? r.cruce.claves.map((nombre, j) => ({ nombre, valores: r.cruce!.celdas.map((fila) => Math.max(0, num(fila[j]) ?? 0)) }))
    : [{ nombre: 'Vendido', valores: r.filas.map((f) => Math.max(0, enFila(r, f, 'vendido') ?? 0)) }];
  const porX = x.map((_, i) => series.reduce((s, se) => s + se.valores[i], 0));
  const t = porX.reduce((a, b) => a + b, 0);
  return { x, series: series.filter((s) => s.valores.some((v) => v > 0)), total: t, promedio: x.length ? t / x.length : 0 };
}

/** «De agenda a cierre»: las cohortes maduras, paso por paso, con cuántos pasan al siguiente. */
export function embudoDe(r: Resultado | null): PasoEmbudo[] | null {
  const pasos: Array<[string, string, string]> = [['agendas', 'Agendaron', ''], ['asistencias', 'Vinieron', 'vino a la reunión'], ['limpias', 'Calificados', 'quedó calificado'], ['cierres', 'Cerraron', 'cerró']];
  const ns = pasos.map(([m]) => total(r, m));
  if (ns[0] == null || ns[0] <= 0) return null;
  return pasos.map(([, nombre], i) => {
    const n = ns[i] ?? 0;
    const siguiente = i < pasos.length - 1 ? ns[i + 1] : null;
    return { nombre, n, pasa: siguiente != null && n > 0 ? `${Math.round((siguiente / n) * 100)}% ${pasos[i + 1][2]}` : null };
  });
}

/** Los motivos de pérdida, del más repetido al menos (la pieza ya viene ordenada por leads). */
export function motivosDe(r: Resultado | null, max = 3): VistaComercial['motivos'] {
  if (!r) return null;
  const filas = r.filas
    .map((f) => ({ clave: f.clave, nombre: f.etiqueta, n: enFila(r, f, 'leads') ?? num(f.valores[0]) ?? 0 }))
    .filter((f) => f.n > 0 && f.clave !== '(sin dato)');
  const t = filas.reduce((s, f) => s + f.n, 0);
  if (!t) return { total: 0, filas: [] };
  return { total: t, filas: filas.sort((a, b) => b.n - a.n).slice(0, max).map((f) => ({ ...f, pct: Math.round((f.n / t) * 100) })) };
}

/** Cada origen con su tasa de cierre (contra la del período) y lo vendido. Primero los que más cierran. */
export function origenesDe(r: Resultado | null, tasa: number | null, max = 4): FilaOrigen[] | null {
  if (!r) return null;
  return r.filas
    .map((f) => {
      const t = enFila(r, f, 'tasa_cierre');
      return { clave: f.clave, nombre: f.etiqueta, agendas: enFila(r, f, 'agendas') ?? 0, cierres: enFila(r, f, 'cierres') ?? 0, tasa: t, vendido: enFila(r, f, 'vendido'), bueno: t == null || tasa == null ? null : t >= tasa };
    })
    .filter((f) => f.agendas > 0 || f.cierres > 0)
    .sort((a, b) => b.cierres - a.cierres || (b.vendido ?? 0) - (a.vendido ?? 0) || b.agendas - a.agendas)
    .slice(0, max);
}

/** «Quién cierra»: cada closer con su tasa de cierre, de la más alta a la más baja. */
export function closersDe(r: Resultado | null, tasa: number | null, max = 6): FilaCloser[] | null {
  if (!r) return null;
  return r.filas
    .map((f) => ({ clave: f.clave, nombre: f.etiqueta, t: enFila(r, f, 'tasa_cierre'), cierres: enFila(r, f, 'cierres') }))
    .filter((f): f is typeof f & { t: number } => f.t != null && f.clave !== '(sin dato)')
    .map((f) => ({ clave: f.clave, nombre: f.nombre, tasa: f.t, cierres: f.cierres, bueno: tasa == null ? null : f.t >= tasa }))
    .sort((a, b) => b.tasa - a.tasa || (b.cierres ?? 0) - (a.cierres ?? 0))
    .slice(0, max);
}

/** Las llamadas de venta de hoy, en orden, y dónde va la línea de «Ahora». */
export function hoyDe(agenda: AgendaComercial | null, hoy: string, ahoraIso: string): VistaComercial['hoy'] {
  if (!agenda) return null;
  const ahora = Date.parse(ahoraIso);
  const llamadas = agenda.llamadas
    .filter((l) => !l.cancelada && diaEnZona(l.inicio, agenda.tz) === hoy)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .map((l): LlamadaHoy => {
      const est = estadoDeLlamada(l, ahoraIso);
      const paso = !l.diaCompleto && Date.parse(l.inicio) < ahora;
      const quien = l.closer ? `Con ${l.closer}` : 'Sin closer';
      const marca = est === 'asistio' ? 'vino' : est === 'no-vino' ? 'no vino' : paso ? 'sin marcar' : null;
      return { id: l.id, leadId: l.leadId, hora: l.diaCompleto ? 'Hoy' : horaEn(l.inicio, agenda.tz), cual: l.cual, nombre: l.nombre, closer: l.closer, estado: paso ? 'paso' : 'viene', detalle: marca ? `${quien} · ${marca}` : quien };
    });
  return { llamadas, ahora: llamadas.filter((l) => l.estado === 'paso').length, hora: horaEn(ahoraIso, agenda.tz) };
}

/** La frase de arriba: «De 27 agendas salieron 6 cierres, vendiste US$96,000 y cada cierre te costó US$410 en anuncios.» */
export function fraseComercial(agendas: number | null, cierres: number | null, vendido: number | null, cac: number | null): Trozo[] {
  const t: Trozo[] = [];
  if (agendas != null && cierres != null) t.push({ tipo: 'texto', s: 'De ' }, { tipo: 'fuerte', s: plural(agendas, 'agenda', 'agendas') }, { tipo: 'texto', s: ` ${cierres === 1 ? 'salió' : 'salieron'} ` }, { tipo: 'fuerte', s: plural(cierres, 'cierre', 'cierres') });
  const resto: Trozo[][] = [];
  if (vendido != null) resto.push([{ tipo: 'texto', s: 'vendiste ' }, { tipo: 'fuerte', s: plata(vendido) }]);
  if (cac != null && cac > 0) resto.push([{ tipo: 'texto', s: 'cada cierre te costó ' }, { tipo: 'fuerte', s: plata(cac) }, { tipo: 'texto', s: ' en anuncios' }]);
  resto.forEach((r, i) => {
    t.push({ tipo: 'texto', s: !t.length && i === 0 ? '' : i === resto.length - 1 ? (t.length ? ' y ' : '') : ', ' }, ...r);
  });
  if (!t.length) return [];
  const primero = t.find((x) => x.s)!;
  if (primero.tipo === 'texto') primero.s = primero.s.charAt(0).toUpperCase() + primero.s.slice(1);
  t.push({ tipo: 'texto', s: '.' });
  return t.filter((x) => x.s);
}

export function vistaComercial(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, agenda: AgendaComercial | null, hoy: string, ahoraIso: string): VistaComercial {
  const p = hoja.diseno?.piezas ?? {};
  const ap = res(datos, p.apertura), plataR = res(datos, p.plata), tasaR = res(datos, p.tasa);
  // Lo vendido y lo invertido salen de UNA pieza (columnas por semana con sus totales y el período anterior); lo que cuesta una
  // agenda y el retorno se calculan acá: una hoja no puede pasar de 14 paneles ni tener dos frases.
  const vendido = total(plataR, 'vendido'), antVendido = anteriorDe(plataR, 'vendido');
  const gasto = total(plataR, 'gasto'), agendasAp = total(ap, 'agendas');
  const cpa = gasto != null && gasto > 0 && agendasAp ? gasto / agendasAp : null;
  const roas = vendido != null && gasto != null && gasto > 0 ? vendido / gasto : null;
  const costoR = res(datos, p.costo);
  const cac = total(costoR, 'cac');
  const tasa = total(tasaR, 'tasa_cierre');
  const desenlace = desenlaceDe(ap);
  const cierresAp = total(ap, 'cierres');
  return {
    frase: fraseComercial(total(ap, 'agendas'), cierresAp, vendido, cac),
    vendido: {
      valor: vendido, anterior: antVendido,
      cambio: vendido != null && antVendido != null ? cambio(vendido, antVendido) : null,
      sube: vendido == null || antVendido == null || vendido === antVendido ? null : vendido > antVendido,
    },
    inversion: { gasto, cpa, roas },
    desenlace, tasa,
    numeros: [
      numero('tasa', 'Tasa de cierre', tasaR, 'tasa_cierre', pct, false, desenlace ? `${plural(desenlace.segmentos[0].n, 'cerró', 'cerraron')} de ${desenlace.vinieron.toLocaleString('es-MX')}` : null),
      numero('ticket', 'Ticket promedio', res(datos, p.ticket), 'ticket', plata, false, 'De los cierres del período'),
      numero('ciclo', 'Días hasta el cierre', res(datos, p.ciclo), 'ciclo_cierre', (n) => plural(Math.round(n), 'día', 'días'), true, 'De la primera reunión al cierre'),
      numero('costo', 'Costo por cierre', costoR, 'cac', plata, true, 'Lo invertido en anuncios ÷ los cierres'),
    ],
    motivos: motivosDe(res(datos, p.motivos)),
    ventas: { semanas: ventasDe(res(datos, p.semanas), 'semana'), meses: ventasDe(res(datos, p.meses), 'mes') },
    embudo: embudoDe(res(datos, p.embudo)),
    hoy: hoyDe(agenda, hoy, ahoraIso),
    origenes: origenesDe(res(datos, p.origen), tasa),
    closers: closersDe(res(datos, p.closers), tasa),
  };
}

/** La escala del eje de «Lo vendido»: un tope redondo y su paso (tres líneas, como Selvar). */
export function escalaVentas(max: number): { tope: number; paso: number } {
  if (max <= 0) return { tope: 3, paso: 1 };
  const crudo = max / 3, pot = 10 ** Math.floor(Math.log10(crudo)), m = crudo / pot;
  const paso = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * pot;
  return { tope: paso * 3, paso };
}

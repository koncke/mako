// =============================================================================
// servicio-diseno — lo que dibuja la hoja «Agencia o servicio» con su DISEÑO PROPIO (la copia de Sunrow), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/servicio-sunrow/; aquí, de dónde sale cada número con los DATOS REALES: los componentes de la
// hoja (`hoja.diseno.piezas`, lib/general-plantillas.ts, «servicio») y los datos de General (el Calendario, el Plan y el
// Semáforo). La pregunta: «¿cada cliente va en fecha?».
//   · arriba (el saludo de Sunrow): cuántos clientes hay y en cuántas etapas, quién te necesita y lo que está vencido; las
//     reuniones de hoy, las sesiones dadas y los funnels con clientes; y «lo que queda de tu agenda» (el arco de la luz del día:
//     de lo primero a lo último que tienes hoy en el Calendario);
//   · la tarjeta oscura («AI project insights»): qué parte de tu cartera no pide atención, y el primero que te necesita;
//   · los seis números: clientes, avanzaron de etapa, piden atención, sesiones, deuda vencida y lo cobrado;
//   · «Avanzaron de etapa» («Timeline progress»): los que llegaron a una etapa cada semana, sumados;
//   · «Lo que te deben» («Budget utilization»): lo que falta cobrar por días de atraso, y los que más deben;
//   · «Quién te necesita» («Site-wise performance»): cada cliente con su señal, hace cuánto no hablan y lo que debe;
//   · «Clientes por etapa» («Recent project updates»), «Salud del negocio» («Critical issue alerts»), «Lo que vence» («Upcoming
//     deadlines»), el Calendario, «Tus prioridades» («My tasks») y «Lo que viene» («Notifications»).
//
// LO QUE SUNROW TIENE Y MaKo NO MIDE NO SE INVENTA: el clima, el viento, la luz del día, el plan contra lo real de cada obra (las
// líneas «Planned», «Forecast» y «Baseline»), el presupuesto comprometido y el pronóstico de la IA. La entrega no guarda una fecha
// comprometida por etapa: lo que se mide es cuándo llegó cada cliente a su etapa (docs/relevo/nube-dashboards.md).
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaServicio.tsx) y el test. Lo que no llegó es `null`,
// nunca un cero.
// =============================================================================

import type { DatosGeneral, TareaVista } from '@/app/general/datos-tipos';
import type { Hoja } from './graficos-catalogo';
import { OTROS, SIN_DATO, type Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { debenDe, plata } from './cobranza-diseno';
import { cuandoVence, diaEnZona, horaEn, tareaFocus } from './focus-diseno';
import { cuandoSale, deltaDe, marcasDelEje, topeDe, type Delta } from './curso-diseno';
import { entero, pasoDe, rotuloDia, type PasoTiempo } from './marketing-diseno';
import { CAPAS_CALENDARIO, type ItemCalendario } from './calendario-modelo';
import { PLABEL } from '@/app/plan/board/types';

export type { DatosPieza, Delta };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const anteriorDe = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && r.anterior && i >= 0 ? num(r.anterior[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
/** Las filas de verdad: sin «(sin dato)» ni «Otros». */
const filasDe = (r: Resultado) => r.filas.filter((f) => f.etiqueta && f.clave !== SIN_DATO && f.clave !== OTROS);
const plural = (n: number, uno: string, varios: string) => `${entero(n)} ${n === 1 ? uno : varios}`;
const sumarDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ── la frase de arriba ──────────────────────────────────────────────────────────────────────────────────────────────
/**
 * «Tienes 24 clientes en 5 etapas. 3 te necesitan hoy y 4 cuotas están vencidas.» (la de Sunrow: «7 builds are live across five
 * states. 13 approvals and one delayed site need you today.»). Sin los clientes, null.
 */
export function fraseServicio(clientes: number | null, etapas: number | null, atencion: number | null, vencidas: number | null): string | null {
  if (clientes == null) return null;
  const primera = `Tienes ${plural(clientes, 'cliente', 'clientes')}${etapas ? ` en ${plural(etapas, 'etapa', 'etapas')}` : ''}.`;
  const partes: string[] = [];
  if (atencion != null) partes.push(atencion ? `${entero(atencion)} ${atencion === 1 ? 'te necesita' : 'te necesitan'} hoy` : 'ninguno pide atención hoy');
  if (vencidas) partes.push(`${entero(vencidas)} ${vencidas === 1 ? 'cuota está vencida' : 'cuotas están vencidas'}`);
  if (!partes.length) return primera;
  const segunda = partes.join(' y ');
  return `${primera} ${segunda[0].toUpperCase()}${segunda.slice(1)}.`;
}

// ── lo que queda de tu agenda hoy (el arco de Sunrow) ───────────────────────────────────────────────────────────────
export type DiaServicio =
  | { estado: 'agenda'; desde: string; hasta: string; queda: string | null; fraccion: number; pie: string; n: number }
  | { estado: 'vacio' };
/** «8 h 58 min», «45 min»: cuánto falta. */
export function duracion(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}
/**
 * De lo primero que tienes hoy con hora en el Calendario hasta lo último que termina: cuánto le queda y dónde va el punto. Lo que
 * dura todo el día no cuenta (no tiene hora). Sin nada con hora hoy, `vacio`.
 */
export function diaDe(items: readonly ItemCalendario[], tz: string, hoy: string, ahora: number): DiaServicio {
  const deHoy = items.filter((i) => !i.diaCompleto && diaEnZona(i.inicio, tz) === hoy);
  if (!deHoy.length) return { estado: 'vacio' };
  const ini = Math.min(...deHoy.map((i) => Date.parse(i.inicio)));
  const fin = Math.max(...deHoy.map((i) => Date.parse(i.fin ?? i.inicio)));
  const ultimo = deHoy.reduce((a, b) => (Date.parse(b.fin ?? b.inicio) > Date.parse(a.fin ?? a.inicio) ? b : a));
  const hasta = new Date(fin).toISOString();
  const fraccion = fin > ini ? Math.max(0, Math.min(1, (ahora - ini) / (fin - ini))) : ahora >= fin ? 1 : 0;
  const termino = ahora >= fin;
  return {
    estado: 'agenda', desde: horaEn(new Date(ini).toISOString(), tz), hasta: horaEn(hasta, tz), n: deHoy.length, fraccion,
    queda: termino ? null : duracion(fin - Math.max(ahora, ini)),
    pie: termino ? 'Tu agenda de hoy ya terminó' : `${ultimo.titulo} termina a las ${horaEn(hasta, tz)}`,
  };
}

// ── los seis números ────────────────────────────────────────────────────────────────────────────────────────────────
export type PieServicio = { texto: string; tono: 'sube' | 'baja' | 'igual' | 'info' } | null;
export type NumeroServicio = {
  id: 'clientes' | 'avanzaron' | 'atencion' | 'sesiones' | 'deuda' | 'cobrado';
  titulo: string; valor: string | null; pie: PieServicio;
  /** El color de la tarjeta, como las de Sunrow: la primera menta, la tercera rosa y la quinta amarilla. */
  tile: 'mint' | 'blush' | 'lemon' | null;
};
/** El pie de un número que se compara con el período anterior: «+12% contra el anterior» o «Igual que el anterior» (corto: la tarjeta es angosta). */
export function pieDelCambio(actual: number | null, anterior: number | null, invertido = false): PieServicio {
  if (actual == null || anterior == null) return null;
  if (actual === anterior) return { texto: 'Igual que el anterior', tono: 'igual' };
  const d = deltaDe(actual, anterior);
  if (!d) return null;
  return { texto: `${d.texto} contra el anterior`, tono: d.bueno !== invertido ? 'sube' : 'baja' };
}

// ── avanzaron de etapa, semana a semana ─────────────────────────────────────────────────────────────────────────────
export type AvanceServicio = {
  puntos: Array<{ clave: string; rotulo: string; semana: number; suma: number }>;
  tope: number; marcas: number[]; paso: PasoTiempo;
  /** Los rótulos del eje de abajo (índices de `puntos`). */
  eje: number[];
  total: number; ultima: number; promedio: number;
};
/** Los que llegaron a una etapa cada semana, sumados (la curva de Sunrow). Sin semanas, null. */
export function avanceDe(r: Resultado | null): AvanceServicio | null {
  if (!r) return null;
  const filas = r.filas.map((f) => ({ clave: f.clave, v: enFila(r, f, 'clientes') ?? 0 }));
  if (!filas.length) return null;
  const paso = pasoDe(filas.map((f) => f.clave));
  let suma = 0;
  const puntos = filas.map((f) => { suma += f.v; return { clave: f.clave, rotulo: rotuloDia(f.clave, paso), semana: f.v, suma }; });
  const tope = topeDe(suma);
  return {
    puntos, tope, marcas: [tope, (tope * 3) / 4, tope / 2, tope / 4, 0], paso, eje: marcasDelEje(puntos.length, 12),
    total: suma, ultima: puntos[puntos.length - 1].semana, promedio: suma / puntos.length,
  };
}

// ── lo que te deben ─────────────────────────────────────────────────────────────────────────────────────────────────
export type DeudorServicio = { clave: string; nombre: string; monto: number; parte: number };
export type DebenServicio = {
  total: number; cuotas: number; vencidas: number;
  /** Lo vencido sobre todo lo que falta cobrar, 0..100 (el «38% utilized» de Sunrow). null = no hay nada por cobrar. */
  pct: number | null;
  /**
   * Los cuatro renglones de Sunrow («Total budget», «Spent», «Committed», «Remaining»): todo lo que te deben, lo vencido de 1 a 30
   * días (el primer pedazo del anillo), lo de más de 30 (el segundo) y lo que todavía está al día (el resto del anillo).
   */
  renglones: Array<{ id: 'total' | '1-30' | '30+' | 'al-dia'; nombre: string; monto: number; color: 'ink' | 'sun' | 'cobalt' | 'slate' }>;
  /** Los dos pedazos del anillo, 0..100: lo vencido de 1 a 30 días y lo de más de 30. */
  anillo: { a: number; b: number } | null;
  quienes: { lista: DeudorServicio[]; mas: number } | null;
};
export const FILAS_DEUDORES = 4;
export function debenServicio(tramos: Resultado | null, porCliente: Resultado | null): DebenServicio | null {
  const d = debenDe(tramos);
  if (!d) return null;
  const monto = (n: string) => d.tramos.find((t) => t.nombre === n)?.monto ?? 0;
  const a = monto('1-30 días'), b = monto('31-60 días') + monto('60+ días');
  const renglones: DebenServicio['renglones'] = [
    { id: 'total', nombre: 'Total por cobrar', monto: d.total, color: 'ink' },
    { id: '1-30', nombre: 'Vencido 1-30 días', monto: a, color: 'sun' },
    { id: '30+', nombre: 'Vencido +30 días', monto: b, color: 'cobalt' },
    { id: 'al-dia', nombre: 'Al día', monto: monto('Al día'), color: 'slate' },
  ];
  let quienes: DebenServicio['quienes'] = null;
  if (porCliente) {
    const filas = filasDe(porCliente).map((f) => ({ clave: f.clave, nombre: f.etiqueta, monto: enFila(porCliente, f, 'pendiente') ?? 0 }))
      .filter((f) => f.monto > 0).sort((a, b) => b.monto - a.monto);
    quienes = {
      lista: filas.slice(0, FILAS_DEUDORES).map((f) => ({ ...f, parte: d.total > 0 ? (f.monto / d.total) * 100 : 0 })),
      mas: Math.max(0, filas.length - FILAS_DEUDORES) + porCliente.fuera,
    };
  }
  return {
    total: d.total, cuotas: d.cuotas, vencidas: d.vencidas, pct: d.total > 0 ? Math.round((d.vencido / d.total) * 100) : null, renglones,
    anillo: d.total > 0 ? { a: (a / d.total) * 100, b: (b / d.total) * 100 } : null, quienes,
  };
}

// ── quién te necesita ───────────────────────────────────────────────────────────────────────────────────────────────
export type ClienteServicio = {
  clave: string; nombre: string; senal: string | null; contacto: string | null; deuda: number | null; sesiones: number | null;
  tono: 'bad' | 'good' | 'neutral';
  /** La barra: lo que debe contra el que más debe de la lista (0..100). */
  barra: number;
};
export const FILAS_QUIEN = 6;
export function quienDe(r: Resultado | null): { lista: ClienteServicio[]; mas: number } | null {
  if (!r) return null;
  const todas = filasDe(r);
  const max = Math.max(0, ...todas.map((f) => enFila(r, f, 'deuda_vencida_usd') ?? 0));
  return {
    lista: todas.slice(0, FILAS_QUIEN).map((f) => {
      const senal = f.extra?.senal && f.extra.senal !== SIN_DATO ? f.extra.senal : null;
      const contacto = f.extra?.tramo_contacto && f.extra.tramo_contacto !== SIN_DATO ? f.extra.tramo_contacto : null;
      const deuda = enFila(r, f, 'deuda_vencida_usd');
      return {
        clave: f.clave, nombre: f.etiqueta, senal, contacto, deuda, sesiones: enFila(r, f, 'sesiones'),
        tono: senal === 'Atención' ? 'bad' : senal === 'Bien' ? 'good' : 'neutral', barra: max > 0 && deuda ? (deuda / max) * 100 : 0,
      };
    }),
    mas: Math.max(0, todas.length - FILAS_QUIEN) + r.fuera,
  };
}
/** «No hablan hace 15-30 días», «Hablaron hace 0-7 días», «Nunca hablaron». */
export function textoDeContacto(tramo: string | null): string | null {
  if (!tramo) return null;
  if (tramo === 'Nunca') return 'Nunca hablaron';
  if (tramo === '0-7 días') return 'Hablaron esta semana';
  return `No hablan hace ${tramo === 'Más de 30 días' ? 'más de 30 días' : tramo}`;
}

// ── clientes por etapa ──────────────────────────────────────────────────────────────────────────────────────────────
export type EtapaServicio = { clave: string; nombre: string; n: number; parte: number | null };
export const FILAS_ETAPA = 5;
export function etapasDe(r: Resultado | null): { lista: EtapaServicio[]; total: number | null; cuantas: number; mas: number } | null {
  if (!r) return null;
  const tot = total(r, 'clientes');
  const todas = filasDe(r).map((f) => ({ clave: f.clave, nombre: f.etiqueta, n: enFila(r, f, 'clientes') ?? 0 })).filter((e) => e.n > 0);
  return {
    lista: todas.slice(0, FILAS_ETAPA).map((e) => ({ ...e, parte: tot ? (e.n / tot) * 100 : null })),
    total: tot, cuantas: todas.length, mas: Math.max(0, todas.length - FILAS_ETAPA) + r.fuera,
  };
}

// ── lo de General: el Calendario, el Plan y el Semáforo ─────────────────────────────────────────────────────────────
/** Lo que la hoja lee de los datos de General (la miniatura de «Nueva hoja» trae sólo esto, de ejemplo). */
export type GeneralDeServicio = Pick<DatosGeneral, 'calendario' | 'plan' | 'semaforo'>;

export type VieneServicio = { id: string; titulo: string; detalle: string | null; cuando: string; capa: ItemCalendario['capa']; href: string | null };
export const FILAS_VIENE = 5;
/** Lo que viene después de hoy en el Calendario («Notifications» de Sunrow), lo más cercano primero. */
export function vieneDe(items: readonly ItemCalendario[], tz: string, hoy: string): { lista: VieneServicio[]; total: number } {
  const despues = items.filter((i) => diaEnZona(i.inicio, tz) > hoy).sort((a, b) => a.inicio.localeCompare(b.inicio));
  return {
    lista: despues.slice(0, FILAS_VIENE).map((i) => ({ id: i.id, titulo: i.titulo, detalle: i.detalle ?? null, cuando: cuandoSale(i.inicio, i.diaCompleto, tz, hoy), capa: i.capa, href: i.href })),
    total: despues.length,
  };
}

/** Un día del mes: sus puntos (hasta tres, del color de la capa de lo que tiene agendado), si es hoy y si ya pasó. */
export type DiaDelMes = { dia: string; n: number; colores: string[]; hoy: boolean; paso: boolean };
export type CalendarioServicio = {
  titulo: string;
  /** Las semanas del mes, de lunes a domingo; null = un día de otro mes. */
  semanas: Array<Array<DiaDelMes | null>>;
  hoy: Array<{ id: string; hora: string; titulo: string; color: string; href: string | null }>;
  totalHoy: number;
};
const COLOR_CAPA = Object.fromEntries(CAPAS_CALENDARIO.map((c) => [c.id, c.color])) as Record<string, string>;
export const FILAS_HOY = 3;
/** El mes de hoy con un punto por cada cosa agendada (el Calendario de General trae los próximos 14 días) y lo de hoy. */
export function calendarioDe(items: readonly ItemCalendario[], tz: string, hoy: string): CalendarioServicio {
  const y = Number(hoy.slice(0, 4)), m = Number(hoy.slice(5, 7));
  const primero = `${hoy.slice(0, 7)}-01`;
  const dias = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const capas = new Map<string, string[]>();
  for (const i of [...items].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
    const d = diaEnZona(i.inicio, tz);
    capas.set(d, [...(capas.get(d) ?? []), COLOR_CAPA[i.capa] ?? 'var(--primary)']);
  }
  // El lunes es la primera columna: getUTCDay da 0 al domingo.
  const blancos = (new Date(`${primero}T12:00:00Z`).getUTCDay() + 6) % 7;
  const celdas: Array<DiaDelMes | null> = Array.from({ length: blancos }, () => null);
  for (let k = 0; k < dias; k++) {
    const d = sumarDias(primero, k), de = capas.get(d) ?? [];
    celdas.push({ dia: d, n: de.length, colores: de.slice(0, 3), hoy: d === hoy, paso: d < hoy });
  }
  while (celdas.length % 7) celdas.push(null);
  const semanas = Array.from({ length: celdas.length / 7 }, (_, s) => celdas.slice(s * 7, s * 7 + 7));
  const deHoy = items.filter((i) => diaEnZona(i.inicio, tz) === hoy).sort((a, b) => a.inicio.localeCompare(b.inicio));
  return {
    titulo: `${MESES_LARGOS[m - 1]} ${y}`, semanas, totalHoy: deHoy.length,
    hoy: deHoy.slice(0, FILAS_HOY).map((i) => ({ id: i.id, hora: i.diaCompleto ? 'Todo el día' : horaEn(i.inicio, tz), titulo: i.titulo, color: COLOR_CAPA[i.capa] ?? 'var(--primary)', href: i.href })),
  };
}

/** «Vencida», «Hoy», «Mañana» o «7 nov» (la fecha de Sunrow, «Nov 7»). */
export function cuandoDeFecha(deadline: string, hoy: string): string {
  if (deadline < hoy) return 'Vencida';
  const c = cuandoVence(deadline, hoy);
  return c === 'Hoy' || c === 'Mañana' ? c : `${Number(deadline.slice(8, 10))} ${MESES[Number(deadline.slice(5, 7)) - 1]}`;
}
export type VenceServicio = { id: string; dia: number; mes: string; titulo: string; detalle: string; cuando: string; vencida: boolean; href: string };
export const FILAS_VENCE = 5;
/** Lo que vence del Plan («Upcoming deadlines»): lo vencido primero, después lo que viene, por fecha. */
export function venceDe(tareas: readonly TareaVista[], etiquetas: Parameters<typeof tareaFocus>[1], hoy: string): { lista: VenceServicio[]; total: number } {
  const con = tareas.filter((t) => t.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
  return {
    lista: con.slice(0, FILAS_VENCE).map((t) => {
      const vencida = t.deadline < hoy;
      return {
        id: t.id, dia: Number(t.deadline.slice(8, 10)), mes: MESES[Number(t.deadline.slice(5, 7)) - 1], titulo: t.title,
        detalle: tareaFocus(t, etiquetas, hoy).proyecto?.nombre ?? 'Sin proyecto', cuando: cuandoDeFecha(t.deadline, hoy), vencida,
        href: `/plan?tarea=${encodeURIComponent(t.id)}`,
      };
    }),
    total: con.length,
  };
}

export type TareaServicio = { id: string; titulo: string; detalle: string; prioridad: string; tono: 'bad' | 'warn' | 'good' | 'neutral' };
const TONO_PRIO: Record<string, TareaServicio['tono']> = { alta: 'bad', media: 'warn', baja: 'good', futuro: 'neutral' };
/** Tus prioridades del Plan («My tasks»), en su orden, con su proyecto, cuándo vence y su prioridad. */
export function tareasDe(prioridades: readonly TareaVista[], etiquetas: Parameters<typeof tareaFocus>[1], hoy: string): TareaServicio[] {
  return prioridades.map((t) => {
    const f = tareaFocus(t, etiquetas, hoy);
    return {
      id: t.id, titulo: t.title, detalle: [f.proyecto?.nombre ?? 'Sin proyecto', t.deadline ? cuandoDeFecha(t.deadline, hoy) : null].filter(Boolean).join(' · '),
      prioridad: PLABEL[t.priority] ?? 'Sin priorizar', tono: TONO_PRIO[t.priority] ?? 'neutral',
    };
  });
}

// ── todo junto ──────────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaServicio = {
  frase: string | null;
  chips: { reuniones: number | null; sesiones: number | null; funnels: number | null };
  dia: DiaServicio | null;
  cartera: { pct: number | null; bien: number | null; clientes: number | null; primero: ClienteServicio | null };
  numeros: NumeroServicio[];
  avance: AvanceServicio | null;
  avanzaron: { total: number | null; delta: Delta };
  deben: DebenServicio | null;
  quien: ReturnType<typeof quienDe>;
  etapas: ReturnType<typeof etapasDe>;
  salud: Array<{ titulo: string; link: string; href: string; nivel: 'rojo' | 'ambar' | 'verde' }> | null;
  vence: { lista: VenceServicio[]; total: number } | null;
  calendario: CalendarioServicio | null;
  tareas: TareaServicio[] | null;
  viene: { lista: VieneServicio[]; total: number } | null;
  problemas: Partial<Record<'numeros' | 'avance' | 'deben' | 'quien' | 'etapas' | 'calendario' | 'plan' | 'salud', string>>;
};
export function vistaServicio(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, general: GeneralDeServicio | null, ahora: number): VistaServicio {
  const p = hoja.diseno?.piezas ?? {};
  const err = (k: string | undefined) => (k ? datos[k]?.error : undefined);
  const problemas: VistaServicio['problemas'] = {};
  if (err(p.apertura) || err(p.clientes) || err(p.avanzaron) || err(p.deuda) || err(p.cobrado)) problemas.numeros = 'No pude leer algunos números.';
  if (err(p.ritmo)) problemas.avance = 'No pude leer quién avanzó de etapa.';
  if (err(p.deben) || err(p.deudores)) problemas.deben = 'No pude leer lo que te deben.';
  if (err(p.quien)) problemas.quien = 'No pude leer tu cartera.';
  if (err(p.etapas)) problemas.etapas = 'No pude leer las etapas de la entrega.';
  // Sin los datos de General (un link compartido no los trae) no se pudieron leer: no es «nada agendado».
  const cal = general?.calendario.ok && !general.calendario.d.falla ? general.calendario.d : null;
  const plan = general?.plan.ok ? general.plan.d : null;
  if (!cal) problemas.calendario = 'No pude leer tu Calendario.';
  if (!plan) problemas.plan = 'No pude leer tu Plan.';
  if (!general?.semaforo.ok) problemas.salud = 'No pude leer la salud del negocio.';

  const ap = res(datos, p.apertura);
  const clientes = total(res(datos, p.clientes), 'clientes');
  const atencion = total(ap, 'atencion'), sesiones = total(ap, 'sesiones'), vencidas = total(ap, 'cuotas_vencidas');
  const etapas = etapasDe(res(datos, p.etapas));
  const productos = res(datos, p.producto);
  const funnels = productos ? filasDe(productos).filter((f) => (enFila(productos, f, 'clientes') ?? 0) > 0).length : null;
  const av = res(datos, p.avanzaron), avanzaron = total(av, 'clientes'), avAntes = anteriorDe(av, 'clientes');
  const deuda = total(res(datos, p.deuda), 'deuda_vencida_usd');
  const co = res(datos, p.cobrado), cobrado = total(co, 'cobrado');
  const quien = quienDe(res(datos, p.quien));

  const hoy = cal?.hoy ?? plan?.hoy ?? new Date(ahora).toISOString().slice(0, 10);
  const reuniones = cal ? cal.items.filter((i) => !i.diaCompleto && (i.capa === 'llamadas' || i.capa === 'entregas') && diaEnZona(i.inicio, cal.tz) === hoy).length : null;
  const bien = clientes != null && atencion != null ? Math.max(0, clientes - atencion) : null;

  const numeros: NumeroServicio[] = [
    { id: 'clientes', titulo: 'Clientes', valor: clientes == null ? null : entero(clientes), tile: 'mint', pie: etapas?.cuantas ? { texto: `En ${plural(etapas.cuantas, 'etapa', 'etapas')}`, tono: 'info' } : null },
    { id: 'avanzaron', titulo: 'Avanzaron de etapa', valor: avanzaron == null ? null : entero(avanzaron), tile: null, pie: pieDelCambio(avanzaron, avAntes) },
    { id: 'atencion', titulo: 'Piden atención', valor: atencion == null ? null : entero(atencion), tile: 'blush', pie: clientes != null ? { texto: `De ${plural(clientes, 'cliente', 'clientes')}`, tono: 'info' } : null },
    {
      id: 'sesiones', titulo: 'Sesiones dadas', valor: sesiones == null ? null : entero(sesiones), tile: null,
      pie: sesiones != null && clientes ? { texto: `${(sesiones / clientes).toLocaleString('es-MX', { maximumFractionDigits: 1 })} por cliente`, tono: 'info' } : null,
    },
    { id: 'deuda', titulo: 'Deuda vencida', valor: deuda == null ? null : plata(deuda), tile: 'lemon', pie: vencidas != null ? { texto: vencidas ? plural(vencidas, 'cuota vencida', 'cuotas vencidas') : 'Ninguna cuota vencida', tono: 'info' } : null },
    { id: 'cobrado', titulo: 'Cobrado', valor: cobrado == null ? null : plata(cobrado), tile: null, pie: pieDelCambio(cobrado, anteriorDe(co, 'cobrado')) },
  ];

  return {
    frase: fraseServicio(clientes, etapas?.cuantas ?? null, atencion, vencidas),
    chips: { reuniones, sesiones, funnels },
    dia: cal ? diaDe(cal.items, cal.tz, hoy, ahora) : null,
    cartera: { pct: bien != null && clientes ? Math.round((bien / clientes) * 100) : null, bien, clientes, primero: quien?.lista.find((c) => c.senal === 'Atención') ?? null },
    numeros,
    avance: avanceDe(res(datos, p.ritmo)),
    avanzaron: { total: avanzaron, delta: deltaDe(avanzaron, avAntes) },
    deben: debenServicio(res(datos, p.deben), res(datos, p.deudores)),
    quien,
    etapas,
    salud: general?.semaforo.ok ? general.semaforo.d.alertas.slice(0, 5).map((a) => ({ titulo: a.titulo, link: a.hrefLabel, href: a.href, nivel: a.nivel })) : null,
    vence: plan ? venceDe(plan.deadlines.tareas, plan.etiquetas, plan.hoy) : null,
    calendario: cal ? calendarioDe(cal.items, cal.tz, hoy) : null,
    tareas: plan ? tareasDe(plan.prioridades, plan.etiquetas, plan.hoy) : null,
    viene: cal ? vieneDe(cal.items, cal.tz, hoy) : null,
    problemas,
  };
}

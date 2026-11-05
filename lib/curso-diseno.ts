// =============================================================================
// curso-diseno — lo que dibuja la hoja «Curso o comunidad» con su DISEÑO PROPIO (la copia de Vitrea), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/curso-vitrea/; aquí, de dónde sale cada número con los DATOS REALES: los componentes de la hoja
// (`hoja.diseno.piezas`, lib/general-plantillas.ts, «curso») y el Calendario de General. La pregunta: «¿cuántos siguen ahí?».
//   · arriba (los tres números de Vitrea): los alumnos activos, las ventas y lo cobrado, cada uno contra el período anterior;
//   · «Alumnos que vieron clases» («Proceeds»): el área de cada día, y con «Clases», las clases vistas por semana;
//   · «Cuánto avanzan» («Ratings»): el avance promedio y cuántos alumnos van en cada estado, con los que piden atención abajo;
//   · «Por área» («Your apps»): una tarjeta de color por área, con sus alumnos y su parte;
//   · «Quién te necesita» («Release train»): hace cuánto no hablan, por tramo, y los clientes que piden atención;
//   · «Lo que vas a publicar» («Waiting for a reply»): las próximas publicaciones del Calendario;
//   · «Hoy» («Today»): lo de hoy en el Calendario, con lo que ya pasó tachado.
//
// LO QUE VITREA TIENE Y MaKo NO MIDE NO SE INVENTA: la línea punteada del año anterior, las estrellas de cada reseña, el tren de
// versiones con sus pasos y la actividad del equipo. La permanencia por cohorte (M0…M5) tampoco se mide todavía.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaCurso.tsx) y el test. Lo que no llegó es `null`, nunca un
// cero.
// =============================================================================

import type { DatosGeneral } from '@/app/general/datos-tipos';
import type { Hoja } from './graficos-catalogo';
import { OTROS, SIN_DATO, type Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import { plata } from './cobranza-diseno';
import { diaEnZona, horaEn } from './focus-diseno';
import { TRAMOS_CONTACTO } from './graficos-datos-puro';
import { cambioDe, entero, pasoDe, rotuloDia, type PasoTiempo } from './marketing-diseno';

export type { DatosPieza };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const anteriorDe = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && r.anterior && i >= 0 ? num(r.anterior[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const parte = (n: number | null, de: number | null) => (n != null && de != null && de > 0 ? (n / de) * 100 : null);
/** Las filas de verdad: sin «(sin dato)» ni «Otros». */
const filasDe = (r: Resultado) => r.filas.filter((f) => f.etiqueta && f.clave !== SIN_DATO && f.clave !== OTROS);

// ── los tres números de arriba ──────────────────────────────────────────────────────────────────────────────────────
export type Delta = { texto: string; bueno: boolean } | null;
/** El cambio contra el período anterior («+12%»): más alumnos, más ventas o más cobrado es bueno. */
export function deltaDe(actual: number | null, anterior: number | null): Delta {
  const c = actual != null && anterior != null ? cambioDe('pct', actual, anterior) : null;
  return c && c.d !== 0 ? { texto: c.texto, bueno: c.d > 0 } : null;
}
export type NumeroCurso = { id: 'alumnos' | 'ventas' | 'cobrado'; valor: string | null; delta: Delta; texto: string };
export function numerosDe(alumnos: Resultado | null, ventas: Resultado | null, cobrado: Resultado | null): NumeroCurso[] {
  const a = total(alumnos, 'alumnos'), v = total(ventas, 'cierres'), c = total(cobrado, 'cobrado');
  return [
    { id: 'alumnos', valor: a == null ? null : entero(a), delta: deltaDe(a, anteriorDe(alumnos, 'alumnos')), texto: a === 1 ? 'Alumno activo' : 'Alumnos activos' },
    { id: 'ventas', valor: v == null ? null : entero(v), delta: deltaDe(v, anteriorDe(ventas, 'cierres')), texto: v === 1 ? 'Venta' : 'Ventas' },
    { id: 'cobrado', valor: c == null ? null : plata(c), delta: deltaDe(c, anteriorDe(cobrado, 'cobrado')), texto: 'Cobrado' },
  ];
}

// ── el área: alumnos por día, o clases por semana ───────────────────────────────────────────────────────────────────
export type SerieCurso = { puntos: Array<{ clave: string; rotulo: string; valor: number }>; total: number | null; tope: number; marcas: number[]; paso: PasoTiempo; mejor: string | null };
/** El tope del eje: el primer número «redondo» que cubre el máximo (1, 2, 2.5 o 5 por una potencia de 10). */
export function topeDe(max: number): number {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= max) return k * p;
  return 10 * p;
}
/**
 * Los puntos del eje de abajo que llevan rótulo: hasta `max`, a la MISMA distancia entre sí y contando desde el último (hoy), como
 * los doce meses de Vitrea. Repartirlos con redondeo deja huecos de dos y de tres días, y el eje se lee torcido.
 */
export function marcasDelEje(n: number, max: number): number[] {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const paso = Math.ceil((n - 1) / (Math.max(2, max) - 1));
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i -= paso) out.unshift(i);
  return out;
}
export function serieDe(r: Resultado | null, metrica: string, totalDe: number | null): SerieCurso | null {
  if (!r) return null;
  const puntos = r.filas.map((f) => ({ clave: f.clave, rotulo: '', valor: enFila(r, f, metrica) ?? 0 }));
  if (!puntos.length) return { puntos: [], total: totalDe, tope: 1, marcas: [1, 0.5, 0], paso: 'dia', mejor: null };
  const paso = pasoDe(puntos.map((p) => p.clave));
  for (const p of puntos) p.rotulo = rotuloDia(p.clave, paso);
  const max = Math.max(...puntos.map((p) => p.valor)), tope = topeDe(max);
  const mejor = max > 0 ? puntos.find((p) => p.valor === max)!.rotulo : null;
  return { puntos, total: totalDe, tope, marcas: [tope, tope / 2, 0], paso, mejor };
}

// ── cuánto avanzan ──────────────────────────────────────────────────────────────────────────────────────────────────
export type EstadoCurso = { clave: string; nombre: string; n: number; parte: number | null; tono: 'acc' | 'warn' | 'bad' };
/** Los primeros dos estados (los que más alumnos tienen) en azul, el tercero en amarillo y los demás en coral, como Vitrea. */
const TONOS: EstadoCurso['tono'][] = ['acc', 'acc', 'warn', 'bad', 'bad'];
export const FILAS_ESTADO = 5;
export function estadosDe(r: Resultado | null): { estados: EstadoCurso[]; total: number | null; mas: number } | null {
  if (!r) return null;
  const tot = total(r, 'alumnos');
  const todas = filasDe(r).map((f) => ({ clave: f.clave, nombre: f.etiqueta, n: enFila(r, f, 'alumnos') ?? 0 })).sort((a, b) => b.n - a.n);
  return {
    estados: todas.slice(0, FILAS_ESTADO).map((e, i) => ({ ...e, parte: parte(e.n, tot), tono: TONOS[i] })),
    total: tot, mas: Math.max(0, todas.length - FILAS_ESTADO) + r.fuera,
  };
}

// ── por área ────────────────────────────────────────────────────────────────────────────────────────────────────────
export const TONOS_AREA = ['blue', 'teal', 'orange', 'coral', 'green', 'ink'] as const;
export type AreaCurso = { clave: string; nombre: string; n: number; parte: number | null; tono: (typeof TONOS_AREA)[number] };
export const FILAS_AREA = 6;
export function areasDe(r: Resultado | null): { areas: AreaCurso[]; mas: number } | null {
  if (!r) return null;
  const tot = total(r, 'alumnos');
  const todas = filasDe(r);
  return {
    areas: todas.slice(0, FILAS_AREA).map((f, i) => { const n = enFila(r, f, 'alumnos') ?? 0; return { clave: f.clave, nombre: f.etiqueta, n, parte: parte(n, tot), tono: TONOS_AREA[i % TONOS_AREA.length] }; }),
    mas: Math.max(0, todas.length - FILAS_AREA) + r.fuera,
  };
}

// ── quién te necesita ───────────────────────────────────────────────────────────────────────────────────────────────
export type TramoCurso = { nombre: string; corto: string; n: number; destacado: boolean };
/** «+30 días» en lugar de «Más de 30 días»: la celda del tramo es angosta (son hasta cinco en el ancho de una tarjeta). */
const CORTO_TRAMO: Record<string, string> = { 'Más de 30 días': '+30 días' };
/** Los clientes por hace cuánto no hablan, en el orden de los tramos (de lo más reciente a «Nunca»); el que más tiene se marca. */
export function tramosDe(r: Resultado | null): TramoCurso[] | null {
  if (!r) return null;
  const n = (t: string) => { const f = r.filas.find((x) => x.clave === t); return f ? enFila(r, f, 'clientes') ?? 0 : 0; };
  const tramos = TRAMOS_CONTACTO.map((t) => ({ nombre: t, corto: CORTO_TRAMO[t] ?? t, n: n(t) })).filter((t) => t.n > 0);
  const max = Math.max(0, ...tramos.map((t) => t.n));
  return tramos.map((t) => ({ ...t, destacado: t.n === max && max > 0 }));
}
export type ClienteCurso = { clave: string; nombre: string; senal: string | null; contacto: string | null; atencion: boolean };
export const FILAS_QUIEN = 4;
export function clientesDe(r: Resultado | null): { lista: ClienteCurso[]; mas: number } | null {
  if (!r) return null;
  const todas = filasDe(r);
  return {
    lista: todas.slice(0, FILAS_QUIEN).map((f) => {
      const senal = f.extra?.senal && f.extra.senal !== SIN_DATO ? f.extra.senal : null;
      const contacto = f.extra?.tramo_contacto && f.extra.tramo_contacto !== SIN_DATO ? f.extra.tramo_contacto : null;
      return { clave: f.clave, nombre: f.etiqueta, senal, contacto, atencion: senal === 'Atención' };
    }),
    mas: Math.max(0, todas.length - FILAS_QUIEN) + r.fuera,
  };
}

// ── el Calendario: lo que vas a publicar y lo de hoy ────────────────────────────────────────────────────────────────
/** Lo único que la hoja lee de los datos de General: el Calendario (la miniatura de «Nueva hoja» trae sólo eso, de ejemplo). */
export type CalendarioDeGeneral = Pick<DatosGeneral, 'calendario'>;
export type PublicacionCurso = { id: string; titulo: string; detalle: string | null; cuando: string; href: string | null };
export const FILAS_PUBLICACIONES = 3;
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «Hoy, 10:00», «Mañana, 18:30», «jue 6 nov, 09:00»: cuándo sale una publicación, en la zona del negocio. */
export function cuandoSale(iso: string, diaCompleto: boolean, tz: string, hoy: string): string {
  const dia = diaEnZona(iso, tz);
  const manana = (() => { const d = new Date(`${hoy}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
  const fecha = new Date(`${dia}T12:00:00Z`);
  const nombre = dia === hoy ? 'Hoy' : dia === manana ? 'Mañana' : `${DIAS[fecha.getUTCDay()]} ${fecha.getUTCDate()} ${MESES[fecha.getUTCMonth()]}`;
  return diaCompleto ? nombre : `${nombre}, ${horaEn(iso, tz)}`;
}
export function publicacionesDe(general: CalendarioDeGeneral | null, ahora: number): { lista: PublicacionCurso[]; total: number } | null {
  const cal = general?.calendario.ok ? general.calendario.d : null;
  if (!cal || cal.falla) return null;
  const proximas = cal.items.filter((i) => i.capa === 'publicaciones' && new Date(i.fin ?? i.inicio).getTime() >= ahora)
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
  return {
    lista: proximas.slice(0, FILAS_PUBLICACIONES).map((i) => ({ id: i.id, titulo: i.titulo, detalle: i.detalle ?? null, cuando: cuandoSale(i.inicio, i.diaCompleto, cal.tz, cal.hoy), href: i.href })),
    total: proximas.length,
  };
}
export type HoyCurso = { id: string; hora: string; titulo: string; detalle: string | null; paso: boolean; href: string | null };
export const FILAS_HOY = 4;
export function hoyDe(general: CalendarioDeGeneral | null, ahora: number): { lista: HoyCurso[]; pasaron: number; total: number } | null {
  const cal = general?.calendario.ok ? general.calendario.d : null;
  if (!cal || cal.falla) return null;
  const deHoy = cal.items.filter((i) => diaEnZona(i.inicio, cal.tz) === cal.hoy).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const paso = (i: (typeof deHoy)[number]) => i.hecho === true || new Date(i.fin ?? i.inicio).getTime() < ahora;
  return {
    lista: deHoy.slice(0, FILAS_HOY).map((i) => ({ id: i.id, hora: i.diaCompleto ? 'Todo el día' : horaEn(i.inicio, cal.tz), titulo: i.titulo, detalle: i.detalle ?? null, paso: paso(i), href: i.href })),
    pasaron: deHoy.filter(paso).length, total: deHoy.length,
  };
}

// ── todo junto ──────────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaCurso = {
  numeros: NumeroCurso[];
  alumnosDia: SerieCurso | null;
  clasesSemana: SerieCurso | null;
  /** Las clases vistas del período y su cambio contra el anterior (la frase de la plantilla). */
  clases: { total: number | null; delta: Delta };
  avance: number | null;
  estados: ReturnType<typeof estadosDe>;
  atencion: number | null;
  areas: ReturnType<typeof areasDe>;
  tramos: TramoCurso[] | null;
  clientes: ReturnType<typeof clientesDe>;
  publicaciones: ReturnType<typeof publicacionesDe>;
  hoy: ReturnType<typeof hoyDe>;
  problemas: Partial<Record<'numeros' | 'grafico' | 'avance' | 'areas' | 'quien' | 'calendario', string>>;
};
export function vistaCurso(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, general: CalendarioDeGeneral | null, ahora: number): VistaCurso {
  const p = hoja.diseno?.piezas ?? {};
  const err = (k: string | undefined) => (k ? datos[k]?.error : undefined);
  const problemas: VistaCurso['problemas'] = {};
  if (err(p.alumnos) || err(p.ventas) || err(p.cobrado)) problemas.numeros = 'No pude leer algunos números.';
  if (err(p.tendencia) || err(p.semana)) problemas.grafico = 'No pude leer las clases que vieron.';
  if (err(p.avance) || err(p.estado)) problemas.avance = 'No pude leer cuánto avanzan.';
  if (err(p.area)) problemas.areas = 'No pude leer los alumnos por área.';
  if (err(p.quien) || err(p.contacto)) problemas.quien = 'No pude leer tu cartera.';
  // Sin los datos de General (un link compartido no los trae) el Calendario tampoco se pudo leer: no es «nada agendado».
  if (!general || !general.calendario.ok || general.calendario.d.falla) problemas.calendario = 'No pude leer tu Calendario.';
  const ap = res(datos, p.apertura), alumnos = res(datos, p.alumnos);
  const clases = total(ap, 'clases');
  return {
    numeros: numerosDe(alumnos, res(datos, p.ventas), res(datos, p.cobrado)),
    alumnosDia: serieDe(res(datos, p.tendencia), 'alumnos', total(alumnos, 'alumnos')),
    clasesSemana: serieDe(res(datos, p.semana), 'clases', clases),
    clases: { total: clases, delta: deltaDe(clases, anteriorDe(ap, 'clases')) },
    avance: total(res(datos, p.avance), 'avance'),
    estados: estadosDe(res(datos, p.estado)),
    atencion: total(res(datos, p.atencion), 'atencion'),
    areas: areasDe(res(datos, p.area)),
    tramos: tramosDe(res(datos, p.contacto)),
    clientes: clientesDe(res(datos, p.quien)),
    publicaciones: publicacionesDe(general, ahora),
    hoy: hoyDe(general, ahora),
    problemas,
  };
}

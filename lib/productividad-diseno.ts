// =============================================================================
// productividad-diseno — lo que dibuja la hoja Productividad con su DISEÑO PROPIO (la copia de Fernly), con los datos de MaKo
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia, es decir, que se vea exactamente igual que la copia, y después la adaptación
// con Maco» y «Después seguí con la segunda hoja, de a una». La copia y la adaptación están en
// docs/diseno/mockups-dashboard/productividad-fernly/; acá, de dónde sale cada número con los DATOS REALES: los componentes de la
// hoja (`hoja.diseno.piezas`, lib/graficos-plantillas-analysts.ts, «productividad»). La pregunta: «¿qué avanza y qué se estancó?».
//   · la cabecera: la frase de cuántas tareas hay activas, en curso y hechas;
//   · las cuatro tarjetas de arriba: el avance global de los proyectos, las estancadas, las de Alta sin deadline y cuántas se
//     cerraron a tiempo;
//   · «Lo que vence, por semana» («Project Analytics»): una columna por semana de lo que tiene deadline en los próximos 30 días;
//   · «Lo que más tiempo lleva quieto» («Reminders») y «Lo que huele mal» («Team Collaboration»): la lista de las activas que
//     nadie toca, la primera arriba y las que siguen abajo;
//   · «Proyectos» («Project»): los proyectos activos con su avance;
//   · «Tus tareas» («Project Progress»): el medio arco de las hechas, las en curso y las que no empezaron;
//   · «Activas por prioridad» («Time Tracker»): cuántas activas hay en Alta, en Media y en Baja.
//
// LO QUE FERNLY TIENE Y MaKo NO MIDE NO SE INVENTA: el tiempo que se trabajó (su cronómetro), quién del equipo trabaja en qué
// (las tareas del Plan no tienen responsable en esta fuente) y la comparación con el mes anterior (la hoja no tiene período: es
// la foto de hoy del tablero). Por eso las tarjetas no llevan «↑ desde el mes pasado» y la lista de abajo son tareas, no personas.
//
// Puro y sin `server-only`: lo usan la pantalla (app/dashboard/disenos/HojaProductividad.tsx) y el test. Lo que no llegó es
// `null`, nunca un cero.
// =============================================================================

import type { Hoja } from './graficos-catalogo';
import type { Resultado } from './graficos-agregar';
import type { DatosPieza } from './closing-diseno';
import type { Trozo } from './comercial-diseno';
import { inicialesDe } from './chat-diseno';
import { entero } from './marketing-diseno';

export type { DatosPieza, Trozo };

const num = (v: number | null | undefined): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const res = (datos: Record<string, DatosPieza>, id: string | undefined): Resultado | null => (id ? datos[id]?.resultado ?? null : null);
const col = (r: Resultado | null, metrica: string) => (r ? r.columnas.findIndex((c) => c.id === metrica) : -1);
const total = (r: Resultado | null, metrica: string): number | null => { const i = col(r, metrica); return r && i >= 0 ? num(r.totales[i]) : null; };
const enFila = (r: Resultado, f: Resultado['filas'][number], metrica: string): number | null => { const i = col(r, metrica); return i >= 0 ? num(f.valores[i]) : null; };
const plural = (n: number, uno: string, varios: string) => `${entero(n)} ${n === 1 ? uno : varios}`;

// ── la cabecera ─────────────────────────────────────────────────────────────────────────────────────────────────
/** «Tienes 34 tareas activas: 8 en curso. Ya hiciste 120.» */
export function fraseProductividad(activas: number | null, enCurso: number | null, hechas: number | null): Trozo[] {
  if (activas == null) return [];
  if (activas === 0 && !hechas) return [{ tipo: 'texto', s: 'Todavía no hay tareas en tu Plan.' }];
  const out: Trozo[] = [];
  if (activas === 0) out.push({ tipo: 'texto', s: 'No tienes tareas activas.' });
  else {
    out.push({ tipo: 'texto', s: 'Tienes ' }, { tipo: 'fuerte', s: entero(activas) }, { tipo: 'texto', s: activas === 1 ? ' tarea activa' : ' tareas activas' });
    if (enCurso != null && enCurso > 0) out.push({ tipo: 'texto', s: ': ' }, { tipo: 'fuerte', s: entero(enCurso) }, { tipo: 'texto', s: ' en curso.' });
    else out.push({ tipo: 'texto', s: '.' });
  }
  if (hechas != null && hechas > 0) out.push({ tipo: 'texto', s: ' Ya hiciste ' }, { tipo: 'fuerte', s: entero(hechas) }, { tipo: 'texto', s: '.' });
  return out;
}

// ── las cuatro tarjetas ─────────────────────────────────────────────────────────────────────────────────────────
export type IdTarjetaPr = 'avance' | 'estancadas' | 'alta' | 'tiempo';
export type TarjetaPr = { id: IdTarjetaPr; titulo: string; valor: string | null; sub: string; ok?: boolean };
/** La parte entera de un %, sin pasarse de 100 («42%»), o null. */
export const pct = (v: number | null) => (v == null ? null : `${Math.round(Math.max(0, Math.min(100, v)))}%`);
export function tarjetasDe(avance: number | null, estancadas: number | null, alta: number | null, cumplimiento: number | null): TarjetaPr[] {
  return [
    { id: 'avance', titulo: 'Avance global', valor: pct(avance), sub: 'El promedio de tus proyectos' },
    { id: 'estancadas', titulo: 'Estancadas', valor: estancadas == null ? null : entero(estancadas), sub: 'Más de 7 días sin moverse' },
    { id: 'alta', titulo: 'Alta sin deadline', valor: alta == null ? null : entero(alta), sub: 'Prioridad alta y sin fecha' },
    // Sin ninguna cerrada con deadline, el % no existe: «Sin datos», no un cero.
    { id: 'tiempo', titulo: 'A tiempo', valor: pct(cumplimiento), sub: cumplimiento == null ? 'Todavía sin tareas con deadline cerradas' : 'De las que cerraste con deadline', ok: cumplimiento != null },
  ];
}

// ── lo que vence, por semana ─────────────────────────────────────────────────────────────────────────────────────
export type ColumnaPr = { clave: string; rotulo: string; n: number; alto: number; tono: 'semana' | 'lleno' | 'vacio'; tope: boolean };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** «3 nov», de la clave del lunes de la semana (`YYYY-MM-DD`). */
export const rotuloSemana = (clave: string) => { const [, m, d] = clave.split('-').map(Number); return d && m ? `${d} ${MESES[m - 1] ?? ''}`.trim() : clave; };
/**
 * La columna más baja con algo adentro: un 1 contra un 40 igual se ve. La vacía es un tramo rayado chico. La más alta llega a
 * ALTO_MAX y no al tope, porque lleva encima la marca con su número (en Fernly, la marca va sobre una columna más baja).
 */
export const ALTO_MIN = 0.16, ALTO_VACIO = 0.12, ALTO_MAX = 0.78;
/**
 * Una columna por semana (las filas de tiempo ya traen todas las del rango). La de ESTA semana (la que contiene `hoy`) va oscura,
 * las que tienen algo, verdes, y las vacías, rayadas. La marca con el número va sobre la más alta.
 */
export function columnasDe(r: Resultado | null, hoy: string): ColumnaPr[] | null {
  if (!r) return null;
  const filas = r.filas.map((f) => ({ clave: f.clave, n: enFila(r, f, 'abiertas') ?? 0 }));
  if (!filas.length) return [];
  const max = Math.max(...filas.map((f) => f.n));
  const lunes = [...filas].reverse().find((f) => f.clave <= hoy)?.clave ?? null;
  let tope = -1;
  if (max > 0) tope = filas.findIndex((f) => f.n === max);
  return filas.map((f, i) => ({
    clave: f.clave, rotulo: rotuloSemana(f.clave), n: f.n,
    alto: max > 0 && f.n > 0 ? ALTO_MIN + (ALTO_MAX - ALTO_MIN) * (f.n / max) : ALTO_VACIO,
    tono: f.clave === lunes ? 'semana' : f.n > 0 ? 'lleno' : 'vacio',
    tope: i === tope,
  }));
}

// ── lo que huele mal (el recordatorio y la lista) ────────────────────────────────────────────────────────────────
export type QuietaPr = { clave: string; tarea: string; iniciales: string; dias: number | null; movidas: number | null; estado: 'quieta' | 'se-corre' | 'al-dia' };
/** «Sin tocar hace 12 días», «Se tocó hoy». */
export function textoQuieta(dias: number | null): string {
  if (dias == null) return 'Sin fecha de su último cambio';
  if (dias <= 0) return 'Se tocó hoy';
  return `Sin tocar hace ${plural(dias, 'día', 'días')}`;
}
/** Los MISMOS umbrales que `metricasProductividad` (lib/productividad-metricas.ts): 7 días quieta, 2 o más movidas. */
export const DIAS_ESTANCADA = 7, MOVIDAS_CORRIDO = 2;
export function estadoQuieta(dias: number | null, movidas: number | null): QuietaPr['estado'] {
  if (movidas != null && movidas >= MOVIDAS_CORRIDO) return 'se-corre';
  if (dias != null && dias > DIAS_ESTANCADA) return 'quieta';
  return 'al-dia';
}
export const ROTULO_ESTADO: Readonly<Record<QuietaPr['estado'], string>> = { quieta: 'Quieta', 'se-corre': 'Se corre', 'al-dia': 'Al día' };
export const FILAS_LISTA = 4;
/** Las activas, de la que más tiempo lleva quieta a la que menos (el orden de la pieza). */
export function quietasDe(r: Resultado | null): { lista: QuietaPr[]; fuera: number } | null {
  if (!r) return null;
  const lista = r.filas.filter((f) => f.etiqueta && f.clave !== '(sin dato)').map((f) => {
    const dias = enFila(r, f, 'dias_quieta'), movidas = enFila(r, f, 'movidas_deadline');
    return { clave: f.clave, tarea: f.etiqueta, iniciales: inicialesDe(f.etiqueta), dias, movidas, estado: estadoQuieta(dias, movidas) };
  });
  return { lista, fuera: r.fuera };
}

// ── el avance por proyecto ───────────────────────────────────────────────────────────────────────────────────────
export type ProyectoPr = { clave: string; nombre: string; avance: number | null };
export const FILAS_PROYECTOS = 5;
export function proyectosDe(r: Resultado | null): { lista: ProyectoPr[]; mas: number } | null {
  if (!r) return null;
  const todos = r.filas.filter((f) => f.etiqueta && f.clave !== '(sin dato)').map((f) => ({ clave: f.clave, nombre: f.etiqueta, avance: enFila(r, f, 'avance_proyectos') }));
  return { lista: todos.slice(0, FILAS_PROYECTOS), mas: Math.max(0, todos.length - FILAS_PROYECTOS) + r.fuera };
}

// ── tus tareas (el medio arco) ───────────────────────────────────────────────────────────────────────────────────
export type ArcoPr = { total: number; hechas: number; enCurso: number; porEmpezar: number; pctHechas: number };
/** Las hechas, las en curso y las activas que no empezaron (sin avance), como partes de TODAS las tareas. */
export function arcoDe(activas: number | null, enCurso: number | null, hechas: number | null): ArcoPr | null {
  if (activas == null || hechas == null) return null;
  const curso = Math.min(enCurso ?? 0, activas);
  const tot = activas + hechas;
  if (tot <= 0) return null;
  return { total: tot, hechas, enCurso: curso, porEmpezar: activas - curso, pctHechas: (hechas / tot) * 100 };
}

// ── activas por prioridad ────────────────────────────────────────────────────────────────────────────────────────
export type PrioridadPr = { nombre: string; n: number };
export const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const;
/** Alta, Media y Baja siempre (un cero es un dato), y «A futuro» aparte, en una línea, si hay. */
export function prioridadesDe(r: Resultado | null): { tres: PrioridadPr[]; futuro: number } | null {
  if (!r) return null;
  const n = (k: string) => { const f = r.filas.find((x) => x.clave === k); return f ? enFila(r, f, 'activas') ?? 0 : 0; };
  return { tres: PRIORIDADES.map((k) => ({ nombre: k, n: n(k) })), futuro: n('A futuro') };
}

// ── todo junto ───────────────────────────────────────────────────────────────────────────────────────────────────
export type VistaProductividad = {
  frase: Trozo[];
  tarjetas: TarjetaPr[];
  columnas: ColumnaPr[] | null;
  quietas: { lista: QuietaPr[]; fuera: number } | null;
  proyectos: { lista: ProyectoPr[]; mas: number } | null;
  arco: ArcoPr | null;
  prioridades: { tres: PrioridadPr[]; futuro: number } | null;
  problemas: Partial<Record<'frase' | 'tarjetas' | 'columnas' | 'quietas' | 'proyectos' | 'prioridades', string>>;
};
export function vistaProductividad(hoja: Pick<Hoja, 'diseno'>, datos: Record<string, DatosPieza>, hoy: string): VistaProductividad {
  const p = hoja.diseno?.piezas ?? {};
  const err = (k: string | undefined) => (k ? datos[k]?.error : undefined);
  const problemas: VistaProductividad['problemas'] = {};
  if (err(p.apertura)) problemas.frase = 'No pude leer tu tablero.';
  if (err(p.avance) || err(p.estancadas) || err(p.alta) || err(p.cumplimiento)) problemas.tarjetas = 'No pude leer algunos números.';
  if (err(p.vence)) problemas.columnas = 'No pude leer lo que vence.';
  if (err(p.huele)) problemas.quietas = 'No pude leer tus tareas quietas.';
  if (err(p.proyectos)) problemas.proyectos = 'No pude leer tus proyectos.';
  if (err(p.piramide)) problemas.prioridades = 'No pude leer la prioridad de tus tareas.';
  const ap = res(datos, p.apertura);
  const activas = total(ap, 'activas'), enCurso = total(ap, 'en_curso'), hechas = total(ap, 'hechas');
  return {
    frase: fraseProductividad(activas, enCurso, hechas),
    tarjetas: tarjetasDe(total(res(datos, p.avance), 'avance_proyectos'), total(res(datos, p.estancadas), 'estancadas'),
      total(res(datos, p.alta), 'alta_sin_deadline'), total(res(datos, p.cumplimiento), 'cumplimiento')),
    columnas: columnasDe(res(datos, p.vence), hoy),
    quietas: quietasDe(res(datos, p.huele)),
    proyectos: proyectosDe(res(datos, p.proyectos)),
    arco: arcoDe(activas, enCurso, hechas),
    prioridades: prioridadesDe(res(datos, p.piramide)),
    problemas,
  };
}

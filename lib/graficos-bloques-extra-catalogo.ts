// =============================================================================
// graficos-bloques-extra-catalogo — los bloques de las tabs de Analysts (punto 22)
// =============================================================================
// Lo que de Ads, Landing, Closing y Productivity Analyst no entra en el agregador genérico (el
// cuadrante de retención, los patrones, el mapa de calor, los factores del cierre…). Se suma a
// BLOQUES (lib/graficos-catalogo.ts). Sus datos: lib/graficos-bloques-extra.ts; su dibujo:
// app/dashboard/bloques/extra/CuerpoBloqueExtra.tsx.
// Puro y sin server-only: lo leen el catálogo, el server, la pantalla y los tests. Acá viven también
// los TIPOS de lo que cada bloque recibe, para que el server y el dibujo no se separen.
//
// Por qué cada uno es un bloque y no un gráfico del catálogo:
//   · patrones_guiones   compara anuncios contra anuncios (con y sin un tag, el ángulo más eficiente) y
//                        escribe frases. Es el histórico completo, como la tab: no tiene ventana.
//   · cuadrante_retencion ejes y divisorias FIJOS (0-55 / 0-30, cortes en 28% y 10%) y la retención al CTA,
//                        que sale de la curva por cuartiles y no es una razón de sumas.
//   · mapa_calor         la foto reconstruida de una grabación con el calor encima (el de la tab, tal cual).
//   · curva_vsl          20 cortes con monotonía y el denominador «medidos»: invariantes ENTRE filas.
//   · embudo_cierre / factores_cierre / closers_cierre: diferencias entre grupos (ganadas − perdidas), el
//                        punto débil de cada closer y ejemplos que abren la llamada.
//   · llamadas_cierre    la LISTA de la tab Closing (búsqueda, filtros y orden en la pantalla) y la entrada a
//                        la ficha de cada llamada, con sus tareas (decisión de Martín del 11/10/2026: la tab
//                        Closing se elimina y TODO va a su hoja). Una fila por llamada no es una suma.
//   · matriz_proyectos / piramide_prioridad / tareas_atencion: la cruz 50/50 con sus cuadrantes, el orden
//                        FIJO de las bandas (el agregador ordena por valor y borra la banda en cero) y las
//                        listas de tareas sueltas con un umbral.

import type { InfoBloque } from './graficos-catalogo';
import type { Confianza, Polarity, Veredicto } from './ads-analyst-patrones';
import type { PuntoCurva } from './vsl-retencion';
import type { Prio } from '@/app/plan/board/types';

export const BLOQUES_EXTRA: readonly InfoBloque[] = [
  // Ads Analyst
  { id: 'patrones_guiones', nombre: 'Patrones de los guiones', linea: 'Qué seguir, qué cortar y cómo estás probando', w: 12, h: 14 },
  { id: 'cuadrante_retencion', nombre: 'Cuadrante de retención', linea: 'Hook rate contra retención al CTA, anuncio por anuncio', w: 12, h: 13 },
  // Landing Analyst
  { id: 'mapa_calor', nombre: 'Mapa de calor', linea: 'Dónde toca la gente, sobre la foto de una grabación', w: 12, h: 24 },
  { id: 'curva_vsl', nombre: 'Curva del video', linea: 'Cuánta gente sigue mirando en cada tramo del video', w: 8, h: 12 },
  // Closing Analyst
  { id: 'embudo_cierre', nombre: 'Embudo de llamadas', linea: 'Diagnóstico, propuesta y cierre ganado', w: 6, h: 10 },
  { id: 'factores_cierre', nombre: 'Factores del cierre', linea: 'Qué dimensión separa las ganadas de las perdidas', w: 12, h: 14 },
  { id: 'closers_cierre', nombre: 'El equipo de closers', linea: 'Puntaje, llamadas, ganadas y punto débil de cada uno', w: 12, h: 10 },
  { id: 'llamadas_cierre', nombre: 'Las llamadas', linea: 'Cada llamada de venta: búscala, ábrela y revísala', w: 12, h: 18 },
  // Productivity Analyst
  { id: 'matriz_proyectos', nombre: 'Impacto × Esfuerzo', linea: 'Cada proyecto en su cuadrante: qué hacer primero', w: 7, h: 14 },
  { id: 'piramide_prioridad', nombre: 'Pirámide de prioridad', linea: 'Tareas activas por banda, de Alta a A futuro', w: 5, h: 14 },
  { id: 'tareas_atencion', nombre: 'Lo que huele mal', linea: 'Estancadas, Alta sin deadline y deadlines corridos', w: 12, h: 12 },
];

/** Lo que cada bloque recibe, por id. */
export type GuionResumen = { id: string; nombre: string; angulo: string; hook: number; ret: number; gasto: number; agendas: number; veredicto: Veredicto };
export type DatosPatrones = {
  /** Guiones con señal y, de ésos, los de confianza media o alta. */
  total: number; confiables: number;
  patrones: Array<{ key: string; polarity: Polarity; chip: string; big: string; tlabel: string; stmt: string; aLabel: string; aVal: string; a: number; bLabel: string; bVal: string; b: number; max: number; ads: GuionResumen[] }>;
  muestraChica: GuionResumen[];
};
export type DatosCuadrante = {
  puntos: Array<{ id: string; nombre: string; angulo: string; hook: number; hold: number; gasto: number; impresiones: number; agendas: number; confianza: Confianza; veredicto: Veredicto }>;
};
export type VideoCurva = {
  id: string; nombre: string; hayDatos: boolean; arrancaron: number; medidos: number; sinMedicion: number;
  curva: PuntoCurva[]; mayorCaida: { desde: number; hasta: number; perdidos: number; pct: number } | null; medianaPct: number | null;
  salidas: Array<{ corte: number; salidas: number }>;
};
export type DatosCurvaVsl = { videos: VideoCurva[] };
export type DatosEmbudoCierre = { r1: number; r2: number; ganadasR2: number; tasa: number | null };
export type EjemploLlamada = { id: number; fecha: string | null; tipo: string | null; puntaje: number };
export type DatosFactores = {
  ganadas: number; perdidas: number; enProceso: number;
  dimensiones: Array<{ dimension: string; ganadas: number | null; perdidas: number | null; equipo: number | null; brecha: number | null; brillo: EjemploLlamada[]; falto: EjemploLlamada[] }>;
};
/** ⚠️ Trae NOMBRES de personas (los closers): no se le manda a ningún modelo de IA. */
export type DatosClosers = { closers: Array<{ closer: string; llamadas: number; puntaje: number | null; ganadas: number; flojo: { dimension: string; puntaje: number | null } | null }> };
/**
 * Una fila de «Las llamadas»: lo justo para la lista (el detalle se pide al abrir la ficha, a
 * GET /api/closing/llamada). `nombre` es el de la tab: el lead, si no el email del invitado, si no el título.
 * ⚠️ Trae NOMBRES y emails de personas: no se le manda a ningún modelo de IA.
 */
export type FilaLlamada = {
  id: number; fecha: string | null; tipo: string | null; closer: string | null; nombre: string | null; empresa: string | null;
  email: string | null; titulo: string | null; puntaje: number | null; tono: 'good' | 'warn' | 'bad' | null; minutos: number | null; conTranscript: boolean;
};
/** Los contadores de TODO lo procesado (getClosingViewData): no tienen período, como en la tab. */
export type ContadoresClosing = { ventas: number; servicio: number; internas: number; test: number; errores: number; pendientes: number; total: number };
export type DatosLlamadas = { llamadas: FilaLlamada[]; counts: ContadoresClosing; ultimaSync: string | null };
export type ProyectoMatriz = { id: string; nombre: string; emoji: string; impacto: number | null; esfuerzo: number | null; tareas: number; completo: boolean };
export type DatosMatriz = { proyectos: ProyectoMatriz[] };
export type DatosPiramide = { piramide: Record<Prio, number>; activas: number };
/** ⚠️ Trae TÍTULOS de tareas, que pueden nombrar personas: no se le manda a ningún modelo de IA. */
export type TareaAtencion = { id: string; titulo: string; score: number; extra: string };
export type DatosAtencion = { estancadas: TareaAtencion[]; altaSinDeadline: TareaAtencion[]; corridos: Array<TareaAtencion & { n: number }>; proyectosSinDeadline: number; tareasSinDeadline: number };

/**
 * Los bloques cuyos datos traen nombres de personas o textos libres (el mapa: la foto es el DOM de una
 * visita real). ⚠️ HOY NO TIENE CALL SITE, a propósito: el AI Analyst no lee ningún bloque
 * (lib/graficos-analisis-server.ts: «Los bloques todavía no se analizan»). El día que empiece a leerlos,
 * éstos se dejan afuera en positivo desde esta lista; no se reescribe otra.
 */
export const BLOQUES_CON_PERSONAS: readonly string[] = ['closers_cierre', 'llamadas_cierre', 'tareas_atencion', 'mapa_calor'];

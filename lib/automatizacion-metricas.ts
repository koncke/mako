// =============================================================================
// automatizacion-metricas — la pestaña «Métricas» de UNA automatización (puro, sin server-only)
// =============================================================================
// Martín, 23/10/2026 20:56: «Algo muy importante que falta, es en cada Automatización ver una pestaña de métricas...
// Me imagino como un botón al lado del botón de configuraciones. Cuando se apreta, todo el lienzo se reemplaza por el
// dashboard de esas métricas... Por defecto MaKo lo debe armar solo, con los bloques que considere. Pero se debe poder
// personalizar al igual que en Dashboard y un botón para llevar esas métricas como nueva hoja a la tab de dashboard.»
//
// La estructura es la de las métricas de un flujo en Klaviyo y en HubSpot: arriba los totales del flujo (entraron,
// en curso, respondieron), abajo lo que pasó por día y lo que pasó EN CADA PASO del flujo (cuántos llegan a cada
// tarjeta). Acá no es otra pantalla: es el EDITOR DEL DASHBOARD (`EditorInforme`) con un TERCER informe, uno por
// automatización y por persona (`automatizacion.informe.<id>.<sub>`, lib/graficos-tablero.ts), como General.
//
//   · El informe se llama `automatizacion:<id>` (`informeDeAutomatizacion`). Es lo que viaja en `?informe=`.
//   · Cada hoja mira SÓLO esa automatización con un filtro FIJO (`fijo: true`, no se dibuja ni se cambia mirando) sobre
//     el campo compartido «Automatización» (`conLaAutomatizacion`). ⚠️ Ese campo es el NOMBRE (las fuentes
//     `inscripciones` y `envios` lo traen así): al abrir, el filtro se re-escribe con el nombre de HOY, así que
//     renombrarla no deja la hoja en cero. Una hoja llevada al Dashboard sí queda con el nombre del día en que se llevó.
//   · La plantilla la arma MaKo mirando el FLUJO (`definicionDeMetricas`): sin email no hay «Tasa de apertura», sin un
//     aviso al equipo no hay «Avisos al equipo», sin un AI Step ni un «Contestó» no hay «Horas hasta responder».
//   · Cada número sale de una fuente medida: `nutricion_inscripciones` y `nutricion_envios` (lib/graficos-datos.ts).
// =============================================================================

import { nombreDeTarjeta, esMako } from './flujo-conversacion';
import { esPasoIA, idDe, type PasoGrafo } from './flujo-grafo';
import { OP_AVISAR } from './flujo-legado';
import { ESTADOS_RESPONDIO } from './graficos-datos-puro';
import { plantilla, type DefinicionGeneral, type PiezaPlantilla } from './graficos-plantillas-generales';
import { sanearControlVista, sanearHoja, MAX_CONTROLES, type ControlVista, type Hoja, type Tablero } from './graficos-catalogo';

// ── El informe ───────────────────────────────────────────────────────────────────────────

// El nombre del informe vive en lib/informe-automatizacion.ts (sin imports: lo importa el editor del Dashboard).
export { informeDeAutomatizacion, idDeInformeAutomatizacion, claveInformeAutomatizacion, type InformeAutomatizacion } from './informe-automatizacion';

// ── Lo que cuentan las fuentes (lo usa lib/graficos-datos.ts) ──────────────────────────────

const TOPE_TARJETA = 70;

/**
 * Cómo se llama una tarjeta del flujo en un gráfico: su lugar en el flujo y lo que la tarjeta dice
 * («03 · WhatsApp: Hola {{nombre}}…»). El número va primero y con dos cifras para que las barras salgan EN EL ORDEN
 * DEL FLUJO (la dimensión ordena por la etiqueta, `ordenEtiqueta`), como el embudo por paso de Klaviyo.
 * null = el envío no dice de qué tarjeta salió (los de antes del lienzo) o la tarjeta ya no está.
 */
export function rotuloDeTarjeta(pasos: readonly PasoGrafo[], nodoId: string | null | undefined): string | null {
  if (!nodoId) return null;
  const i = pasos.findIndex((p, k) => idDe(p, k) === nodoId);
  if (i < 0) return null;
  const nombre = nombreDeTarjeta(pasos, nodoId).replace(/\s+/g, ' ').trim();
  const corto = nombre.length > TOPE_TARJETA ? `${nombre.slice(0, TOPE_TARJETA - 1).trimEnd()}…` : nombre;
  return `${String(i + 1).padStart(2, '0')} · ${corto}`;
}

export type TipoDeEnvio = 'Mensaje' | 'Aviso al equipo' | 'Acción';
/**
 * Qué fue un envío. `asunto` guarda el ASUNTO de un email y la OPERACIÓN de una acción (`avisar_al_equipo`,
 * `proponer_cambio_etapa`…, lib/nutricion.ts): una operación es un id en minúsculas con guiones bajos; un asunto de
 * email, no. Una acción que falló queda `fallo` con su operación en `asunto`: también es una acción.
 */
export function tipoDeEnvio(estado: string | null | undefined, asunto: string | null | undefined): TipoDeEnvio {
  if (asunto === OP_AVISAR) return 'Aviso al equipo';
  if (estado === 'accion' || (asunto != null && /^[a-z][a-z0-9_]{2,60}$/.test(asunto))) return 'Acción';
  return 'Mensaje';
}

/**
 * Las horas desde que la persona entró hasta que contestó, o null si no contestó. No hay una columna con la hora de la
 * respuesta (`nutricion_envios.respondio_at` no lo escribe nadie, lib/graficos-datos-puro.ts): se toma cuándo terminó
 * por contestar (`desenlace_at`) o, si no, la última vez que cambió su estado (`updated_at`), que es cuando el motor la
 * pausó al responder. Es una aproximación HONESTA: puede quedar de más, nunca de menos.
 */
export function horasHastaResponder(i: { estado: string | null; inscripto_at: string | null; desenlace_at: string | null; updated_at?: string | null }): number | null {
  if (!ESTADOS_RESPONDIO.has(String(i.estado ?? ''))) return null;
  const desde = Date.parse(i.inscripto_at ?? '');
  const hasta = Date.parse(i.desenlace_at ?? i.updated_at ?? '');
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta < desde) return null;
  return Math.round(((hasta - desde) / 3_600_000) * 10) / 10;
}

/** Los estados de una inscripción que ya terminó (no sigue en el flujo). */
export const ESTADOS_TERMINADA: ReadonlySet<string> = new Set(['completada', 'cancelada', 'no_responde', 'respondio', 'handoff']);

// ── La plantilla que arma MaKo ────────────────────────────────────────────────────────────

/** Lo que el flujo trae, para decidir qué bloques van. */
export function rasgosDelFlujo(pasos: readonly PasoGrafo[]): { email: boolean; aviso: boolean; respuesta: boolean } {
  let email = false, aviso = false, respuesta = false;
  for (const p of pasos) {
    if (p.canal === 'email' && !p.nodo && !p.accion) email = true;
    if (esMako(p) || (p.accion as { operacion?: unknown } | undefined)?.operacion === OP_AVISAR) aviso = true;
    if (esPasoIA(p) || p.nodo === 'respuesta' || JSON.stringify(p.ramas ?? []).includes('"contesto"')) respuesta = true;
  }
  return { email, aviso, respuesta };
}

const AGRUPAR_AUTO = [{ tipo: 'agrupar', agrupar: 'auto' }];

/**
 * La hoja «Métricas» de una automatización, como la arma MaKo: las piezas que tienen sentido PARA ESE FLUJO. Contesta
 * una pregunta —«¿está funcionando?»— con pocas piezas y ningún dato dos veces (AGENTS.md, las plantillas de General).
 */
export function definicionDeMetricas(pasos: readonly PasoGrafo[]): DefinicionGeneral {
  const r = rasgosDelFlujo(pasos);
  const piezas: PiezaPlantilla[] = [
    { local: 'entraron', tipo: 'numero', fuente: 'inscripciones', metricas: ['personas'], dimension: null, titulo: 'Entraron', comparar: true },
    { local: 'en-curso', tipo: 'numero', fuente: 'inscripciones', metricas: ['en_curso'], dimension: null, titulo: 'Siguen en el flujo' },
    { local: 'respondieron', tipo: 'numero', fuente: 'inscripciones', metricas: ['respondieron'], dimension: null, titulo: 'Respondieron' },
    { local: 'tasa', tipo: 'numero', fuente: 'inscripciones', metricas: ['tasa_respuesta'], dimension: null, titulo: 'Tasa de respuesta' },
    { local: 'por-dia', tipo: 'serie', fuente: 'envios', dimension: 'dia', metricas: ['enviados', 'fallaron'], titulo: 'Enviados y fallados', controles: AGRUPAR_AUTO },
    { local: 'por-tarjeta', tipo: 'barras', fuente: 'envios', dimension: 'tarjeta', metricas: ['leads'], titulo: 'Cuántos llegan a cada tarjeta' },
    { local: 'como-terminaron', tipo: 'barras', fuente: 'inscripciones', dimension: 'estado', metricas: ['personas'], titulo: 'Cómo están' },
  ];
  if (r.respuesta) piezas.push({ local: 'horas', tipo: 'numero', fuente: 'inscripciones', metricas: ['horas_respuesta'], dimension: null, titulo: 'Horas hasta responder' });
  if (r.aviso) piezas.push({ local: 'avisos', tipo: 'numero', fuente: 'envios', metricas: ['avisos'], dimension: null, titulo: 'Avisos al equipo' });
  if (r.email) piezas.push({ local: 'apertura', tipo: 'numero', fuente: 'envios', metricas: ['tasa_apertura'], dimension: null, titulo: 'Tasa de apertura' });
  return {
    id: 'automatizacion', nombre: 'Métricas', emoji: '📈',
    linea: 'Quién entra a esta automatización, qué le sale, en qué tarjeta va y cuántos responden.',
    subtitulo: 'Esta automatización en el período.', periodo: 'ult30', piezas,
  };
}

/** El id del control fijo de una hoja: sale del de la hoja, como el «Funnel» de cobros (lib/graficos-catalogo.ts). */
const idDelFiltro = (hojaId: string) => `${hojaId.slice(0, 31)}-autom`;

/**
 * Cada hoja del informe mirando SÓLO esta automatización: el filtro fijo sobre «Automatización» con el nombre de HOY.
 * Una hoja que no lo tenía (una de la galería, creada adentro de Métricas) lo recibe; uno viejo se re-escribe.
 */
export function conLaAutomatizacion(t: Tablero, nombre: string): Tablero {
  const hojas = t.hojas.map((h) => hojaConLaAutomatizacion(h, nombre));
  return { ...t, hojas };
}

export function hojaConLaAutomatizacion(h: Hoja, nombre: string): Hoja {
  const otros = h.controles.filter((c) => !(c.fijo && c.campo === 'automatizacion'));
  const c = sanearControlVista({ id: idDelFiltro(h.id), tipo: 'lista', campo: 'automatizacion', valores: [nombre], fijo: true });
  if (!c) return h;
  const controles: ControlVista[] = [...otros.slice(0, MAX_CONTROLES - 1), c];
  return { ...h, controles };
}

/**
 * La hoja inicial con ids FIJOS (no se guarda hasta que la persona cambie algo: mirar nunca guarda). ⚠️ EL ID LLEVA EL DE
 * LA AUTOMATIZACIÓN (`am-<id>`, 24/10/2026): hasta ese día era 'am-hoja' en TODAS, y el AI Analyst guarda lo suyo por
 * persona y hoja (`dashboard_analisis.hoja_id`). El análisis de una automatización salía en las Métricas de otra, y el
 * cron no podía saber de cuál era la hoja programada: no la encontraba y le sacaba el horario en silencio. Con el id, el
 * cron la busca en el informe de ESA automatización (`hojaDeMetricasGuardada`, lib/automatizacion-metricas-server.ts).
 */
export function hojaInicialDeMetricas(pasos: readonly PasoGrafo[], nombre: string, secuenciaId: number): Hoja {
  const p = plantilla(definicionDeMetricas(pasos));
  const base = hojaDeMetricas(secuenciaId);
  const h = sanearHoja({ ...p.armar((local) => `${base}-${local}`), id: base, plantilla: 'automatizacion' }, 0)!;
  return hojaConLaAutomatizacion(h, nombre);
}

/** El id de la hoja de Métricas de una automatización. */
export const hojaDeMetricas = (secuenciaId: number): string => `am-${secuenciaId}`;
/** La hoja vieja, de antes del 24/10/2026: la misma en todas las automatizaciones (se renombra al leer). */
export const HOJA_DE_METRICAS_VIEJA = 'am-hoja';
/** La automatización de una hoja de Métricas, o null si la hoja no es de Métricas. */
export function idDeHojaDeMetricas(hojaId: string): number | null {
  const m = /^am-(\d{1,12})$/.exec(hojaId);
  const n = m ? Number(m[1]) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** El informe de quien nunca tocó las métricas de esta automatización. */
export function informeInicialDeMetricas(pasos: readonly PasoGrafo[], nombre: string, secuenciaId: number): Tablero {
  return { v: 3, nombre: 'Métricas', hojas: [hojaInicialDeMetricas(pasos, nombre, secuenciaId)] };
}

/** La hoja para «Llevar al Dashboard»: la que se está mirando, con el nombre de la automatización. */
export function nombreDeHojaLlevada(nombreAutomatizacion: string): string {
  const n = nombreAutomatizacion.replace(/\s+/g, ' ').trim() || 'Automatización';
  return `${n} · Métricas`.slice(0, 60);
}

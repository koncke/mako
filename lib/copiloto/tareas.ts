// =============================================================================
// Marketing CoPilot — «Lo que te toca» (13/11/2026, vuelta 20): qué tareas salen de cada tarjeta, y cómo se reconocen en el Plan
// =============================================================================
// Martín (13/11): «las tareas viven en el Plan: se crean ahí, y completarlas en un lado las completa en el otro». Este módulo es
// PURO (lo usan la pantalla y la ruta): arma las tareas con lo que falta DE VERDAD en cada tarjeta y dice cuáles ya se resolvieron
// solas (la oferta ya está, ya leí tus ángulos…). El que escribe en el Plan es ./tareas-plan.ts, con las funciones del Plan.
//
// Cada tarea tiene una CLAVE estable (`oferta:completar-angulos`): se guarda en la `fuente` de la tarea del Plan, como el link de
// vuelta al CoPilot (`/ads-manager/copiloto?tarjeta=oferta#copiloto:oferta:completar-angulos`). Así se encuentra sin una columna
// nueva, y el chip de la tarjeta del Plan lleva al CoPilot.
// ⚠️ Sin renglón gris debajo del título (Martín: «no pongas subtítulos abajo en ningún lugar»): lo que hay que saber va en el título.
// =============================================================================

import type { ParteOC } from './comunicacion';

export type TarjetaCoPilot = 'oferta' | 'web' | 'anuncios' | 'instagram' | 'youtube';
export const TARJETAS_COPILOTO: readonly TarjetaCoPilot[] = ['oferta', 'web', 'anuncios', 'instagram', 'youtube'];

/**
 * Lo que hace «Hacerlo»: ir a otra pantalla (`href`), abrir los desplegables de una parte (`oc`), que MaKo lea (`leer`) o
 * conectar una red AHÍ MISMO (`conectar` + `red`): para una integración jamás se sale de la tab (Martín, 14/10/2026,
 * tests/integracion-sin-salir.test.ts).
 */
export type RedParaConectar = 'metaads' | 'instagram' | 'youtube';
export type TareaCoPilot = { clave: string; tarjeta: TarjetaCoPilot; titulo: string; href?: string; abre?: 'oc' | 'leer' | 'conectar'; parte?: ParteOC; red?: RedParaConectar };

/** Lo mínimo que hace falta saber del negocio para armar las tareas (lo arma ./page.tsx del CoPilot). */
export type ResumenParaTareas = {
  oferta: { sesion: number | null; notaOferta: boolean; notaAngulos: boolean; notaVoz: boolean; faltan: Record<ParteOC, number> };
  anuncios: { conectada: boolean; funnel: string | null; semana: Array<{ titulo: string; href: string }> };
  web: string[];
  /** Lo más grave de cada página ya analizada (Landing Analyst): cada uno es una tarea. */
  webArreglos?: Array<{ url: string; titulo: string }>;
  redes: Record<'instagram' | 'youtube', { conectada: boolean }>;
  /** Cuántos competidores sigue en Competitor Spy (null = no se sabe todavía). */
  seguidos: number | null;
};

const NOMBRE_PARTE: Record<ParteOC, string> = { angulos: 'tus ángulos', voz: 'tu voz', oferta: 'tu oferta' };
const sinProtocolo = (u: string) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** Las tareas de hoy, de todas las tarjetas, y las claves de las que ya se resolvieron (para cerrarlas también en el Plan). */
export function tareasDelCoPilot(r: ResumenParaTareas): { tareas: TareaCoPilot[]; resueltas: string[] } {
  const tareas: TareaCoPilot[] = [];
  const resueltas: string[] = [];
  const hay = (cond: boolean, t: TareaCoPilot) => { if (cond) tareas.push(t); else resueltas.push(t.clave); };

  // Oferta y comunicación
  const o = r.oferta;
  hay(o.sesion == null, { clave: 'oferta:armar', tarjeta: 'oferta', titulo: 'Arma tu oferta con MaKo en Offer', href: '/offer' });
  hay(o.sesion != null && !o.notaOferta, { clave: 'oferta:analizar', tarjeta: 'oferta', titulo: 'Analiza tu oferta en Offer', href: '/offer' });
  hay(!o.notaAngulos, { clave: 'oferta:leer-angulos', tarjeta: 'oferta', titulo: 'Que MaKo lea tus ángulos', abre: 'leer', parte: 'angulos' });
  hay(!o.notaVoz, { clave: 'oferta:leer-voz', tarjeta: 'oferta', titulo: 'Que MaKo lea tu voz', abre: 'leer', parte: 'voz' });
  for (const p of ['angulos', 'voz', 'oferta'] as const) {
    const n = o.faltan[p];
    hay(n > 0, { clave: `oferta:completar-${p}`, tarjeta: 'oferta', titulo: `Completa ${NOMBRE_PARTE[p]}: ${n === 1 ? 'te falta 1' : `te faltan ${n}`}`, abre: 'oc', parte: p });
  }

  // Anuncios
  const a = r.anuncios;
  hay(!a.conectada, { clave: 'anuncios:conectar', tarjeta: 'anuncios', titulo: 'Conecta tu cuenta de anuncios de Meta', abre: 'conectar', red: 'metaads' });
  hay(!a.funnel, { clave: 'anuncios:funnel', tarjeta: 'anuncios', titulo: 'Elige tu funnel', href: '/ads-manager?estrategia=1' });
  // Audience Network: desde fines de agosto de 2026 Meta no deja sacarlo por campaña, sí en toda la cuenta, y eso no lo hace la API.
  if (a.conectada) tareas.push({ clave: 'anuncios:audience-network', tarjeta: 'anuncios', titulo: 'Bloquea Audience Network en Meta (Configuración publicitaria → Controles de ubicación)' });
  if (a.funnel) a.semana.slice(0, 8).forEach((t, i) => tareas.push({ clave: `anuncios:semana-${i}-${claveDeTitulo(t.titulo)}`, tarjeta: 'anuncios', titulo: t.titulo, href: t.href }));

  // Web
  hay(!r.web.length, { clave: 'web:analizar', tarjeta: 'web', titulo: 'Analiza tu web', href: '/web-generator' });
  // Con la página analizada, cada arreglo grave es su tarea; sin análisis todavía, analizarla.
  if (r.webArreglos?.length) {
    for (const h of r.webArreglos.slice(0, 4)) tareas.push({ clave: `web:arreglar-${claveDeTitulo(`${sinProtocolo(h.url)} ${h.titulo}`)}`, tarjeta: 'web', titulo: `Arregla en ${sinProtocolo(h.url)}: ${h.titulo}`, href: `/web-generator?analizar=${encodeURIComponent(h.url)}` });
  } else {
    for (const u of r.web.slice(0, 3)) tareas.push({ clave: `web:mejorar-${claveDeTitulo(sinProtocolo(u))}`, tarjeta: 'web', titulo: `Mejora ${sinProtocolo(u)} con su análisis`, href: `/web-generator?analizar=${encodeURIComponent(u)}` });
  }

  // Instagram y YouTube
  hay(!r.redes.instagram.conectada, { clave: 'instagram:conectar', tarjeta: 'instagram', titulo: 'Conecta tu Instagram', abre: 'conectar', red: 'instagram' });
  hay(!r.redes.youtube.conectada, { clave: 'youtube:conectar', tarjeta: 'youtube', titulo: 'Conecta tu YouTube', abre: 'conectar', red: 'youtube' });
  // «Selecciona a tus competidores»: de los que sigues sale con qué número se publica un reel de prueba.
  if (r.seguidos == null || r.seguidos === 0) tareas.push({ clave: 'instagram:competidores', tarjeta: 'instagram', titulo: 'Selecciona a tus competidores en Competitor Spy', href: '/competitor-spy?ver=seguidos' });
  else resueltas.push('instagram:competidores');

  return { tareas, resueltas };
}

/** Una clave corta y estable a partir de un texto (para las tareas que no tienen una propia). */
export function claveDeTitulo(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'tarea';
}

// ── La tarea en el Plan ──────────────────────────────────────────────────────

/** La tarea la crea MaKo (el tipo de fuente del Plan es una lista cerrada: 'mako'); lo que la hace del CoPilot es su link. */
export const TIPO_FUENTE_COPILOTO = 'mako';
export const ETIQUETA_FUENTE_COPILOTO = 'Marketing CoPilot';
const MARCA = '#copiloto:';
export const esClaveCoPilot = (v: unknown): v is string => typeof v === 'string' && /^[a-z]+:[a-z0-9-]{2,60}$/.test(v);

/** El link de vuelta al CoPilot que lleva la tarea del Plan, con su clave. */
export function urlDeTarea(t: Pick<TareaCoPilot, 'clave' | 'tarjeta'>): string {
  return `/ads-manager/copiloto?tarjeta=${t.tarjeta}${MARCA}${t.clave}`;
}

/** La clave de una tarea del Plan, si es del CoPilot (por su fuente); null si no. */
export function claveDeFuente(f: { tipo?: string; url?: string } | null | undefined): string | null {
  if (!f || typeof f.url !== 'string') return null;
  const i = f.url.indexOf(MARCA);
  const k = i >= 0 ? f.url.slice(i + MARCA.length) : '';
  return esClaveCoPilot(k) ? k : null;
}

/**
 * Qué hacer en el Plan: crear lo que el CoPilot pide y el Plan no tiene, y cerrar lo que el CoPilot dio por resuelto y el Plan tiene
 * abierto. Nunca reabre una que la persona cerró en el Plan, ni toca una tarea que no es del CoPilot.
 */
export function planDeSincronizacion(
  hoy: readonly TareaCoPilot[], resueltas: readonly string[],
  enElPlan: ReadonlyArray<{ clave: string; hecha: boolean }>,
): { crear: TareaCoPilot[]; cerrar: string[] } {
  const enPlan = new Map(enElPlan.map((t) => [t.clave, t]));
  const crear = hoy.filter((t) => !enPlan.has(t.clave));
  const cerrar = resueltas.filter((k) => enPlan.get(k)?.hecha === false);
  return { crear, cerrar };
}

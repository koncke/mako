// =============================================================================
// graficos-datos-puro — las cuentas de los lectores del Dashboard que se pueden probar sin base
// =============================================================================
// Los lectores (lib/graficos-datos.ts y lib/graficos-datos-extra.ts) llevan `server-only`: ningún test de
// node:test los puede importar. Lo que DECIDE un número —qué es un turno de una conversación, en qué tramo
// del video quedó un lead, cuánta gente llegó al llamado a la acción de un anuncio, de dónde viene una
// visita— vive acá, puro y con test (tests/graficos-datos-puro.test.ts). Los lectores sólo leen y llaman.
//
// SIN `server-only` a propósito: lo importan los lectores, el beacon del Pixel (app/api/track/vsl, la
// ubicación de la visita) y los tests.

import { VENTA_SIN_COBRO } from './venta-tipo';

// ── Qué es una venta ─────────────────────────────────────────────────────────────────────

/**
 * Un ganado que se cuenta como venta: `cerro` o `estado_lead = 'ganado'`, menos los «sin cobro» (becados;
 * tests/venta-sin-cobro.test.ts). Es la cuarta definición de cierre de la app (hallazgos-graficos.md) y la
 * usan TODOS los conjuntos del Dashboard (leads, negocio, revenue, vsl_leads): vive acá para que no haya dos.
 */
export const gano = (x: { cerro: boolean | null; estado_lead: string | null; venta_tipo: string | null }): boolean =>
  (!!x.cerro || x.estado_lead === 'ganado') && x.venta_tipo !== VENTA_SIN_COBRO;

// ── El tiempo ────────────────────────────────────────────────────────────────────────────

/**
 * Días calendario de `a` a `b` (los dos 'YYYY-MM-DD…'), en UTC; null si falta una o si da negativo (un pago
 * antes de la agenda es un dato roto, como en `_getTramosSCL` de lib/queries.ts, que manda esta regla).
 */
export function diasEntre(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const [ay, am, ad] = a.slice(0, 10).split('-').map(Number);
  const [by, bm, bd] = b.slice(0, 10).split('-').map(Number);
  if (![ay, am, ad, by, bm, bd].every(Number.isFinite)) return null;
  const d = Math.floor((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
  return d >= 0 ? d : null;
}

// ── El ciclo de venta por tramos (el bloque «SCL» hecho conjunto) ────────────────────────────

/** Lo que un lead trae para los tramos. Las MISMAS columnas que lee `_getTramosSCL`. */
export type FechasDeLead = {
  created_at: string | null; meta_lead_id: string | null; fecha_agenda: string | null; fecha_junta_1: string | null;
  fecha_junta_2: string | null; fecha_confirmacion: string | null; fecha_primer_pago: string | null;
};

/**
 * Los cinco tramos del ciclo de UN lead, en días, con la regla de `_getTramosSCL` (lib/queries.ts): días ≥ 0
 * entre las dos fechas (null si falta una o da negativo), y el primero (Formulario → Agenda) SÓLO para los
 * instant forms (`meta_lead_id`), donde `created_at` es el momento del formulario. El lector los vuelca en
 * `dias_tN` / `con_tN`, las bases de la razón `tramo_N`: el promedio del tramo es la suma de los días sobre
 * cuántos lo tienen.
 */
export function tramosDelCiclo(x: FechasDeLead): [number | null, number | null, number | null, number | null, number | null] {
  return [
    x.meta_lead_id ? diasEntre(x.created_at, x.fecha_agenda) : null,
    diasEntre(x.fecha_agenda, x.fecha_junta_1),
    diasEntre(x.fecha_junta_1, x.fecha_junta_2),
    diasEntre(x.fecha_junta_2, x.fecha_confirmacion),
    diasEntre(x.fecha_confirmacion, x.fecha_primer_pago),
  ];
}

// ── La madurez de una cohorte ────────────────────────────────────────────────────────────

/** Cómo se lee el `estado_madurez` de las vistas de cohortes (mig 0084): «madura», «madurando», «reciente». */
export const rotuloMadurez = (estado: string | null | undefined): string | null => {
  const s = (estado ?? '').trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : null;
};

// ── El VSL por lead ──────────────────────────────────────────────────────────────────────

/**
 * Los tramos de «¿los que más ven, más compran?», en ORDEN (es el `valores` de la dimensión `tramo_visto`).
 * «Sin medir» es quien le dio play y no dejó un solo avance medible: no es 0%, y no se lo mete en el primer
 * tramo (la regla de lib/vsl-retencion.ts).
 */
export const TRAMOS_VISTO = ['No lo vio', 'Sin medir', '0-25%', '25-50%', '50-75%', '75-100%'] as const;

/** El tramo de un lead: sin evento del video, «No lo vio»; arrancó sin avance medible, «Sin medir». */
export function tramoVisto(vio: boolean, avance: number | null | undefined): (typeof TRAMOS_VISTO)[number] {
  if (!vio) return 'No lo vio';
  if (avance == null || !Number.isFinite(avance) || avance <= 0) return 'Sin medir';
  if (avance < 25) return '0-25%';
  if (avance < 50) return '25-50%';
  if (avance < 75) return '50-75%';
  return '75-100%';
}

/** Los cortes de la curva del video (la dimensión `corte`): 5, 10 … 100, en ese orden. */
export const CORTES_VSL: readonly string[] = Array.from({ length: 20 }, (_, i) => String((i + 1) * 5));

// ── La retención al llamado a la acción de un anuncio (el cuadrante de Ads Analyst, sumable) ─

/**
 * En qué fracción del video arranca el llamado a la acción: el `t0` del ÚLTIMO bloque del guion sobre la
 * duración, con la duración de respaldo de `getQuadrantData` (lib/ads-analyst.ts) cuando no está.
 */
export function fraccionCta(beats: unknown, dur: number | null | undefined): number {
  const lista = Array.isArray(beats) ? (beats as Array<{ t0?: unknown }>).map((b) => Number(b?.t0)).filter(Number.isFinite) : [];
  const d = typeof dur === 'number' && dur > 0 ? dur : Math.max(...lista, 30) + 4;
  const ult = lista.length ? lista[lista.length - 1] : d;
  return d > 0 ? Math.min(1, Math.max(0, ult / d)) : 1;
}

/**
 * Cuánta gente de UN día llegó al llamado a la acción: la curva de cuartiles de `retentionCurve`
 * (lib/ads-analyst.ts) interpolada en `f` — pero en PERSONAS y no en %, para que se pueda SUMAR entre días
 * y la razón `ret_cta` (llegaron ÷ plays de 3 s) salga sobre lo sumado, como cualquier otra razón.
 *
 * ⚠️ Difiere de la tab en dos lugares, a propósito: la monotonía forzada y el respaldo «sin cuartiles» se
 *    aplican POR DÍA (la tab los aplica sobre la ventana entera). Con cuartiles monótonos —lo normal: Meta
 *    los da así— es exactamente la interpolación de la tab hecha suma.
 */
export function llegaronAlCta(m: { v3s: number; thru: number; p25: number; p50: number; p75: number; p100: number }, f: number): number {
  if (!(m.v3s > 0)) return 0;
  const conCuartiles = m.p25 + m.p50 + m.p75 + m.p100 > 0;
  const pts: Array<[number, number]> = conCuartiles
    ? [[0, m.v3s], [0.25, m.p25], [0.5, m.p50], [0.75, m.p75], [1, m.p100]]
    : [[0, m.v3s], [1, m.thru]];
  // Monótona no creciente, y nunca más gente que la que arrancó (como el clamp de la tab).
  let prev = m.v3s;
  for (const p of pts) { p[1] = Math.max(0, Math.min(p[1], prev)); prev = p[1]; }
  const x = Math.min(1, Math.max(0, f));
  for (let i = 0; i < pts.length - 1; i++) {
    const [fa, va] = pts[i];
    const [fb, vb] = pts[i + 1];
    if (x >= fa && x <= fb) return va + ((x - fa) / ((fb - fa) || 1)) * (vb - va);
  }
  return pts[pts.length - 1][1];
}

// ── La ubicación de una visita (los headers de Vercel) ──────────────────────────────────────

export type UbicacionVisita = { pais: string | null; region: string | null; ciudad: string | null; lat: number | null; lon: number | null };

/** A cuántos decimales se guarda una coordenada: uno es ~11 km. Alcanza para una ciudad y no ubica a nadie. */
export const DECIMALES_COORDENADA = 1;

/**
 * Lo que Vercel dice de dónde viene un pedido: `x-vercel-ip-country` (ISO-2), `x-vercel-ip-country-region`
 * (la parte de la región del ISO 3166-2), `x-vercel-ip-city` (codificada como URL) y la latitud y longitud.
 * ⚠️ NUNCA LA IP: no se lee ni se devuelve (decisión de Martín, 12/10/2026). Las coordenadas se redondean
 * (`DECIMALES_COORDENADA`). Lo que no viene o no tiene forma es null; sin país no hay ubicación (null entero).
 */
export function ubicacionDeHeaders(h: (nombre: string) => string | null | undefined): UbicacionVisita | null {
  const crudo = (n: string) => { const v = h(n); return typeof v === 'string' && v.trim() ? v.trim() : null; };
  const pais = crudo('x-vercel-ip-country')?.toUpperCase() ?? null;
  if (!pais || !/^[A-Z]{2}$/.test(pais)) return null;
  const reg = crudo('x-vercel-ip-country-region')?.toUpperCase() ?? null;
  const region = reg && /^[A-Z0-9]{1,3}$/.test(reg) ? reg : null;
  let ciudad: string | null = null;
  const c = crudo('x-vercel-ip-city');
  if (c) { try { ciudad = decodeURIComponent(c).trim().slice(0, 80) || null; } catch { ciudad = null; } }
  const coord = (n: string, tope: number) => {
    // ⚠️ Sin el header es null, no 0: `Number(null)` da 0, y una longitud 0 pone la visita en el golfo de
    // Guinea (lo cazó el test en su primera corrida).
    const c = crudo(n);
    const v = c == null ? NaN : Number(c);
    if (!Number.isFinite(v) || Math.abs(v) > tope) return null;
    const f = 10 ** DECIMALES_COORDENADA;
    return Math.round(v * f) / f;
  };
  const lat = coord('x-vercel-ip-latitude', 90);
  const lon = coord('x-vercel-ip-longitude', 180);
  return { pais, region, ciudad, lat: lat != null && lon != null ? lat : null, lon: lat != null && lon != null ? lon : null };
}

/** La región como código ISO 3166-2 completo («MX-BCN»): así no se confunden dos regiones de países distintos. */
export const regionIso = (pais: string | null, region: string | null): string | null => (pais && region ? `${pais}-${region}` : null);

// ── Las conversaciones de WhatsApp (el Chat Analyst) ────────────────────────────────────────

/**
 * ¿Es una conversación 1-a-1? EN POSITIVO: un contacto (`@s.whatsapp.net`, `@c.us`) o su identificador
 * anónimo (`@lid`). Un grupo (`@g.us`), un estado (`status@broadcast`) o un canal (`@newsletter`) no son una
 * persona esperando respuesta.
 */
export const esChatIndividual = (jid: string | null | undefined): boolean => /@(s\.whatsapp\.net|c\.us|lid)$/i.test((jid ?? '').trim());

export type MensajeChat = { linea: string | null; chat: string; deMi: boolean; t: number; leadId: number | null };
export type TurnoChat = {
  linea: string | null; chat: string; leadId: number | null;
  /** Cuándo escribió (el primer entrante de la racha). */
  t: number;
  /** Minutos hasta el primer saliente después; null = no se respondió (todavía, o dentro de lo leído). */
  minutos: number | null;
};

/**
 * Los TURNOS de cada conversación: el primer mensaje ENTRANTE de cada racha de entrantes (el anterior de ese
 * chat fue nuestro, o no hay anterior), con cuánto tardó la primera respuesta. Es la cuenta del relevo v5
 * (11/10/2026: ws1 mediana 3 min, ws11 1,6 min). Contar mensajes en vez de turnos premia al que escribe
 * en cinco renglones; contar desde el ÚLTIMO de la racha esconde la espera.
 *
 * Un chat es (línea, jid): la misma persona en dos líneas son dos conversaciones.
 */
export function turnosDeChats(mensajes: readonly MensajeChat[]): TurnoChat[] {
  const porChat = new Map<string, MensajeChat[]>();
  for (const m of mensajes) {
    if (!Number.isFinite(m.t)) continue;
    const k = `${m.linea ?? ''}\u0000${m.chat}`;
    (porChat.get(k) ?? porChat.set(k, []).get(k)!).push(m);
  }
  const out: TurnoChat[] = [];
  for (const lista of porChat.values()) {
    lista.sort((a, b) => a.t - b.t);
    const lead = lista.find((m) => m.leadId != null)?.leadId ?? null;
    let abierto: TurnoChat | null = null;
    for (const m of lista) {
      if (!m.deMi) {
        if (!abierto) { abierto = { linea: m.linea, chat: m.chat, leadId: lead, t: m.t, minutos: null }; out.push(abierto); }
      } else if (abierto) {
        abierto.minutos = (m.t - abierto.t) / 60_000;
        abierto = null;
      }
    }
  }
  return out;
}

/**
 * Las conversaciones que ESPERAN respuesta: el último mensaje del chat es de la persona y tiene más de `horas`
 * horas. Sólo las que tienen un lead: un chat sin lead suele ser un contacto personal del número (medido en el
 * relevo: incluirlos es ruido). Devuelve una entrada por chat con lead, con `espera` = sí / no.
 */
export function chatsEsperando(mensajes: readonly MensajeChat[], ahora: number, horas = 24): Array<{ linea: string | null; chat: string; leadId: number; espera: boolean }> {
  const ultimo = new Map<string, MensajeChat>();
  const lead = new Map<string, number>();
  for (const m of mensajes) {
    if (!Number.isFinite(m.t)) continue;
    const k = `${m.linea ?? ''}\u0000${m.chat}`;
    const u = ultimo.get(k);
    if (!u || m.t > u.t) ultimo.set(k, m);
    if (m.leadId != null) lead.set(k, m.leadId);
  }
  const out: Array<{ linea: string | null; chat: string; leadId: number; espera: boolean }> = [];
  for (const [k, u] of ultimo) {
    const l = lead.get(k);
    if (l == null) continue;
    out.push({ linea: u.linea, chat: u.chat, leadId: l, espera: !u.deMi && ahora - u.t > horas * 3_600_000 });
  }
  return out;
}

// ── Customer Success ─────────────────────────────────────────────────────────────────────

/** Los tramos de «hace cuánto no hablan», en orden (el `valores` de `tramo_contacto`). */
export const TRAMOS_CONTACTO = ['0-7 días', '8-14 días', '15-30 días', 'Más de 30 días', 'Nunca'] as const;
/**
 * El tramo del último contacto de un cliente. `leido` = la cartera pudo leer sesiones Y mensajes: si no,
 * «nunca» sería una afirmación sobre datos que no se miraron, y va null (la regla de lib/cs-cartera.ts).
 */
export function tramoDeContacto(dias: number | null | undefined, leido: boolean): (typeof TRAMOS_CONTACTO)[number] | null {
  if (!leido) return null;
  if (dias == null || !Number.isFinite(dias)) return 'Nunca';
  if (dias <= 7) return '0-7 días';
  if (dias <= 14) return '8-14 días';
  if (dias <= 30) return '15-30 días';
  return 'Más de 30 días';
}

/** Cómo se lee la señal de un cliente (lib/cs-senal.ts): «atencion» / «bien» / null («no se puede saber»). */
export const rotuloSenal = (nivel: string | null | undefined): string => (nivel === 'atencion' ? 'Atención' : nivel === 'bien' ? 'Bien' : 'Sin datos');

/** El MOTIVO de una señal como categoría: la REGLA en palabras (la frase trae números y serían mil categorías). */
export const MOTIVO_DE_REGLA: Readonly<Record<string, string>> = {
  'cuota-vencida': 'Cuota vencida', 'sin-contestar': 'Sin contestar', 'nunca-hablaron': 'Nunca hablaron', silencio: 'Silencio',
  'tareas-atrasadas': 'Tareas atrasadas', 'contrato-vencido': 'Contrato vencido', 'recien-cerrado': 'Recién cerrado',
  'sin-contrato': 'Sin contrato', 'sin-datos': 'Sin datos', 'al-dia': 'Al día',
};

/** «Vencida» / «Vence pronto» / «Más adelante» / «Sin fecha»: la urgencia de la próxima cuota de un cliente. */
export function rotuloUrgencia(urgencia: 'vencida' | 'pronto' | null, vence: string | null | undefined): string {
  if (urgencia === 'vencida') return 'Vencida';
  if (urgencia === 'pronto') return 'Vence pronto';
  return vence ? 'Más adelante' : 'Sin fecha';
}

// ── Las automatizaciones ─────────────────────────────────────────────────────────────────

/** Los estados de una inscripción que dicen que la persona CONTESTÓ (lib/nutricion: `respondio` y el pase a una persona). */
export const ESTADOS_RESPONDIO: ReadonlySet<string> = new Set(['respondio', 'handoff']);

/**
 * Qué envíos de una automatización se cuentan como RESPONDIDOS. `nutricion_envios.respondio_at` no lo escribe
 * nadie (medido el 11/10/2026: 0 de 23), así que «Respuestas» daba siempre 0. Se deduce: si la inscripción
 * terminó contestando (`ESTADOS_RESPONDIO`), lo que la persona contestó fue el ÚLTIMO envío de esa inscripción
 * —la secuencia se pausa al responder—. Y si algún día alguien escribe `respondio_at`, ese dato manda.
 */
export function enviosRespondidos(
  envios: ReadonlyArray<{ id: number; inscripcionId: number | null; t: string; respondioAt: string | null }>,
  estadoDe: (inscripcionId: number) => string | null | undefined,
): Set<number> {
  const out = new Set<number>();
  const ultimo = new Map<number, { id: number; t: string }>();
  for (const e of envios) {
    if (e.respondioAt) out.add(e.id);
    if (e.inscripcionId == null) continue;
    const u = ultimo.get(e.inscripcionId);
    if (!u || e.t > u.t || (e.t === u.t && e.id > u.id)) ultimo.set(e.inscripcionId, { id: e.id, t: e.t });
  }
  for (const [insc, u] of ultimo) if (ESTADOS_RESPONDIO.has(String(estadoDe(insc) ?? ''))) out.add(u.id);
  return out;
}

// ── Los toques de la landing ─────────────────────────────────────────────────────────────

/**
 * ¿El toque fue en el SELLO del constructor de Lovable («Edit with Lovable», su cruz)? Medido el 11/10/2026:
 * `#lovable-badge-close` ×6 y `#lovable-badge-cta` ×3 eran lo MÁS tocado del ws1, y uno llega con el texto
 * vacío, así que `esClicDelConstructor` (que mira el texto) no lo ve. Se mira el SELECTOR del Pixel v22.
 */
export const esSelloDelConstructor = (sel: string | null | undefined): boolean => /#lovable-badge(?:$|[-\s>:.[])/i.test(sel ?? '');

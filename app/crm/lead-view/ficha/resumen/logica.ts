// =============================================================================
// ficha/resumen/logica — lo que DICEN los bloques del Resumen, PURO (lo ejecutan los tests)
// =============================================================================
// Martín, 16/10/2026: «completamente diferente en diseño y funcionalidad... los datos de los leads se van a guardar».
// Los bloques del Resumen (./*.tsx) dibujan; esto decide QUÉ dicen con los datos de siempre: qué reunión viene y cuál
// quedó sin marcar, la siguiente acción, cuánto lleva en la etapa, qué contestó y de dónde vino. Sin React ni server
// actions, para que un test lo EJECUTE (los componentes arrastran server actions y no se importan desde node).
//
// ⚠️ NINGÚN DATO NUEVO: todo sale de `LeadFullData` (la lectura única de la ficha, app/crm/actions.ts) o de lo que el
//    bloque pide con su propia acción al montarse (el tiempo en la etapa, los duplicados). Lo que no se sabe no se
//    inventa: «sin dato» es un tercer estado (el tiempo en la etapa sin historial, el origen sin atribución).
// =============================================================================

import type { StepId } from '@/lib/stage-requirements';
import { FUENTES_RESPUESTA, type FuenteRespuesta } from '@/lib/ficha/catalogo';

// ── Fechas ──────────────────────────────────────────────────────────────────

const DIA_MS = 86_400_000;

/** Días de calendario de `desde` a `hasta` (los dos AAAA-MM-DD): positivo si `hasta` es después. */
export function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde.slice(0, 10)}T12:00:00Z`);
  const b = Date.parse(`${hasta.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / DIA_MS);
}

/** «hoy», «mañana», «en 3 días», «ayer», «hace 4 días». Corto: se dibuja. */
export function cuandoRelativo(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'mañana';
  if (dias === -1) return 'ayer';
  return dias > 1 ? `en ${dias} días` : `hace ${-dias} días`;
}

/** «1 día», «12 días». */
export const textoDias = (n: number): string => `${n} ${n === 1 ? 'día' : 'días'}`;

// ── Reuniones ───────────────────────────────────────────────────────────────

export type CualReunion = 'r1' | 'r2';

/** Lo que el lead guarda de UNA reunión. */
export type ReunionDelLead = {
  cual: CualReunion;
  /** El día (AAAA-MM-DD). En la R1, la del agendamiento si todavía no hay fecha de junta. */
  fecha: string | null;
  /** El instante con hora (Calendly), si lo hay. */
  at: string | null;
  /** El link para entrar (mig 0204). */
  url: string | null;
  asistio: boolean | null;
};

export type LeadConReuniones = {
  fecha_agenda?: string | null;
  fecha_junta_1?: string | null; fecha_junta_2?: string | null;
  junta_1_at?: string | null; junta_2_at?: string | null;
  junta_1_url?: string | null; junta_2_url?: string | null;
  asistio_j1?: boolean | null; asistio_j2?: boolean | null;
};

/** Las reuniones que el lead tiene cargadas (con fecha o con hora), en orden. */
export function reunionesDelLead(l: LeadConReuniones): ReunionDelLead[] {
  const out: ReunionDelLead[] = [];
  const r1 = { fecha: l.fecha_junta_1 ?? l.fecha_agenda ?? null, at: l.junta_1_at ?? null };
  if (r1.fecha || r1.at) out.push({ cual: 'r1', ...r1, url: l.junta_1_url?.trim() || null, asistio: l.asistio_j1 ?? null });
  const r2 = { fecha: l.fecha_junta_2 ?? null, at: l.junta_2_at ?? null };
  if (r2.fecha || r2.at) out.push({ cual: 'r2', ...r2, url: l.junta_2_url?.trim() || null, asistio: l.asistio_j2 ?? null });
  return out;
}

/** El día de una reunión (AAAA-MM-DD): el de la fecha, o el del instante. */
const diaDe = (r: ReunionDelLead): string | null => (r.fecha ?? r.at)?.slice(0, 10) ?? null;

/**
 * ¿Ya pasó? Con hora, si la hora ya pasó. Sin hora, si el DÍA es anterior a hoy: una reunión de hoy sin hora no pasó
 * (no se sabe a qué hora es, y preguntar «¿vino?» a la mañana sería preguntar antes de tiempo).
 */
export function yaPaso(r: ReunionDelLead, ahoraMs: number, hoy: string): boolean {
  if (r.at) {
    const t = Date.parse(r.at);
    if (Number.isFinite(t)) return t <= ahoraMs;
  }
  const d = diaDe(r);
  return !!d && d < hoy.slice(0, 10);
}

export type EstadoReuniones = {
  /** La que viene: la primera que no pasó y no tiene la asistencia marcada, con los días que faltan. */
  proxima: (ReunionDelLead & { dias: number }) | null;
  /** Las que pasaron sin la asistencia marcada, o cuya asistencia pide la etapa: «¿Vino?». */
  sinMarcar: ReunionDelLead[];
  /** Las que la etapa pide y no tienen fecha (`fechaJ1`, `fechaJ2`): se cargan en el bloque. */
  fechasPedidas: CualReunion[];
};

/**
 * EL ESTADO DE LAS REUNIONES DEL LEAD, para la próxima reunión y la siguiente acción.
 * ⚠️ LA ASISTENCIA PEDIDA SIEMPRE TIENE DÓNDE MARCARSE: si la etapa la pide (`pide`, los «datos sin marcar»), la
 *    reunión va a «¿Vino?» aunque todavía no haya pasado por el reloj (el reloj del navegador puede no coincidir con el
 *    del server que contó el dato). Así «Solucionar» encuentra el campo en este bloque.
 */
export function estadoReuniones(l: LeadConReuniones, o: { ahoraMs: number; hoy: string; pide: readonly StepId[] }): EstadoReuniones {
  const rs = reunionesDelLead(l);
  const pideAsistencia = (c: CualReunion) => o.pide.includes(c === 'r1' ? 'asistenciaR1' : 'asistenciaR2');
  const sinMarcar = rs.filter((r) => r.asistio == null && (yaPaso(r, o.ahoraMs, o.hoy) || pideAsistencia(r.cual)));
  const futura = rs.find((r) => r.asistio == null && !sinMarcar.includes(r) && !yaPaso(r, o.ahoraMs, o.hoy));
  const dia = futura ? diaDe(futura) : null;
  // La fecha pedida es la de la JUNTA: en la R1, la del agendamiento no la reemplaza (el campo la trae precargada).
  const fechasPedidas = (['r1', 'r2'] as const).filter((c) => (c === 'r1' ? o.pide.includes('fechaJ1') && !l.fecha_junta_1 : o.pide.includes('fechaJ2') && !l.fecha_junta_2));
  return {
    proxima: futura && dia ? { ...futura, dias: diasEntre(o.hoy, dia) } : null,
    sinMarcar,
    fechasPedidas,
  };
}

/** ¿El bloque de la próxima reunión no tiene nada que decir? Sin reunión por delante, sin asistencia ni fecha que cargar. */
export const reunionesVacias = (e: EstadoReuniones): boolean => !e.proxima && !e.sinMarcar.length && !e.fechasPedidas.length;

/** Los «datos sin marcar» que el bloque de la próxima reunión deja cargar AHÍ (lo que «Solucionar» busca). */
export const PASOS_DE_REUNION: readonly StepId[] = ['fechaJ1', 'fechaJ2', 'asistenciaR1', 'asistenciaR2'];

// ── La siguiente acción ─────────────────────────────────────────────────────

/** Lo que hace el botón de la siguiente acción. Lleva a donde se resuelve; nunca escribe solo. */
export type AccionSiguiente =
  | { tipo: 'entrar'; url: string }
  | { tipo: 'tab'; tab: 'reuniones' | 'insights' }
  | { tipo: 'solucionar'; paso: StepId };

export type SiguienteAccion = {
  clase: 'asistencia' | 'reunion' | 'llamada' | 'insight' | 'datos';
  titulo: string;
  detalle: string | null;
  boton: { rotulo: string; accion: AccionSiguiente } | null;
  tono: 'warn' | 'info' | 'neutral';
};

/**
 * LA SIGUIENTE ACCIÓN, con lo que ya está escrito (no hay una columna así). La primera que exista gana:
 *   1. una reunión que pasó sin la asistencia marcada (las asistencias nunca se apagan, y es lo que Meta aprende);
 *   2. la próxima reunión, con «Entrar» si hay link;
 *   3. el próximo paso de la última llamada analizada;
 *   4. lo que sigue según el último análisis de MaKo;
 *   5. los datos sin marcar de la etapa, con «Completar» (el mismo camino que la cabecera).
 * Es la regla del teléfono (`siguienteAccion`, app/m/crm/reglas.ts) con la asistencia primero y un botón que lleva a
 * donde se resuelve. null = no hay nada escrito: el bloque se calla, no inventa una.
 */
export function siguienteAccionDe(p: {
  reuniones: EstadoReuniones;
  /** El nombre de la reunión (el de su etapa: «Agenda R1», «Webinar»). */
  nombreReunion: (c: CualReunion) => string;
  /** La hora de un instante en la zona del negocio («10:30»), o null. */
  hora: (iso: string) => string | null;
  pasoLlamada: string | null | undefined;
  proximaAccion: string | null | undefined;
  faltan: ReadonlyArray<{ id: StepId; label: string }>;
}): SiguienteAccion | null {
  const sm = p.reuniones.sinMarcar[0];
  if (sm) {
    return {
      clase: 'asistencia', titulo: `¿Vino a ${p.nombreReunion(sm.cual)}?`, detalle: null, tono: 'warn',
      boton: { rotulo: 'Marcar', accion: { tipo: 'solucionar', paso: sm.cual === 'r1' ? 'asistenciaR1' : 'asistenciaR2' } },
    };
  }
  const px = p.reuniones.proxima;
  if (px) {
    const h = px.at ? p.hora(px.at) : null;
    return {
      clase: 'reunion', titulo: `${p.nombreReunion(px.cual)} ${cuandoRelativo(px.dias)}`, detalle: h ? `A las ${h}` : null, tono: 'info',
      boton: px.url ? { rotulo: 'Entrar', accion: { tipo: 'entrar', url: px.url } } : null,
    };
  }
  const paso = p.pasoLlamada?.trim();
  if (paso) return { clase: 'llamada', titulo: 'Próximo paso', detalle: paso, tono: 'neutral', boton: { rotulo: 'Ver llamada', accion: { tipo: 'tab', tab: 'reuniones' } } };
  const sigue = p.proximaAccion?.trim();
  if (sigue) return { clase: 'insight', titulo: 'Lo que sigue', detalle: sigue, tono: 'neutral', boton: { rotulo: 'Ver análisis', accion: { tipo: 'tab', tab: 'insights' } } };
  if (p.faltan.length) {
    const uno = p.faltan.length === 1;
    return {
      clase: 'datos', titulo: uno ? `Falta: ${p.faltan[0].label}` : `Faltan ${p.faltan.length} datos`,
      detalle: uno ? null : p.faltan.map((f) => f.label).join(' · '), tono: 'warn',
      boton: { rotulo: 'Completar', accion: { tipo: 'solucionar', paso: p.faltan[0].id } },
    };
  }
  return null;
}

// ── Tiempo en la etapa ──────────────────────────────────────────────────────

export type Semaforo = 'verde' | 'ambar' | 'rojo' | 'gris';

export type EnEtapa = {
  dias: number;
  /** El plazo que el dueño le puso a la etapa (`funnels.data.umbrales.porEtapa`), o null. */
  plazo: number | null;
  tono: Semaforo;
  /** Cuánto del plazo se usó, de 0 a 100 (sólo con plazo). */
  pct: number | null;
};

/**
 * Cuánto lleva en su etapa contra el plazo de la etapa. Sin plazo, sólo los días (gris: no hay contra qué medir).
 * Con plazo: rojo si lo pasó, ámbar en el último cuarto, verde antes. null = no se sabe desde cuándo (sin historial):
 * no se afirma un número que no se midió (la regla de lib/lead-quieto.ts).
 */
export function tiempoEnEtapa(desde: string | null | undefined, plazo: number | null | undefined, ahoraMs: number): EnEtapa | null {
  if (!desde) return null;
  const t = Date.parse(desde);
  if (!Number.isFinite(t)) return null;
  const dias = Math.max(0, Math.floor((ahoraMs - t) / DIA_MS));
  const p = plazo && plazo > 0 ? plazo : null;
  if (!p) return { dias, plazo: null, tono: 'gris', pct: null };
  const tono: Semaforo = dias >= p ? 'rojo' : dias >= Math.ceil(p * 0.75) ? 'ambar' : 'verde';
  return { dias, plazo: p, tono, pct: Math.min(100, Math.round((dias / p) * 100)) };
}

/** Las etapas donde «cuánto lleva» no aplica: ya terminó (la regla de `puedeTenerPlazo`, lib/lead-quieto.ts). */
export const ETAPAS_SIN_RELOJ: readonly string[] = ['ganado', 'perdido', 'descal', 'noresp'];

// ── Lo que contestó ─────────────────────────────────────────────────────────

export type Respuesta = { pregunta: string; respuesta: string };
export type RespuestasDeFuente = { fuente: FuenteRespuesta; respuestas: Respuesta[] };

/** Cómo se dibuja cada fuente, corto: el rótulo de su grupo. */
export const NOMBRE_FUENTE: Readonly<Record<FuenteRespuesta, string>> = {
  meta: 'En el anuncio', landing: 'En tu landing', agenda: 'Al agendar',
};

export type DatosRespuestas = {
  respuestasForm?: ReadonlyArray<Respuesta> | null;
  respuestasLanding?: ReadonlyArray<Respuesta> | null;
  /** Las de la agenda (Calendly, Cal.com), como las guarda el lead: pregunta y respuesta cortas. */
  respuestas?: { R1?: ReadonlyArray<{ q: string; a: string }> | null } | null;
};

const limpias = (xs: ReadonlyArray<Respuesta>): Respuesta[] =>
  xs.filter((r) => r.pregunta?.trim() && r.respuesta?.trim()).map((r) => ({ pregunta: r.pregunta.trim(), respuesta: r.respuesta.trim() }));

/**
 * LO QUE CONTESTÓ, por fuente y en el orden elegido: el formulario de Meta, el de la landing y lo que contestó al
 * agendar (la R1). Una fuente sin respuestas se calla. Junta lo que la ficha tenía en tres lugares (§3 del diseño).
 */
export function respuestasPorFuente(d: DatosRespuestas, fuentes: readonly FuenteRespuesta[] = FUENTES_RESPUESTA): RespuestasDeFuente[] {
  const out: RespuestasDeFuente[] = [];
  for (const f of fuentes) {
    const xs = f === 'meta' ? limpias(d.respuestasForm ?? [])
      : f === 'landing' ? limpias(d.respuestasLanding ?? [])
        : limpias((d.respuestas?.R1 ?? []).map((x) => ({ pregunta: x.q, respuesta: x.a })));
    if (xs.length) out.push({ fuente: f, respuestas: xs });
  }
  return out;
}

const normal = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[¿?¡!:.\s]+/g, ' ').trim();

/** Las preguntas que contestó este lead, sin repetir (para elegir la de «Respuesta destacada»). */
export function preguntasDelLead(d: DatosRespuestas): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const f of respuestasPorFuente(d)) {
    for (const r of f.respuestas) {
      const k = normal(r.pregunta);
      if (!vistas.has(k)) { vistas.add(k); out.push(r.pregunta); }
    }
  }
  return out;
}

/** La respuesta a UNA pregunta (sin mirar tildes, mayúsculas ni signos), de la primera fuente que la tenga. */
export function respuestaA(d: DatosRespuestas, pregunta: string | null | undefined): (Respuesta & { fuente: FuenteRespuesta }) | null {
  const k = pregunta ? normal(pregunta) : '';
  if (!k) return null;
  for (const f of respuestasPorFuente(d)) {
    const r = f.respuestas.find((x) => normal(x.pregunta) === k);
    if (r) return { ...r, fuente: f.fuente };
  }
  return null;
}

// ── De dónde vino ───────────────────────────────────────────────────────────

/** El tono del canal: el de la casa (`--accent` lo que pagó un anuncio, `--good` lo que llegó solo, `--dim` lo cargado). */
export type TonoOrigen = 'accent' | 'good' | 'dim';

/**
 * El canal de entrada, con su rótulo LARGO (el de la ficha; la tarjeta del tablero usa el corto de
 * app/crm/origen-lead.ts). Vivía en OrigenCard (se fue el 16/10/2026 con el Resumen nativo); las reglas, las de
 * siempre:
 *   · Cal.com es OTRO producto, no una variante de Calendly.
 *   · `landing` es el formulario de la landing: 27 leads se dibujaban «Orgánico / manual» por un case que faltaba.
 *   · Las altas sin canal (a mano, importación, el chat, Customer Success) estampan el suyo desde el 03/10/2026.
 *   · ⚠️ EL DEFAULT NO AFIRMA NADA: «Sin dato de origen», nunca «Orgánico / manual» (dos hechos sobre una columna vacía).
 * Que los ids sean los del catálogo lo fija tests/crm-origen-lead.test.ts.
 */
export function canalDeEntrada(origen: string | null | undefined): { texto: string; tono: TonoOrigen } {
  switch (origen) {
    case 'instant_form': return { texto: 'Instant Form (Meta)', tono: 'accent' };
    case 'calendly': return { texto: 'Calendly', tono: 'good' };
    case 'calcom': return { texto: 'Cal.com', tono: 'good' };
    case 'landing': return { texto: 'Formulario de tu landing', tono: 'accent' };
    case 'prueba': return { texto: 'La creó la prueba del Pixel', tono: 'dim' };
    case 'carga_manual': return { texto: 'Lo cargaste a mano', tono: 'dim' };
    case 'importacion': return { texto: 'Importado de un archivo', tono: 'dim' };
    case 'chat_whatsapp': return { texto: 'Escribió por WhatsApp', tono: 'good' };
    case 'instagram': return { texto: 'Llegó por Instagram', tono: 'good' };
    case 'messenger': return { texto: 'Llegó por Messenger', tono: 'good' };
    case 'hotmart': return { texto: 'Llegó por Hotmart', tono: 'good' };
    case 'skool': return { texto: 'Pidió entrar a tu Skool', tono: 'good' };
    default: return { texto: 'Sin dato de origen', tono: 'dim' };
  }
}

export type LeadConOrigen = {
  origen_lead?: string | null;
  utm_source?: string | null; utm_campaign?: string | null; utm_content?: string | null;
  meta_campaign_name?: string | null; meta_adset_name?: string | null; meta_ad_name?: string | null;
};
export type DatosOrigen = { campana?: { texto: string | null } | null; adNombre?: string | null; adId?: string | null };

export type Origen = {
  canal: { texto: string; tono: TonoOrigen };
  /** La fuente del clic (utm_source), legible: «Instagram», «Facebook». */
  fuente: string | null;
  campana: string | null;
  conjunto: string | null;
  anuncio: string | null;
  /** El anuncio en el Ads Manager de MaKo, si el server lo pudo resolver. */
  href: string | null;
};

/**
 * DE DÓNDE VINO: el canal, la fuente y Campaña › Conjunto › Anuncio. null = no hay nada de atribución (el bloque se
 * calla: decir «no hay forma de reconstruirlo» sobre cada lead cargado a mano es ruido fijo).
 */
export function origenDelLead(l: LeadConOrigen, d: DatosOrigen): Origen | null {
  const utmContent = l.utm_content?.trim() || null;
  const utmEsId = !!utmContent && /^\d{6,}$/.test(utmContent);
  const campana = l.meta_campaign_name ?? d.campana?.texto ?? null;
  const conjunto = l.meta_adset_name ?? null;
  const anuncio = d.adNombre ?? l.meta_ad_name ?? (utmContent && !utmEsId ? utmContent : null) ?? (d.adId ? `Anuncio ${d.adId}` : null);
  const hay = !!(l.origen_lead || campana || conjunto || anuncio || l.utm_campaign?.trim() || l.utm_source?.trim() || utmContent);
  if (!hay) return null;
  const s = l.utm_source?.trim() || null;
  return {
    canal: canalDeEntrada(l.origen_lead),
    fuente: s ? (s === 'fb' ? 'Facebook' : s === 'ig' ? 'Instagram' : s) : null,
    campana, conjunto, anuncio,
    href: d.adId ? `/ads-manager/${d.adId}` : null,
  };
}

// ── La página donde se registró y la publicación por la que entró ──────────

/** La página del opt-in, legible: el dominio y el camino, sin el protocolo ni la barra del final. */
export function paginaLegible(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  return u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '') || null;
}

/** El link para abrir la página (se guarda normalizada, a veces sin el protocolo). */
export function hrefDePagina(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u || /\s/.test(u)) return null;
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

// ── El dinero ───────────────────────────────────────────────────────────────

/** «$1,500», como el resto de la ficha (USD, sin decimales si no hacen falta). */
export const usd = (n: number): string => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** El ingreso estimado no es una venta: en un ganado se oculta (§3 del diseño). */
export const ingresoNoAplica = (estado: string | null | undefined): boolean => estado === 'ganado';

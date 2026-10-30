// =============================================================================
// newsletter-reglas — lo PURO del Newsletter (sin base, sin sesión), para testear sin Supabase
// =============================================================================
// Lo aprobó Martín el 29/10/2026 («Sí, armalo así»): los SUSCRIPTOS son un CRM «Newsletter» y las
// EDICIONES viven en la tab Newsletters. Un newsletter NO es una automatización: una automatización
// tiene final; un newsletter es una lista que no termina, con ediciones.
//
// EL MODELO, en dos frases:
//   · Una EDICIÓN es un broadcast de email (`email_broadcasts`) cuyo segmento es el CRM del newsletter
//     (`newsletter:<funnelId>` o `newsletter:<funnelId>:<etapa>`). Así hereda sin una línea nueva el
//     envío desde el dominio del negocio, el flag por workspace, la baja con token, el guard de 20 h,
//     el reanudable y el cron de los programados (lib/email-marketing.ts). Que sea una edición se DERIVA
//     del segmento: no hay una columna que lo diga aparte y pueda contradecirlo.
//   · La ETAPA del suscripto (Suscripto → Lee → Dormido → Dado de baja) se CALCULA de lo que hizo con
//     las últimas ediciones que le llegaron de verdad (`etapaPorLectura`), no se dispara a mano.
// =============================================================================

import type { Stage } from './pipeline';

export const NOMBRE_CRM_NEWSLETTER = 'Newsletter';
/** `funnels.plantilla` del CRM que crea la tab: sólo informa de dónde salió. */
export const PLANTILLA_NEWSLETTER = 'newsletter';

/**
 * Las claves de las etapas. «Suscripto» usa la canónica `lead` (`kind: 'entrada'`), a propósito: un lead
 * cuya CASA es el Newsletter y nunca se movió deriva `lead` (`deriveStageKey`), y con una clave propia
 * el tablero lo dibujaría en la primera columna por descarte (la falla de la plantilla `vsl`, en
 * docs/hallazgos-crm.md). Las otras tres son propias: a ellas se llega sólo moviéndolo, que es lo que
 * hace la conciliación.
 */
export const ETAPA_SUSCRIPTO = 'lead';
export const ETAPA_LEE = 'nl_lee';
export const ETAPA_DORMIDO = 'nl_dormido';
export const ETAPA_BAJA = 'nl_baja';
export type EtapaNewsletter = typeof ETAPA_SUSCRIPTO | typeof ETAPA_LEE | typeof ETAPA_DORMIDO | typeof ETAPA_BAJA;
export const ETAPAS_NEWSLETTER_KEYS: readonly EtapaNewsletter[] = [ETAPA_SUSCRIPTO, ETAPA_LEE, ETAPA_DORMIDO, ETAPA_BAJA];

/**
 * El pipeline con que nace el CRM. `kind: 'paso'` en las tres propias: no tiene case en `generateFunnel`,
 * así que no inventa nutrición ni pide requisitos al mover. `ganado` va al final porque el CRM lo pone
 * siempre (`conTerminales`); con su nombre de acá dice lo que es en un newsletter: un suscripto que compró.
 */
export const ETAPAS_NEWSLETTER: Stage[] = [
  { key: ETAPA_SUSCRIPTO, label: 'Suscripto', dot: '#2F6DDB', tone: 'info', kind: 'entrada' },
  { key: ETAPA_LEE, label: 'Lee', dot: '#1FA855', tone: 'teal', kind: 'paso' },
  { key: ETAPA_DORMIDO, label: 'Dormido', dot: '#A39E91', tone: 'neutral', kind: 'paso' },
  { key: ETAPA_BAJA, label: 'Dado de baja', dot: '#CF4E29', tone: 'bad', kind: 'paso' },
  { key: 'ganado', label: 'Compró', dot: '#3B6D11', tone: 'good', kind: 'cierre' },
];
/**
 * Las nutriciones que el CRM sembraría solo y que en un newsletter no significan nada: «No agendó» de la
 * etapa de entrada, la «Nutrición - Manual» fija (`idNutricionFija('manual')`) y la «Reactivación» que cuelga
 * de las salidas (a un dormido lo despierta la próxima edición que abra, no una nutrición).
 */
export const APAGADAS_NEWSLETTER: readonly string[] = [`${ETAPA_SUSCRIPTO}>nutri`, '*>manual', 'noresp>reactivacion', 'perdido>reactivacion'];

/**
 * Las salidas que el CRM agrega solo (Perdido, Descalificado, No responde): alguien lo sacó de la lista a
 * propósito, así que tampoco recibe ediciones.
 */
export const SALIDAS: readonly string[] = ['perdido', 'descal', 'noresp'];

// ── El segmento de una edición ───────────────────────────────────────────────
export const PREFIJO_SEGMENTO_NEWSLETTER = 'newsletter:';

export type SegmentoNewsletter = { funnelId: number; etapa: EtapaNewsletter | null };

const esEtapa = (v: string): v is EtapaNewsletter => (ETAPAS_NEWSLETTER_KEYS as readonly string[]).includes(v);

/**
 * `newsletter:<funnelId>` (todo el CRM menos las bajas) o `newsletter:<funnelId>:<etapa>` (una etapa).
 * `null` si no es un segmento de newsletter o está mal formado: quien llama decide (el validador de
 * email-marketing tira, que es lo que evita que un segmento desconocido le escriba a todos).
 */
export function segmentoNewsletter(s: unknown): SegmentoNewsletter | null {
  if (typeof s !== 'string' || !s.startsWith(PREFIJO_SEGMENTO_NEWSLETTER)) return null;
  const [id, etapa, ...resto] = s.slice(PREFIJO_SEGMENTO_NEWSLETTER.length).split(':');
  if (resto.length) return null;
  const funnelId = Number(id);
  if (!/^\d+$/.test(id ?? '') || !Number.isSafeInteger(funnelId) || funnelId <= 0) return null;
  if (etapa === undefined) return { funnelId, etapa: null };
  // A los dados de baja no se les escribe: ese segmento no existe aunque la etapa sí.
  if (!esEtapa(etapa) || etapa === ETAPA_BAJA) return null;
  return { funnelId, etapa };
}

export const segmentoDeNewsletter = (funnelId: number, etapa?: EtapaNewsletter | null): string =>
  `${PREFIJO_SEGMENTO_NEWSLETTER}${funnelId}${etapa ? `:${etapa}` : ''}`;

/** Más vencida que esto, una edición programada ya no sale sola: su texto («este viernes…») quedó viejo. Es más que la noche del cron (de 13 a 23 UTC). */
export const VENCIDA_MS = 24 * 60 * 60 * 1000;

/**
 * Qué hace el cron con las programadas que ya vencieron (la revisión del 30/10/2026, M3 y M4). Lo que no es una edición sale
 * como siempre. De las ediciones:
 *   · su CRM se archivó (M4): `cancelar`. El negocio lo sacó para dejar de mandarlo; sin esto seguían saliendo a toda la lista.
 *   · venció hace más de un día (M3: se programó con el envío apagado, y lo prendieron un mes después): `aBorrador`.
 *   · varias vencidas del mismo CRM: sale SÓLO la última, y las otras `aBorrador`. Si salieran todas, la primera quemaba a las
 *     demás: el guard de 20 h las marca «saltado» para todos y quedan como enviadas sin haber salido.
 * `crmsActivos` null = no se pudieron leer: las ediciones esperan a la próxima corrida (ni salen ni se tocan), y las demás siguen.
 */
export function repartirVencidas(
  filas: ReadonlyArray<{ id: number; segmento: string; programado_at: string | null }>,
  crmsActivos: ReadonlySet<number> | null,
  ahoraMs: number,
): { salen: number[]; aBorrador: number[]; cancelar: number[] } {
  const salen: number[] = [];
  const aBorrador: number[] = [];
  const cancelar: number[] = [];
  const ultimaDeCrm = new Map<number, { id: number; t: number }>();
  for (const f of filas) {
    const seg = segmentoNewsletter(f.segmento);
    if (!seg) { salen.push(f.id); continue; }
    if (!crmsActivos) continue;
    if (!crmsActivos.has(seg.funnelId)) { cancelar.push(f.id); continue; }
    const t = f.programado_at ? Date.parse(f.programado_at) : Number.NaN;
    if (!Number.isFinite(t) || ahoraMs - t > VENCIDA_MS) { aBorrador.push(f.id); continue; }
    const ya = ultimaDeCrm.get(seg.funnelId);
    if (!ya) { ultimaDeCrm.set(seg.funnelId, { id: f.id, t }); continue; }
    if (t > ya.t) { aBorrador.push(ya.id); ultimaDeCrm.set(seg.funnelId, { id: f.id, t }); } else aBorrador.push(f.id);
  }
  for (const u of ultimaDeCrm.values()) salen.push(u.id);
  return { salen, aBorrador, cancelar };
}

/** ¿Este broadcast es una edición del newsletter? Se deriva del segmento (ver la cabecera). */
export const esEdicion = (segmento: unknown): boolean => segmentoNewsletter(segmento) != null;

/**
 * ¿Un suscripto en la etapa `etapa` entra en el segmento? Las bajas y las salidas nunca; sin etapa pedida,
 * todas las demás (también «Compró»: sigue suscripto aunque haya comprado).
 */
export function entraEnSegmento(seg: SegmentoNewsletter, etapa: string | null | undefined): boolean {
  const e = etapa || ETAPA_SUSCRIPTO;
  if (e === ETAPA_BAJA || SALIDAS.includes(e)) return false;
  return seg.etapa == null || seg.etapa === e;
}

// ── La etapa que se CALCULA de la lectura ────────────────────────────────────
/** Cuántas ediciones seguidas sin abrir lo pasan a «Dormido» si el negocio no eligió otro número. */
export const DORMIDO_TRAS_DEFAULT = 3;
/**
 * Una edición recién mandada no cuenta como «no abierta» hasta pasado este margen: la gente abre el mail
 * al otro día. Sin esto, el cron de la misma tarde dormía a toda la lista.
 */
export const HORAS_PARA_ABRIR = 72;

/**
 * Un envío de una edición a un suscripto, como está en `email_broadcast_envios`. `medida: false` = de esa edición no
 * llegó NINGUNA apertura, de nadie (ver `etapaPorLectura`).
 */
export type EntregaEdicion = { enviadoAt: string; abierto: boolean; estado: string; medida?: boolean };

/**
 * La etapa de lectura de un suscripto, o `null` si no hay nada que mover.
 *
 * - Abrió alguna de las últimas `n` ediciones que le llegaron → «Lee».
 * - Le llegaron `n` o más (con su margen para abrir) y no abrió ninguna de las últimas `n` → «Dormido».
 * - Si no, se queda donde está (`null`): el recién suscripto sigue «Suscripto» hasta tener historia.
 *
 * ⚠️ SÓLO CUENTAN LOS ENVÍOS REALES (`estado = 'enviado'`). Con el envío apagado las ediciones quedan `simulado`:
 * nadie las abre porque no salieron, y contarlas dormiría a toda la lista sin que nadie haya dejado de leer. Un
 * `saltado` (el guard de 20 h) o un `fallo` tampoco le llegaron. El filtro va ACÁ, no en la consulta: una sola copia.
 * ⚠️ Y UNA EDICIÓN SIN NINGUNA APERTURA NO MIDE NADA (`medida: false`). Las aperturas llegan por el webhook de Resend, que
 *    valida UN signing secret, el de la cuenta de MaKo: un negocio con su propia key de Resend, o un webhook sin
 *    configurar, manda igual y no registra ni una apertura (app/admin/dev/newsletters/bitacora.ts, el pendiente F2). Sin
 *    este corte, a la tercera edición dormía a TODA la lista sin que nadie hubiera dejado de leer.
 * ⚠️ Las bajas, «Compró» y las salidas no las mueve la lectura: la baja la decide la persona, y la compra y las
 *    salidas, el CRM.
 */
export function etapaPorLectura(
  actual: string | null | undefined,
  entregas: readonly EntregaEdicion[],
  o: { n?: number; ahoraMs?: number } = {},
): EtapaNewsletter | null {
  const e = actual || ETAPA_SUSCRIPTO;
  if (e === ETAPA_BAJA || e === 'ganado' || SALIDAS.includes(e)) return null;
  const n = Math.max(1, Math.floor(o.n ?? DORMIDO_TRAS_DEFAULT));
  const ahora = o.ahoraMs ?? Date.now();
  const margen = HORAS_PARA_ABRIR * 3600_000;
  const ordenadas = entregas.filter((x) => x.estado === 'enviado' && x.medida !== false).sort((a, b) => Date.parse(b.enviadoAt) - Date.parse(a.enviadoAt));
  // Una abierta cuenta siempre, aunque sea de hoy; una sin abrir, sólo pasado el margen.
  const maduras = ordenadas.filter((x) => x.abierto || ahora - Date.parse(x.enviadoAt) >= margen);
  const ultimas = maduras.slice(0, n);
  let destino: EtapaNewsletter | null = null;
  if (ultimas.some((x) => x.abierto)) destino = ETAPA_LEE;
  else if (ultimas.length >= n) destino = ETAPA_DORMIDO;
  return destino && destino !== e ? destino : null;
}

// ── La configuración del negocio (app_settings) ──────────────────────────────
export const KEY_CONFIG_NEWSLETTER = 'newsletter.config';

export type Frecuencia = 'semanal' | 'quincenal' | 'mensual';
export const FRECUENCIAS: ReadonlyArray<{ id: Frecuencia; label: string; dias: number }> = [
  { id: 'semanal', label: 'Cada semana', dias: 7 },
  { id: 'quincenal', label: 'Cada 15 días', dias: 14 },
  { id: 'mensual', label: 'Una vez al mes', dias: 30 },
];
const esFrecuencia = (v: unknown): v is Frecuencia => FRECUENCIAS.some((f) => f.id === v);

export type ConfigNewsletter = {
  /** El CRM de los suscriptos. `null` = todavía no se creó. */
  funnelId: number | null;
  frecuencia: Frecuencia | null;
  /** De qué trata, con las palabras del negocio (sale de un botón o lo escribe). */
  tema: string | null;
  /** Ediciones seguidas sin abrir para pasar a «Dormido». */
  dormidoTras: number;
};

export const CONFIG_VACIA: ConfigNewsletter = { funnelId: null, frecuencia: null, tema: null, dormidoTras: DORMIDO_TRAS_DEFAULT };
export const MAX_TEMA = 200;

/** La config guardada, saneada. Lo que no se entiende vuelve a su valor vacío, nunca a uno inventado. */
export function leerConfig(crudo: unknown): ConfigNewsletter {
  let v: unknown = crudo;
  if (typeof crudo === 'string') { try { v = JSON.parse(crudo); } catch { v = null; } }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...CONFIG_VACIA };
  const o = v as Record<string, unknown>;
  const funnelId = typeof o.funnelId === 'number' && Number.isSafeInteger(o.funnelId) && o.funnelId > 0 ? o.funnelId : null;
  const tema = typeof o.tema === 'string' && o.tema.trim() ? o.tema.trim().replace(/\s+/g, ' ').slice(0, MAX_TEMA) : null;
  const n = Number(o.dormidoTras);
  return {
    funnelId,
    frecuencia: esFrecuencia(o.frecuencia) ? o.frecuencia : null,
    tema,
    dormidoTras: Number.isInteger(n) && n >= 1 && n <= 12 ? n : DORMIDO_TRAS_DEFAULT,
  };
}

// ── La próxima edición ───────────────────────────────────────────────────────
/**
 * La fecha que MaKo propone para la próxima edición: la última enviada o programada más la frecuencia, y
 * nunca antes de mañana. Sin frecuencia, `null` (no se inventa un ritmo que el negocio no eligió).
 * ⚠️ SE ANCLA EN LA EDICIÓN ANTERIOR, NO EN `now()` (AGENTS.md, «Un horario que se repite se ancla en la
 * OCURRENCIA ANTERIOR»): anclada en hoy, abrir la tab dos días seguidos corría la fecha dos días.
 */
export function proximaEdicion(frecuencia: Frecuencia | null, ultimaISO: string | null, ahoraMs = Date.now()): string | null {
  const f = FRECUENCIAS.find((x) => x.id === frecuencia);
  if (!f) return null;
  const manana = ahoraMs + 86400_000;
  const ultima = ultimaISO ? Date.parse(ultimaISO) : NaN;
  let t = Number.isFinite(ultima) ? ultima + f.dias * 86400_000 : manana;
  while (t < manana) t += f.dias * 86400_000;
  const d = new Date(t);
  d.setUTCHours(13, 0, 0, 0); // 10:00 en Buenos Aires: la hora la elige la persona al programar
  return d.toISOString();
}

// ── La apertura de la tab: MaKo pregunta, sin IA ─────────────────────────────
/**
 * Lo que MaKo pregunta al abrir la tab, UNA pregunta por vez, según lo que le falta a la config. Se arma
 * sin IA: se ve aunque el negocio no tenga la suya conectada. La IA del negocio entra cuando contesta (la
 * propuesta de la primera edición).
 */
export type PreguntaApertura =
  | { id: 'frecuencia'; texto: string; opciones: ReadonlyArray<{ valor: Frecuencia; label: string }> }
  | { id: 'tema'; texto: string; opciones: ReadonlyArray<{ valor: string; label: string }>; libre: true }
  | null;

export const TEMAS_SUGERIDOS: readonly string[] = ['Consejos de mi rubro', 'Novedades de mi negocio', 'Casos de mis clientes'];

export function preguntaDeApertura(c: Pick<ConfigNewsletter, 'frecuencia' | 'tema'>): PreguntaApertura {
  if (!c.frecuencia) {
    return { id: 'frecuencia', texto: '¿Cada cuánto quieres mandar tu newsletter?', opciones: FRECUENCIAS.map((f) => ({ valor: f.id, label: f.label })) };
  }
  if (!c.tema) {
    return { id: 'tema', texto: '¿De qué trata?', opciones: TEMAS_SUGERIDOS.map((t) => ({ valor: t, label: t })), libre: true };
  }
  return null;
}

// ── Las métricas de una edición ──────────────────────────────────────────────
export type FilaEnvio = { estado: string; abierto_at: string | null; clic_at: string | null; baja_at?: string | null };
export type MetricasEdicion = { enviados: number; simulados: number; abiertos: number; clics: number; bajas: number };

/** Aperturas, clics y bajas cuentan sobre los envíos REALES: un `simulado` no salió. */
export function metricasDe(filas: readonly FilaEnvio[]): MetricasEdicion {
  const m: MetricasEdicion = { enviados: 0, simulados: 0, abiertos: 0, clics: 0, bajas: 0 };
  for (const f of filas) {
    if (f.estado === 'simulado') { m.simulados += 1; continue; }
    if (f.estado !== 'enviado') continue;
    m.enviados += 1;
    if (f.abierto_at) m.abiertos += 1;
    if (f.clic_at) m.clics += 1;
    if (f.baja_at) m.bajas += 1;
  }
  return m;
}

// ── La edición escrita en el Copywriter ──────────────────────────────────────
/** Lo que se lee de un bloque del guion (el `BloqueLeido` de lib/copywriter/doc.ts, por su forma). */
export type BloqueDelDoc = { tipo: string; seccion: string | null; texto: string };
export type CopyDeEdicion = { asunto: string; preheader: string | null; cuerpo: string };

/**
 * El email de una edición escrita en el Copywriter, por las secciones de la plantilla de email (ASUNTO, VISTA PREVIA,
 * CUERPO, BOTON; la plantilla «Newsletter» la arma el chat del Copywriter con las mismas). Lo que está en otra sección o
 * sin sección va al cuerpo, en orden: no se tira nada que la persona escribió. Sin ASUNTO, el título del guion.
 */
export function edicionDelDoc(bloques: readonly BloqueDelDoc[], titulo: string): CopyDeEdicion {
  const de = (s: string) => bloques.filter((b) => b.tipo !== 'seccion' && b.seccion === s).map((b) => b.texto.trim()).filter(Boolean);
  const asunto = de('ASUNTO').join(' ').replace(/\s+/g, ' ').trim();
  const preheader = de('VISTA PREVIA').join(' ').replace(/\s+/g, ' ').trim();
  const propias = new Set(['ASUNTO', 'VISTA PREVIA', 'BOTON']);
  const cuerpo: string[] = [];
  for (const b of bloques) {
    if (b.tipo === 'seccion') continue;
    if (b.seccion && propias.has(b.seccion)) continue;
    const t = b.texto.trim();
    if (t && t !== '---') cuerpo.push(t);
  }
  const boton = de('BOTON').join(' ').trim();
  if (boton) cuerpo.push(boton);
  return { asunto: (asunto || titulo.trim()).slice(0, 200), preheader: preheader ? preheader.slice(0, 200) : null, cuerpo: cuerpo.join('\n\n') };
}

// ── La charla de apertura (sin IA) ───────────────────────────────────────────
export type MensajeApertura = { id: string; de: 'mako' | 'yo'; texto: string; at: string; opciones?: string[] };

/** La frecuencia que dijo la persona, por la pastilla o con sus palabras. `null` = no se entendió. */
export function frecuenciaDeTexto(t: string): Frecuencia | null {
  const s = t.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const exacta = FRECUENCIAS.find((f) => f.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === s);
  if (exacta) return exacta.id;
  if (/15|quince|quincen|dos semanas/.test(s)) return 'quincenal';
  if (/mes|mensual/.test(s)) return 'mensual';
  if (/semana|semanal/.test(s)) return 'semanal';
  return null;
}

const etiquetaFrecuencia = (f: Frecuencia) => FRECUENCIAS.find((x) => x.id === f)?.label ?? f;

/**
 * La charla con que abre la tab: lo ya contestado como intercambio y la pregunta que falta al final, con sus pastillas.
 * Sin pregunta pendiente, el último mensaje dice qué sigue (`cierre`, que arma quien llama: con la IA del negocio, la
 * propuesta de la primera edición; sin ella, el camino sin IA).
 */
export function mensajesDeApertura(c: Pick<ConfigNewsletter, 'frecuencia' | 'tema'>, cierre?: { texto: string; opciones?: string[] } | null): MensajeApertura[] {
  const out: MensajeApertura[] = [];
  const freq = preguntaDeApertura({ frecuencia: null, tema: null });
  if (freq) out.push({ id: 'nl-frecuencia', de: 'mako', texto: freq.texto, at: '', ...(!c.frecuencia ? { opciones: freq.opciones.map((o) => o.label) } : {}) });
  if (!c.frecuencia) return out;
  out.push({ id: 'nl-frecuencia-r', de: 'yo', texto: etiquetaFrecuencia(c.frecuencia), at: '' });
  const tema = preguntaDeApertura({ frecuencia: c.frecuencia, tema: null });
  if (tema) out.push({ id: 'nl-tema', de: 'mako', texto: tema.texto, at: '', ...(!c.tema ? { opciones: tema.opciones.map((o) => o.label) } : {}) });
  if (!c.tema) return out;
  out.push({ id: 'nl-tema-r', de: 'yo', texto: c.tema, at: '' });
  if (cierre) out.push({ id: 'nl-cierre', de: 'mako', texto: cierre.texto, at: '', ...(cierre.opciones?.length ? { opciones: cierre.opciones } : {}) });
  return out;
}

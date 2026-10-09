// =============================================================================
// recordatorio-lead — CUÁNDO y QUÉ se le recuerda al LEAD antes de su reunión (puro)
// =============================================================================
// Sin 'server-only' a propósito: tests/recordatorio-lead.test.ts lo EJECUTA. Acá no se lee ni
// se manda nada; el emisor vive en lib/reunion-recordatorio.ts (`mandarRecordatoriosAlLead`).
//
// Decisión de Martín (06/10/2026), textual: «A: 24h, 1h y 15min con link, ws1, apago n8n».
// Son los tres toques que mandaba el workflow de n8n «WhatsApp Reminders for Calendly», ahora
// salidos de la app: con el link de la reunión que guarda el webhook de Calendly (mig 0204) y
// por la línea no oficial del negocio.
//
// ⚠️ POR QUÉ NO ES UN PASO ANCLADO DEL MOTOR DE NUTRICIÓN (medido en el relevo #17): el motor
// redondea `delay_horas` a horas enteras (15 minutos no existe), corre «0 15-23 * * *», tiene
// una ventana 9-21 con la zona fija y un freno anti-ban de 3 h entre mensajes que frena el de
// 1 h seguido del de 15 min, y la inscripción es una vez en la vida: la R2 y las reagendas se
// quedaban sin recordatorio. Esto es un emisor aparte, gemelo del aviso de 30 minutos al dueño.
//
// ── CUÁNDO ───────────────────────────────────────────────────────────────────
// Un toque VENCE cuando su momento (`inicio − min`) cayó en la ventana de esta corrida:
// `momento ≤ ahora < momento + tolerancia`. Pasada la tolerancia el toque se PIERDE, no se manda
// tarde: «te recuerdo tu reunión de mañana» a las 3 de la tarde de hoy es un mensaje que miente.
// Y nunca con la reunión empezada. Lo que impide que salga dos veces NO es la ventana: es la
// marca por toque (`claveToque`), que lleva el ISO de la reunión adentro — una REAGENDA cambia
// el ISO, da claves nuevas y los tres toques del horario nuevo sí salen.
//
// ── QUÉ ──────────────────────────────────────────────────────────────────────
// ⚠️ LOS LEADS DE MAURICIO SON MEXICANOS: los textos van en español NEUTRO y de TÚ. Los
// comentarios del repo están escritos de vos y copiar de ahí es la forma más fácil de meter un
// «entrá»: el test lo persigue sobre los textos ARMADOS.
//
// ⚠️ LA HORA SE DICE EN LA ZONA DEL NEGOCIO (`tz`, la de `tzDeWorkspace`), nunca en una fija ni
// en la del server (UTC). Y lo que habla de un MOMENTO se calcula al SALIR (`ahora`), no al
// programarse: «empieza en 52 minutos» si el cron llegó 8 minutos tarde, no «en una hora».
//
// ⚠️ EL LINK LO PONE EL CÓDIGO, nunca un modelo, y si la reunión no tiene link (una llamada por
// teléfono, una presencial, una anterior a la mig 0204) el renglón que lo nombra NO SALE: un
// «Para entrar: {{link}}» crudo en el teléfono de un lead es lo único peor que no mandar nada.
// Lo escriben TRES caminos, y los tres pasan por acá: el webhook y el backfill de Calendly
// (`linkDeReunion`) y el webhook de Cal.com (`linkDeReunionCalcom`).
// =============================================================================

import { cuandoEs, horaDe, primerNombreDe } from './curso-mensajes-texto';
import { partesEn } from './cron-aviso';

/** Los minutos antes de la reunión en que sale cada toque: 24 h, 1 h y 15 min. */
export const TOQUES = [1440, 60, 15] as const;
export type Toque = (typeof TOQUES)[number];

/**
 * Cuánto tarde puede salir un toque. El cron corre cada 10 minutos (vercel.json, `*\/10`):
 * con 12 cada momento cae en al menos una corrida aunque una arranque un par de minutos tarde,
 * y la que lo ve dos veces la frena la marca. Más que esto ya es mandar tarde.
 */
export const TOLERANCIA_MIN = 12;

/** La clave del setting POR WORKSPACE. No se hereda del dueño (ver `leerConfigRecordatorio`). */
export const KEY_RECORDATORIO = 'chatbot.recordatorio_reunion';

export type CualReunion = 'R1' | 'R2';

/** Una reunión del lead, como la guarda la fila. */
export type Junta = {
  cual: CualReunion;
  /** `junta_X_at`: el instante con hora. */
  inicio: string | null;
  /**
   * `fecha_junta_X`: la fecha de calendario. ⚠️ ES LA QUE DICE SI LA REUNIÓN SIGUE EN PIE: una
   * cancelación de Calendly la pone en null y NO toca `junta_X_at` (corrección del refutador
   * del #17: ponerla en null empeora la regla T1 del CRM), así que `inicio` solo no alcanza.
   */
  fecha: string | null;
  /** `asistio_jX`: si ya está marcada, la reunión ocurrió. */
  asistio: boolean | null;
  /** `junta_X_url` (mig 0204). */
  link?: string | null;
};

/** La fila del lead con lo que hace falta para armar sus juntas. */
export type FilaJuntas = {
  junta_1_at: string | null; junta_2_at: string | null;
  fecha_junta_1: string | null; fecha_junta_2: string | null;
  asistio_j1: boolean | null; asistio_j2: boolean | null;
  junta_1_url?: string | null; junta_2_url?: string | null;
};

export function juntasDe(l: FilaJuntas): Junta[] {
  return [
    { cual: 'R1', inicio: l.junta_1_at, fecha: l.fecha_junta_1, asistio: l.asistio_j1, link: l.junta_1_url ?? null },
    { cual: 'R2', inicio: l.junta_2_at, fecha: l.fecha_junta_2, asistio: l.asistio_j2, link: l.junta_2_url ?? null },
  ];
}

/** Un lead cerrado o perdido sigue teniendo la fecha cargada: sólo se le recuerda a uno abierto. */
export function leadAbierto(estado: string | null | undefined): boolean {
  return estado == null || estado === 'abierto';
}

/**
 * El ISO CANÓNICO de un instante. La base devuelve `…+00:00` y Calendly `…Z` o con
 * microsegundos: si la clave de la marca usara el texto crudo, el mismo instante escrito de dos
 * formas serían dos marcas y el toque saldría dos veces.
 */
export function isoCanonico(iso: string): string | null {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export function claveToque(leadId: number, cual: CualReunion, inicioIso: string, min: number): string {
  return `mako.recordatorio-lead.${leadId}.${cual}.${isoCanonico(inicioIso) ?? inicioIso}.${min}`;
}

/**
 * La zona en la que los webhooks de agenda escriben `fecha_junta_X` (`isoToFechaTijuana` en
 * lib/calendly.ts, que usan Calendly y Cal.com). No se importa de ahí porque ese módulo trae
 * `node:crypto`; si esa convención cambia, cambia en los dos.
 */
export const TZ_FECHA_AGENDA = 'America/Tijuana';

/** El día de calendario (`YYYY-MM-DD`) de un instante en una zona, o null si algo no se lee. */
export function fechaEnZona(iso: string, tz: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  try {
    const p = partesEn(tz, new Date(t));
    return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  } catch {
    return null;
  }
}

/**
 * ¿`junta_X_at` sigue siendo la hora de la reunión que dice `fecha_junta_X`?
 *
 * ⚠️ NO SIEMPRE: la fecha se edita a mano sin tocar la hora. `updateLead` (la ficha, el
 * Kanban con «Agendada fuera de Calendly», `setMeetingManual` de MaKo) escribe
 * `fecha_junta_X` y nunca `junta_X_at`, y la cancelación de Calendly tampoco borra la hora
 * (corrección del refutador del #17). O sea: un lead que canceló su R1 del 10/10 a las 10:00
 * y al que el setter le agendó otra para el 09/10 por WhatsApp queda con `fecha_junta_1` en
 * pie y `junta_1_at` apuntando a la reunión CANCELADA — y el recordatorio le escribiría
 * «tu reunión mañana a las 10:00» sobre una que no existe. Medido en el ws1 (06/10/2026): 1
 * de 50 leads con hora tiene la fecha en otro día.
 *
 * La fecha la escriben en dos zonas: los webhooks en la de `TZ_FECHA_AGENDA`, y el
 * «reagendar» del CRM en la del negocio (lo que la persona eligió en su calendario). Vale
 * cualquiera de las dos; un día que no es ninguno es una hora que quedó vieja, y no se manda.
 */
export function fechaCoincide(fecha: string, inicioIso: string, tzNegocio?: string | null): boolean {
  const f = String(fecha).slice(0, 10);
  if (fechaEnZona(inicioIso, TZ_FECHA_AGENDA) === f) return true;
  return !!tzNegocio && fechaEnZona(inicioIso, tzNegocio) === f;
}

export type ToqueVencido = {
  cual: CualReunion;
  /** El ISO canónico de la reunión. */
  inicio: string;
  min: number;
  clave: string;
  link: string | null;
};

/**
 * Los toques que esta corrida tiene que mandar, y ninguno más. Ver la cabecera: vence el que
 * cayó en `[momento, momento + tolerancia)`, nunca con la reunión empezada, nunca de una reunión
 * cancelada (`fecha` null) o con la asistencia ya marcada, y nunca si la hora quedó vieja
 * respecto de la fecha (`fechaCoincide`). `tz` es la zona del negocio.
 */
export function toquesVencidos(p: {
  leadId: number;
  juntas: Junta[];
  ahora: number;
  tolMin?: number;
  toques?: readonly number[];
  tz?: string | null;
}): ToqueVencido[] {
  const tol = (p.tolMin ?? TOLERANCIA_MIN) * 60_000;
  const toques = p.toques ?? TOQUES;
  const out: ToqueVencido[] = [];
  for (const j of p.juntas) {
    if (!j.inicio || !j.fecha || j.asistio != null) continue;
    const inicio = isoCanonico(j.inicio);
    if (!inicio) continue;
    if (!fechaCoincide(j.fecha, inicio, p.tz)) continue;
    const t = Date.parse(inicio);
    if (t <= p.ahora) continue;
    for (const min of toques) {
      const momento = t - min * 60_000;
      if (momento <= p.ahora && p.ahora - momento < tol) {
        out.push({ cual: j.cual, inicio, min, clave: claveToque(p.leadId, j.cual, inicio, min), link: limpiarLink(j.link) });
      }
    }
  }
  return out;
}

/**
 * Qué hacer con la marca de un toque, según lo que tenga guardado.
 *
 *   · null            → nadie lo tomó: se RECLAMA (compare-and-set contra «no existe»).
 *   · `fallo:…`       → el envío anterior no salió: se vuelve a reclamar contra ESE valor.
 *   · cualquier otra  → `enviado:…`, `incierto:…` (ver `envioIncierto`), o `reclamado:…` de
 *                       otra corrida que lo está mandando (o que murió mandándolo): no se toca. Un reclamo viejo NO se recupera
 *                       a propósito: si el proceso murió después de que Evolution mandara,
 *                       recuperarlo es mandar dos veces, y perder un recordatorio es lo menos malo.
 */
export function estadoDeLaMarca(valor: string | null): 'libre' | 'reintento' | 'tomada' {
  if (valor == null) return 'libre';
  if (valor.startsWith('fallo:')) return 'reintento';
  return 'tomada';
}

/**
 * ¿Este error de envío deja la duda de si el mensaje SALIÓ? Entonces la marca queda en
 * `incierto:` (tomada) y NO se reintenta.
 *
 * Es la misma regla que el reclamo viejo de arriba: Evolution retiene el HTTP con su `delay` y
 * `evFetch` corta a los 30 s (lib/evolution.ts), así que un corte por tiempo o una conexión que
 * se cae a mitad puede llegar DESPUÉS de que WhatsApp lo entregó. Reintentarlo es mandarle el
 * mismo recordatorio dos veces a un lead real. Lo que sí se reintenta es lo que Evolution
 * CONTESTÓ con un error (la línea caída, el número que no existe) o lo que ni salió de acá.
 *
 * Se equivoca para el lado seguro: un error que diga «timeout» sin haber viajado se pierde, no
 * se duplica.
 */
export function envioIncierto(error: string | null | undefined): boolean {
  return /time ?out|timed out|aborted|fetch failed|socket hang up|other side closed|ECONNRESET/i.test(String(error ?? ''));
}

/** La fila del lead con lo que hace falta para decidir qué reunión anula una cancelación. */
export type FilaCancelacion = {
  fecha_junta_1: string | null; fecha_junta_2: string | null;
  junta_1_at?: string | null; junta_2_at?: string | null;
};

/**
 * Qué reunión anula una cancelación de Calendly o Cal.com (`cancelarJuntaEnLead`, lib/leads.ts),
 * o por qué ninguna.
 *
 * Por FECHA, como siempre, y además por INSTANTE cuando los dos lo tienen. ⚠️ Sin el instante,
 * una REAGENDA EN EL MISMO DÍA borraba la reunión nueva: Calendly manda la cancelación de la
 * vieja y la reserva de la nueva sin orden garantizado, y si la nueva llega primero la fila ya
 * dice el día de las dos — la cancelación de las 10:00 ponía en null la `fecha_junta_1` de la de
 * las 16:00, el lead salía de «Agendado» y el recordatorio al lead (que exige la fecha en pie)
 * no salía. `inicio` vuelve para que el UPDATE lo exija en su WHERE: así también pierde la
 * carrera si las dos llegan a la vez.
 */
export function juntaACancelar(
  l: FilaCancelacion,
  fechaCancelada: string,
  hoy: string,
  inicioCancelado?: string | null,
): { cual: CualReunion; inicio: string | null } | { motivo: string } {
  if (fechaCancelada < hoy) return { motivo: 'reunión ya pasó — sin cambios' };
  const c = inicioCancelado ? isoCanonico(inicioCancelado) : null;
  let otroHorario = false;
  const candidatas: Array<[CualReunion, string | null, string | null | undefined]> = [
    ['R2', l.fecha_junta_2, l.junta_2_at],
    ['R1', l.fecha_junta_1, l.junta_1_at],
  ];
  for (const [cual, fecha, at] of candidatas) {
    if (!fecha || String(fecha).slice(0, 10) !== fechaCancelada) continue;
    const vigente = at ? isoCanonico(at) : null;
    if (c && vigente && vigente !== c) { otroHorario = true; continue; }
    return { cual, inicio: c && vigente ? (inicioCancelado as string) : null };
  }
  return { motivo: otroHorario ? 'la reunión vigente es otro horario (reagenda) — sin cambios' : 'fecha cancelada no coincide con R1/R2 — sin cambios' };
}

// ── El link ─────────────────────────────────────────────────────────────────

/** Sólo un https: lo que se manda al lead no puede ser un `javascript:` ni un texto suelto. */
function limpiarLink(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!/^https:\/\/\S+$/i.test(s) || s.length > 500) return null;
  try { return new URL(s).protocol === 'https:' ? s : null; } catch { return null; }
}

/**
 * El link para ENTRAR a la reunión, del `scheduled_event.location` del webhook de Calendly
 * (`{ type: 'google_conference' | 'zoom' | …, join_url }`). Una reunión presencial o por
 * teléfono trae `location` y no `join_url`: eso NO es un link para entrar y no se manda.
 */
export function linkDeReunion(location: unknown): string | null {
  if (!location || typeof location !== 'object') return null;
  return limpiarLink((location as { join_url?: unknown }).join_url);
}

/** Un mapa no es un link para entrar: es la dirección de una presencial pegada como URL. */
const MAPA = /^https:\/\/([^/]*\.)?(google\.[a-z.]+\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com|waze\.com)/i;

/**
 * El link para ENTRAR a una reserva de Cal.com, del `payload` de su webhook (BOOKING_CREATED y
 * BOOKING_RESCHEDULED; la cancelación no lo trae). Cal.com NO lo manda donde Calendly: no hay
 * `join_url`, y `location` casi nunca sirve, porque en una reunión por videollamada es el
 * NOMBRE de la integración (`integrations:google:meet`, `integrations:daily`), no una URL.
 *
 * En este orden (doc de webhooks de Cal.com, payload 2021-10-20):
 *   1. `metadata.videoCallUrl` — el link PÚBLICO, el mismo que va en el mail de confirmación:
 *      el Meet (`hangoutLink`), el Zoom, o `app.cal.com/video/<uid>` para Cal Video.
 *   2. `videoCallData.url` — salvo Cal Video (`daily_video` o un host `*.daily.co`): ese es el
 *      cuarto CRUDO de Daily, que pide un token para entrar (cal.diy PR #29922 lo reescribe
 *      justamente por eso). Se usa sólo si falta el 1.
 *   3. `location`, sólo si ES un link — la ubicación «Link» fija que el dueño pega en su event
 *      type. Una dirección, un teléfono, un `integrations:…` sin URL o un mapa NO son un link.
 *
 * Medido en el ws13 (06/10/2026, GET /v2/bookings, sólo lectura): sus 5 reservas próximas son
 * Google Meet. La API v2 devuelve el Meet en `location`/`meetingUrl`, pero el WEBHOOK lo manda en
 * `metadata.videoCallUrl` con `location: "integrations:google:meet"`: son dos formas distintas.
 */
export function linkDeReunionCalcom(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as { metadata?: unknown; videoCallData?: unknown; location?: unknown };
  if (p.metadata && typeof p.metadata === 'object') {
    const u = limpiarLink((p.metadata as { videoCallUrl?: unknown }).videoCallUrl);
    if (u) return u;
  }
  if (p.videoCallData && typeof p.videoCallData === 'object') {
    const v = p.videoCallData as { type?: unknown; url?: unknown };
    const u = limpiarLink(v.url);
    if (u && v.type !== 'daily_video' && !/^https:\/\/([^/]*\.)?daily\.co(\/|$)/i.test(u)) return u;
  }
  const u = limpiarLink(p.location);
  return u && !MAPA.test(u) ? u : null;
}

/**
 * Qué reunión es la que se cancela, para limpiarle el link. Compara INSTANTES, no fechas: si el
 * webhook de la reserva nueva llegó antes que la cancelación de la vieja (Calendly no garantiza
 * el orden de una reagenda), la fila ya tiene el horario nuevo y su link no se toca.
 */
export function juntaQueSeCancela(
  l: { junta_1_at: string | null; junta_2_at: string | null },
  inicioCancelado: string | null | undefined,
): CualReunion | null {
  const c = inicioCancelado ? isoCanonico(inicioCancelado) : null;
  if (!c) return null;
  if (l.junta_2_at && isoCanonico(l.junta_2_at) === c) return 'R2';
  if (l.junta_1_at && isoCanonico(l.junta_1_at) === c) return 'R1';
  return null;
}

// ── Los textos ──────────────────────────────────────────────────────────────

/** Las variables que entiende un texto. Lo que no esté acá no se puede guardar. */
export const VARIABLES = ['nombre', 'cuando', 'hora', 'faltan', 'link'] as const;

export const TEXTO_DEFAULT: Record<Toque, string> = {
  1440: 'Hola {{nombre}}, te recuerdo tu reunión {{cuando}} a las {{hora}}.\nPara entrar: {{link}}',
  60: 'Hola {{nombre}}, tu reunión empieza {{faltan}}, a las {{hora}}.\nPara entrar: {{link}}',
  15: 'Hola {{nombre}}, empezamos {{faltan}}.\nEntra aquí: {{link}}',
};

/** Tope de un texto: un recordatorio se lee de un vistazo. */
export const TOPE_TEXTO = 600;

/** Las `{{x}}` de un texto que no son variables. Se rechazan al GUARDAR, no al mandar. */
export function variablesDesconocidas(texto: string): string[] {
  const conocidas = new Set<string>(VARIABLES);
  const halladas = [...String(texto ?? '').matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(halladas.filter((v) => !conocidas.has(v)))];
}

/** «en 52 minutos», «en 1 hora»: lo que falta AL SALIR, no lo que faltaba al programarse. */
export function faltanTexto(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  if (m < 1) return 'ahora';
  if (m < 60) return `en ${m} ${m === 1 ? 'minuto' : 'minutos'}`;
  const h = Math.round(m / 60);
  return `en ${h} ${h === 1 ? 'hora' : 'horas'}`;
}

/**
 * El texto que le llega al lead, o null si no queda nada que mandar.
 *
 * Sin link, cada renglón que nombra `{{link}}` se va entero. Una variable que no se conoce (no
 * debería: se rechaza al guardar) se BORRA en vez de salir cruda, porque esto sale solo y nadie lo
 * lee antes.
 */
export function textoDelToque(p: {
  plantilla: string;
  nombre: string | null;
  inicio: Date;
  ahora: Date;
  tz: string;
  link: string | null;
}): string | null {
  const link = limpiarLink(p.link);
  const valores: Record<string, string> = {
    nombre: primerNombreDe(p.nombre),
    cuando: cuandoEs(p.inicio, p.ahora, p.tz),
    hora: horaDe(p.inicio, p.tz),
    faltan: faltanTexto((p.inicio.getTime() - p.ahora.getTime()) / 60_000),
    link: link ?? '',
  };
  const lineas = String(p.plantilla ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((l) => link || !/\{\{\s*link\s*\}\}/.test(l))
    .map((l) => l
      .replace(/\{\{\s*([^}]*?)\s*\}\}/g, (_, v: string) => valores[v] ?? '')
      // Sin nombre, «Hola {{nombre}},» queda «Hola ,»: se junta la coma.
      .replace(/[ \t]+,/g, ',')
      .replace(/[ \t]{2,}/g, ' ')
      // La hora ya termina en «a. m.»: «a las {{hora}}.» no puede quedar «a. m..».
      .replace(/([ap])\. m\.\./g, '$1. m.')
      .trim());
  const texto = lineas.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return texto || null;
}

// ── La configuración ────────────────────────────────────────────────────────

export type ConfigRecordatorio = {
  /** Sólo un `true` literal lo prende: nace APAGADO, y un valor raro no le escribe a nadie. */
  activo: boolean;
  /** El texto efectivo de cada toque (el propio, o el de fábrica). */
  textos: Record<Toque, string>;
  /** Cuáles escribió el negocio. Los demás siguen al de fábrica si el de fábrica cambia. */
  propios: Toque[];
};

const esToque = (n: unknown): n is Toque => (TOQUES as readonly unknown[]).includes(n);

/** El setting guardado, saneado. Un JSON roto es «apagado con los textos de fábrica». */
export function configDeRecordatorio(raw: string | null): ConfigRecordatorio {
  const out: ConfigRecordatorio = { activo: false, textos: { ...TEXTO_DEFAULT }, propios: [] };
  if (!raw) return out;
  let o: unknown;
  try { o = JSON.parse(raw); } catch { return out; }
  if (!o || typeof o !== 'object') return out;
  const obj = o as { activo?: unknown; toques?: unknown };
  out.activo = obj.activo === true;
  if (Array.isArray(obj.toques)) {
    for (const t of obj.toques as Array<{ min?: unknown; texto?: unknown }>) {
      if (!t || !esToque(t.min) || typeof t.texto !== 'string') continue;
      const texto = t.texto.trim().slice(0, TOPE_TEXTO);
      if (!texto || texto === TEXTO_DEFAULT[t.min]) continue;
      out.textos[t.min] = texto;
      if (!out.propios.includes(t.min)) out.propios.push(t.min);
    }
  }
  return out;
}

/**
 * Lo que se guarda. Sólo van los textos PROPIOS: uno igual al de fábrica (o vacío) no se
 * escribe, así una mejora del de fábrica le llega a quien nunca lo tocó.
 */
export function serializarConfig(p: { activo: boolean; textos: Partial<Record<Toque, string>> }): string {
  const toques: Array<{ min: Toque; texto: string }> = [];
  for (const min of TOQUES) {
    const texto = String(p.textos[min] ?? '').trim().slice(0, TOPE_TEXTO);
    if (texto && texto !== TEXTO_DEFAULT[min]) toques.push({ min, texto });
  }
  return JSON.stringify({ activo: p.activo === true, toques });
}

// =============================================================================
// Cal.com — verificación de firma + parseo de payload
// =============================================================================
// El HERMANO de lib/calendly.ts, y hace falta porque son DOS PRODUCTOS DISTINTOS:
// calendly.com y cal.com son empresas diferentes, con API, firma y payload
// distintos. La confusión ya costó caro: el snippet del Pixel entendía solo el
// postMessage de Calendly, y un cliente que agenda con Cal.com (ws13, Código
// Inmobiliario) se agendó de verdad y MaKo no registró nada.
//
// ⚠️ ESTE MÓDULO NO PUEDE IMPORTAR `server-only` NI `credWs`. Es la misma frontera
// que respeta calendly.ts, y no es estética: es lo que permite que la firma y los
// parsers tengan tests que corran sin levantar media app. Las credenciales las
// resuelve el webhook y se las pasa como argumento.
//
// Las tres diferencias con Calendly que gobiernan el diseño:
//
//  1. LA FIRMA NO LLEVA TIMESTAMP. Calendly manda `t=…,v1=…` y se firma
//     `${t}.${body}`, lo que da anti-replay gratis. Cal.com manda un hex pelado en
//     `x-cal-signature-256` sobre el body crudo, así que NO hay anti-replay por
//     firma: lo aporta la idempotencia por `uid` río abajo, no este módulo.
//
//  2. EL SOBRE ES OTRO. Calendly: `{ event: 'invitee.created', payload: {…} }`.
//     Cal.com: `{ triggerEvent: 'BOOKING_CREATED', payload: {…} }`, en MAYÚSCULAS
//     y con los asistentes en un array.
//
//  3. LA API v1 ESTÁ APAGADA (8/4/2026). Cualquier llamada sale contra v2, que
//     además exige un header de versión — ver `CALCOM_API` abajo.
// =============================================================================

import crypto from 'node:crypto';
import { mismoEventType, type TipoJunta } from './calendly';
// El renglón de cada respuesta (rótulo corto, valor cortado) vive en un módulo puro desde la undécima tanda
// (11/10/2026): lo usan este aviso y el dato `{{lead_respuestas_agenda}}`. Se re-exportan para los que ya los
// importaban de acá.
import { recortar, renglonesDeRespuestas } from './respuestas-agenda';
export { TOPE_AVISO, rotuloCorto } from './respuestas-agenda';

/** Base y headers de la API v2. La v1 está apagada desde el 8/4/2026. */
export const CALCOM_API = {
  base: 'https://api.cal.com/v2',
  /**
   * Cal.com versiona por endpoint con este header. Sin él, la respuesta puede
   * venir con otra forma sin aviso — que es el modo de falla más caro: no rompe,
   * devuelve otra cosa.
   */
  version: '2024-08-13',
} as const;

export function calcomHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'cal-api-version': CALCOM_API.version,
    'Content-Type': 'application/json',
  };
}

export class CalcomSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalcomSignatureError';
  }
}

/**
 * El valor que Cal.com manda en el header cuando el webhook NO tiene secreto.
 *
 * ⚠️ ES LA TRAMPA DE ESTE PROVEEDOR. No omite el header: manda esta cadena. Un
 * guard escrito como `if (header) verificar()` la trata como si fuera una firma,
 * y uno escrito como `if (!secret) return` deja pasar el webhook sin verificar
 * NADA — o sea que cualquiera que descubra la URL puede inventar reservas y
 * meterle leads al CRM de un cliente. Se nombra y se rechaza explícito.
 */
const SIN_SECRETO = 'no-secret-provided';

/**
 * Verifica la firma de un webhook de Cal.com. Fail-closed en los tres casos:
 * sin header, sin secreto configurado, o con el centinela de "sin secreto".
 *
 * @throws CalcomSignatureError
 */
export function verifyCalcomSignature(
  rawBody: string,
  signatureHeader: string | null,
  signingKey: string,
): void {
  if (!signatureHeader) {
    throw new CalcomSignatureError('Falta header x-cal-signature-256');
  }
  if (signatureHeader.trim() === SIN_SECRETO) {
    // No es un error de configuración nuestro: es que el webhook se dio de alta
    // en Cal.com sin secreto. El mensaje dice qué hacer, porque el que lo va a
    // leer es quien lo configuró.
    throw new CalcomSignatureError(
      'El webhook está dado de alta SIN secreto en Cal.com. Edítalo y pega el mismo valor que guardaste en MaKo.',
    );
  }
  if (!signingKey) {
    throw new CalcomSignatureError('CALCOM_WEBHOOK_SECRET no configurada');
  }

  const esperada = crypto.createHmac('sha256', signingKey).update(rawBody, 'utf8').digest('hex');
  // Se acepta con y sin el prefijo `sha256=`: distintos proxies y versiones lo
  // agregan, y rechazar por el prefijo sería rechazar una firma correcta.
  const recibida = signatureHeader.trim().replace(/^sha256=/i, '').toLowerCase();

  // timingSafeEqual explota si los largos difieren, así que se compara antes.
  // Y devolver "largo distinto" no filtra nada: la firma es pública en el header.
  if (esperada.length !== recibida.length) {
    throw new CalcomSignatureError('Firma con length distinto a la esperada');
  }
  if (!crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(recibida))) {
    throw new CalcomSignatureError('Firma no coincide');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// El payload (lo que nos importa)
// ─────────────────────────────────────────────────────────────────────────────

/** Los triggers que MaKo escucha. El resto se ignora con 200. */
export type TriggerCalcom =
  | 'BOOKING_CREATED'
  | 'BOOKING_RESCHEDULED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REJECTED'
  | 'MEETING_ENDED';

export type CalcomAsistente = {
  name?: string;
  email?: string;
  phoneNumber?: string;
  timeZone?: string;
};

export type CalcomReservaPayload = {
  uid?: string;
  bookingId?: number | string;
  /** El título de la RESERVA («Llamada de auditoría between Ana and Juan»), NO el del tipo de evento. */
  title?: string;
  /** El nombre del TIPO de evento («Llamada de auditoría»). Es el que pega el dueño si escribe el nombre. */
  eventTitle?: string;
  startTime?: string;
  endTime?: string;
  attendees?: CalcomAsistente[];
  organizer?: { name?: string; email?: string; timeZone?: string };
  /** El tipo de evento: id numérico y slug. Los dos sirven para clasificar. */
  eventTypeId?: number | string;
  eventTypeSlug?: string;
  type?: string;
  /** Motivo de cancelación, cuando el trigger es CANCELLED/REJECTED. */
  cancellationReason?: string | null;
  /**
   * Respuestas del formulario de reserva. La forma cambió entre versiones:
   *  - hoy cada campo llega como `{ label, value, isHidden }` (el `label` es el que escribió
   *    el dueño del calendario, o una CLAVE de traducción en los campos de sistema:
   *    «additional_notes»);
   *  - `responses` trae TODOS los campos y `userFieldsResponses` sólo los que agregó el dueño;
   *  - con el event type borrado, el `label` es el nombre del campo;
   *  - en versiones viejas el valor llega pelado, sin el sobre.
   * El valor puede ser texto, número, booleano, lista (un multiselect) u objeto (`{ value,
   * optionValue }` en la ubicación, `{ firstName, lastName }` en el nombre partido).
   */
  responses?: Record<string, unknown>;
  userFieldsResponses?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CalcomWebhookPayload = {
  triggerEvent?: string;
  createdAt?: string;
  payload?: CalcomReservaPayload;
};

/**
 * Los datos de la reserva, en la MISMA forma que el resto del sistema ya sabe
 * tratar. Es la pieza que evita duplicar la lógica de negocio: el webhook de
 * Cal.com normaliza acá y de ahí en adelante el camino es el que ya existe.
 */
export type ReservaNormalizada = {
  /** Identificador de la reserva. Es la llave de idempotencia. */
  uid: string;
  email: string | null;
  nombre: string | null;
  telefono: string | null;
  /** ISO del inicio. La zona la resuelve quien persiste, no este módulo. */
  inicio: string | null;
  fin: string | null;
  /** Qué reunión es, para clasificarla contra la config del workspace. */
  eventType: { id: string | null; slug: string | null; nombre: string | null };
  cancelacion: string | null;
  /**
   * Lo que la persona completó en el formulario, en el orden del formulario y con el rótulo
   * que trae Cal.com. NO trae lo que ya es un campo de arriba (nombre, email, teléfono) ni la
   * ubicación de la reunión, ni lo que quedó vacío. Hasta el 08/10/2026 esto se tiraba: el aviso
   * «Nuevo agendado» salía sin el teléfono y sin la «experiencia en el rubro» que Código
   * Inmobiliario (ws13) pidió ver, y que su equipo terminaba pidiéndole a MaKo por audio.
   */
  respuestas: RespuestaReserva[];
};

/** Una respuesta del formulario de reserva: la `clave` es el nombre del campo en Cal.com. */
export type RespuestaReserva = { clave: string; rotulo: string; valor: string };

const txt = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
  return s ? s : null;
};

/**
 * Los campos del formulario que NO son una respuesta: son un campo de la reserva (nombre,
 * email, los dos teléfonos de sistema) o la ubicación de la reunión, que es un link de Meet y
 * no algo que la persona contestó. Se nombran en positivo: un campo nuevo que agregue el dueño
 * del calendario entra como respuesta sin que nadie lo tenga que sumar acá.
 */
const CAMPOS_DE_LA_RESERVA = new Set(['name', 'email', 'attendeePhoneNumber', 'smsReminderNumber', 'location']);

/**
 * Los campos de SISTEMA llegan con una clave de traducción en vez de un rótulo (medido en el
 * código de Cal.com: `defaultLabel`). Guardada así, la ficha diría «additional_notes».
 */
const ROTULO_DE_SISTEMA: Record<string, string> = {
  what_is_this_meeting_about: 'Tema',
  additional_notes: 'Notas',
  additional_guests: 'Invitados',
  reason_for_reschedule: 'Motivo del cambio',
  reschedule_reason: 'Motivo del cambio',
};

/**
 * Topes de lo que se GUARDA (el aviso tiene los suyos, más cortos: `TOPE_AVISO`). Corre antes de
 * la firma —el webhook normaliza para saber contra qué key validar—, así que un payload sin firmar
 * de 20 MB no puede volverse una lista de 20 MB en memoria.
 */
const TOPE_RESPUESTAS = { cuantas: 30, rotulo: 200, valor: 500 } as const;

// `recortar` (cortar sin dejar medio emoji, y por qué importa para el jsonb) vive en lib/respuestas-agenda.ts.

/** El valor de un campo como UNA línea de texto, o null si quedó vacío. */
function textoDeValor(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v.replace(/\s+/g, ' ').trim() || null;
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : null;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v)) {
    const partes = v.map(textoDeValor).filter((s): s is string => !!s);
    return partes.length ? partes.join(', ') : null;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    // El nombre partido en dos campos (variante «firstAndLastName»).
    if ('firstName' in o || 'lastName' in o) return textoDeValor([o.firstName, o.lastName].filter((x) => typeof x === 'string').join(' '));
    // La forma `{ value, optionValue }` de un radio con opción «Otro».
    if ('value' in o) return textoDeValor(o.value);
  }
  return null;
}

/** Saca el rótulo y el valor de un campo, venga con el sobre `{ label, value }` o pelado. */
function entradaDe(crudo: unknown): { rotulo: string | null; valor: unknown; oculta: boolean } {
  if (crudo && typeof crudo === 'object' && !Array.isArray(crudo)) {
    const o = crudo as Record<string, unknown>;
    if ('label' in o || 'isHidden' in o || 'value' in o) {
      return { rotulo: typeof o.label === 'string' ? o.label : null, valor: o.value, oculta: o.isHidden === true };
    }
  }
  return { rotulo: null, valor: crudo, oculta: false };
}

/** El rótulo para mostrar: el del dueño tal cual, y si no hay, el de sistema o el nombre del campo en palabras. */
function rotuloDe(clave: string, rotulo: string | null): string {
  const r = (rotulo ?? '').replace(/\s+/g, ' ').trim();
  if (ROTULO_DE_SISTEMA[r]) return ROTULO_DE_SISTEMA[r];
  // Sin rótulo, con el nombre del campo como rótulo (event type borrado) o con una clave de
  // traducción que no conocemos: se pasa a palabras. «-Hace-cu-nto-que…» queda legible igual.
  const esClave = !r || r === clave || /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(r);
  const base = esClave ? (r || clave).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim() : r;
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Respuesta';
}

/**
 * Las respuestas del formulario. `yaSonCampo` son el nombre, el email y el teléfono ya
 * resueltos: un campo PROPIO del dueño que repite uno de esos (un «WhatsApp» además del
 * teléfono de sistema, de donde `telefonoDe` sacó el número) no se repite como respuesta.
 *
 * Se compara por la HUELLA (sin mayúsculas, espacios, guiones, puntos ni paréntesis): el mismo
 * número tipeado «+54 9 11 2222-3333» en el campo propio y guardado «+5491122223333» en el de
 * sistema es el mismo dato, y comparado tal cual salía dos veces en el aviso.
 */
function respuestasDe(p: CalcomReservaPayload, yaSonCampo: Array<string | null>): RespuestaReserva[] {
  const huella = (s: string) => s.toLowerCase().replace(/[\s().-]+/g, '');
  const repetidos = new Set(yaSonCampo.filter((x): x is string => !!x).map(huella).filter(Boolean));
  const out: RespuestaReserva[] = [];
  const vistas = new Set<string>();
  // `responses` primero: trae TODOS los campos en el orden del formulario. `userFieldsResponses`
  // completa lo que una versión vieja mande sólo ahí.
  for (const fuente of [p.responses, p.userFieldsResponses]) {
    if (!fuente || typeof fuente !== 'object' || Array.isArray(fuente)) continue;
    for (const [clave, crudo] of Object.entries(fuente)) {
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      if (CAMPOS_DE_LA_RESERVA.has(clave)) continue;
      const e = entradaDe(crudo);
      // Un campo OCULTO no lo completó la persona: lo llena la URL de reserva.
      if (e.oculta) continue;
      const valor = textoDeValor(e.valor);
      if (!valor) continue; // las notas vacías, los invitados que no hay
      if (repetidos.has(huella(valor))) continue;
      out.push({ clave, rotulo: recortar(rotuloDe(clave, e.rotulo), TOPE_RESPUESTAS.rotulo), valor: recortar(valor, TOPE_RESPUESTAS.valor) });
      if (out.length >= TOPE_RESPUESTAS.cuantas) return out;
    }
  }
  return out;
}

/**
 * Saca el teléfono, que viaja en tres lugares distintos según la versión del
 * embed y de si el event type lo pide como campo propio.
 *
 * Falla a null sin ruido: un teléfono que no está NO es un error — muchos event
 * types no lo piden. Lo que sí sería un error es inventarlo.
 */
function telefonoDe(p: CalcomReservaPayload, a: CalcomAsistente): string | null {
  const enRespuestas = (r: Record<string, unknown> | undefined): string | null => {
    if (!r) return null;
    for (const [k, v] of Object.entries(r)) {
      if (!/phone|tel|whats|celular|m[oó]vil/i.test(k)) continue;
      // Puede venir plano o como `{ value: '...' }` según la versión.
      const val = v && typeof v === 'object' && 'value' in (v as Record<string, unknown>)
        ? (v as Record<string, unknown>).value
        : v;
      const s = txt(val);
      if (s) return s;
    }
    return null;
  };
  return txt(a.phoneNumber) ?? enRespuestas(p.responses) ?? enRespuestas(p.userFieldsResponses);
}

/**
 * Normaliza el payload de una reserva.
 *
 * ⚠️ EL ASISTENTE ES `attendees[0]`, NO EL ORGANIZADOR. El organizador es el dueño
 * del calendario —o sea el CLIENTE de MaKo—, así que confundirlos crea un lead con
 * los datos del propio negocio en vez de los de quien reservó. En Calendly no hay
 * forma de equivocarse porque el invitado ES el payload; acá hay dos personas en el
 * mismo objeto.
 */
export function normalizarReserva(p: CalcomReservaPayload | undefined): ReservaNormalizada | null {
  if (!p) return null;
  const a = (p.attendees ?? [])[0] ?? {};
  const uid = txt(p.uid) ?? txt(p.bookingId);
  if (!uid) return null; // sin identificador no hay idempotencia posible
  const email = txt(a.email)?.toLowerCase() ?? null;
  const nombre = txt(a.name);
  const telefono = telefonoDe(p, a);
  return {
    uid,
    email,
    nombre,
    telefono,
    inicio: txt(p.startTime),
    fin: txt(p.endTime),
    eventType: {
      id: txt(p.eventTypeId),
      slug: txt(p.eventTypeSlug) ?? txt(p.type),
      // ⚠️ `eventTitle` y no `title` (16/10/2026): `title` es el de la RESERVA, con los nombres de las dos personas
      // («Strategy Session between Organizer and Guest», el ejemplo de la doc de webhooks de Cal.com), así que un
      // tipo de evento cargado por su NOMBRE —lo que la ayuda de Integraciones ofrece— no calzaba nunca: ni la R1/R2
      // ni el ruteo, y la reserva se perdía «sin workspace». `title` queda de respaldo para un payload sin el campo.
      nombre: txt(p.eventTitle) ?? txt(p.title),
    },
    cancelacion: txt(p.cancellationReason),
    respuestas: respuestasDe(p, [nombre, email, telefono]),
  };
}

/**
 * Las respuestas en la forma de las de Calendly (`{ question, answer }`), para guardarlas con
 * la MISMA función (`saveLeadRespuestas`, lib/leads.ts): dos maneras de escribir `lead_respuestas`
 * serían dos fichas que leen distinto la misma tabla.
 */
export function preguntasDeReserva(respuestas: RespuestaReserva[]): Array<{ question: string; answer: string }> {
  return respuestas.map((r) => ({ question: r.rotulo, answer: r.valor }));
}

// ─────────────────────────────────────────────────────────────────────────────
// El aviso «Nuevo agendado»
// ─────────────────────────────────────────────────────────────────────────────

// Los topes del aviso (`TOPE_AVISO`), el rótulo corto (`rotuloCorto`) y el corte del valor viven en
// lib/respuestas-agenda.ts desde el 11/10/2026: el dato `{{lead_respuestas_agenda}}` arma los MISMOS renglones.

/**
 * Lo que va DESPUÉS de la línea de la reunión: el contacto en un renglón y un renglón por
 * respuesta (`renglonesDeRespuestas`). Vacío si no hay nada que decir (una reserva sin teléfono, sin
 * email y sin formulario deja el aviso como era).
 */
export function detalleDelAviso(d: { telefono: string | null; email: string | null; respuestas: RespuestaReserva[] }): string[] {
  const lineas: string[] = [];
  const contacto = [d.telefono ? `📱 ${d.telefono}` : null, d.email ? `✉️ ${d.email}` : null].filter((x): x is string => !!x);
  if (contacto.length) lineas.push(contacto.join(' · '));
  lineas.push(...renglonesDeRespuestas(d.respuestas));
  return lineas;
}

/**
 * El texto del aviso «Nuevo agendado» de Cal.com, para la R1 y la R2. Es UNA función para las dos
 * porque son dos emisores del mismo aviso: con el texto armado en cada uno, el teléfono llegaba a
 * uno y al otro no. El link al resumen va siempre al final, y la firma después.
 */
export function textoNuevoAgendado(d: {
  nombre: string;
  reunion: 'R1' | 'R2';
  /** La fecha y hora ya escritas en la zona del negocio («martes 13 a las 10:15»). */
  cuando: string;
  link: string;
  telefono: string | null;
  email: string | null;
  respuestas: RespuestaReserva[];
}): string {
  const detalle = detalleDelAviso(d);
  return `🎯 *Nuevo agendado*: ${d.nombre} reservó una *${d.reunion} para el ${d.cuando}*.`
    + (detalle.length ? `\n${detalle.join('\n')}` : '')
    + `\n\n👉 Mira el resumen del lead:\n${d.link}\n\n— MaKo`;
}

/**
 * ¿Es J1 o J2? Se reusa `mismoEventType` de Calendly A PROPÓSITO.
 *
 * No es pereza: si cada proveedor comparara distinto, la misma reunión podría
 * clasificarse como R1 por un lado y R2 por el otro, y el CRM movería la etapa a
 * un lugar y el recordatorio hablaría del otro. Una pregunta, una respuesta.
 *
 * Se prueban los TRES identificadores porque el dueño pega el que tiene a mano:
 * el id numérico, el slug de la URL de reserva, o el nombre visible.
 */
export function clasificarJuntaCalcom(
  et: ReservaNormalizada['eventType'] | undefined,
  cfg: { j1?: string | null; j2?: string | null },
): TipoJunta {
  const candidatos = [et?.id, et?.slug, et?.nombre].filter((c): c is string => !!c && c.trim() !== '');
  if (candidatos.length === 0) return 'desconocido';
  if (cfg.j2 && candidatos.some((c) => mismoEventType(c, cfg.j2!))) return 'j2';
  if (cfg.j1 && candidatos.some((c) => mismoEventType(c, cfg.j1!))) return 'j1';
  return 'desconocido';
}

/** Qué significa cada trigger para el CRM. Lo que no está acá se ignora. */
export function accionDeTrigger(trigger: string | undefined): 'agenda' | 'cancela' | 'termina' | null {
  switch ((trigger ?? '').toUpperCase()) {
    case 'BOOKING_CREATED':
    case 'BOOKING_RESCHEDULED':
      return 'agenda';
    case 'BOOKING_CANCELLED':
    case 'BOOKING_REJECTED':
      return 'cancela';
    case 'MEETING_ENDED':
      return 'termina';
    default:
      return null;
  }
}

/**
 * La zona horaria que el cliente eligió en Cal.com. null si no está conectado.
 *
 * ⚠️ ES EL DATO QUE ARREGLA EL CASO REAL. El ws13 (Argentina) agendó una reunión
 * preseteada en horario de México, y no porque el dato no existiera: `GET /me`
 * contesta `timeZone: "America/Buenos_Aires"` con la key que ya tenía cargada.
 * Se defaulteaba a `America/Tijuana` teniendo la respuesta a una llamada.
 *
 * Va acá y no en `lib/timezone.ts` para no meterle a ese módulo una dependencia
 * de cada proveedor: allá se ORQUESTA, acá se sabe hablar con Cal.com.
 */
export async function tzDeCalcom(apiKey: string): Promise<string | null> {
  try {
    const r = await fetch(`${CALCOM_API.base}/me`, {
      headers: calcomHeaders(apiKey),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    const b = (await r.json()) as { data?: { timeZone?: string }; timeZone?: string };
    const tz = b?.data?.timeZone ?? b?.timeZone;
    return typeof tz === 'string' && tz.includes('/') ? tz : null;
  } catch {
    return null;
  }
}

/**
 * EL LINK PÚBLICO DE RESERVA de un tipo de evento de Cal.com (14/10/2026: «Agendar llamada» del Calendario).
 *
 * `eventType` es lo que el negocio cargó en `CALCOM_EVENT_TYPE_J1`/`_J2`: casi siempre el SLUG de su URL de reserva
 * («llamada-de-auditoria»); a veces la URL entera. `me` es la respuesta de `GET /v2/me` (`{ data: { username } }`).
 *
 * ⚠️ NO MEDIDO contra una cuenta real (14/10/2026): la forma `https://cal.com/<usuario>/<slug>` es la pública de
 *    Cal.com para una cuenta personal. Por eso lo que no se puede armar SIN ADIVINAR devuelve null: un id numérico o un
 *    nombre visible (no son un slug), y una cuenta de ORGANIZACIÓN (su URL vive en el dominio de la organización). Un
 *    link inventado manda a reservar a una página que no existe; null le dice a la pantalla que lo diga.
 */
export function linkDeReservaCalcom(eventType: string | null | undefined, me: unknown): string | null {
  const et = (eventType ?? '').trim();
  if (!et) return null;
  if (/^https:\/\//i.test(et)) {
    try { return new URL(et).toString(); } catch { return null; }
  }
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(et) || /^\d+$/.test(et)) return null;
  const raiz = me && typeof me === 'object' ? (me as { data?: unknown }).data ?? me : null;
  const d = raiz && typeof raiz === 'object' ? (raiz as { username?: unknown; organizationId?: unknown }) : null;
  const usuario = typeof d?.username === 'string' ? d.username.trim() : '';
  if (!/^[a-z0-9._-]+$/i.test(usuario)) return null;
  if (d?.organizationId != null) return null;
  return `https://cal.com/${usuario}/${et}`;
}

/** `GET /v2/me` de Cal.com (el usuario de la API key), o null si no contesta. Lo lee `linkDeAgenda` (lib/agenda-link.ts). */
export async function perfilDeCalcom(apiKey: string): Promise<unknown> {
  try {
    const r = await fetch(`${CALCOM_API.base}/me`, { headers: calcomHeaders(apiKey), cache: 'no-store', signal: AbortSignal.timeout(5000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// ── Los TIPOS DE EVENTO de la cuenta (16/10/2026: vincular un evento a una etapa del CRM) ──────────

/** Un tipo de evento de Cal.com. `id` es el que llega en el webhook (`eventTypeId`): el que se vincula. */
export type EventTypeCalcom = { id: string; slug: string | null; nombre: string; duracionMin: number | null };

/**
 * `GET /v2/event-types` VERSIONA APARTE: con `cal-api-version: 2024-06-14` contesta
 * `{ data: [ { id, title, slug, lengthInMinutes } ] }`; sin esa versión cae a la vieja, agrupada:
 * `{ data: { eventTypeGroups: [ { eventTypes: [ { id, title, slug, length } ] } ] } }`. Se leen las
 * dos (la de `CALCOM_API.version`, 2024-08-13, es la de las reservas, no la de esto).
 *
 * ⚠️ NO MEDIDO contra una cuenta real (16/10/2026): la forma sale de la referencia pública de la v2.
 * Por eso lo que no trae un id no entra: sin el id no hay con qué rutear la reserva.
 */
export const VERSION_EVENT_TYPES_CALCOM = '2024-06-14';

export function eventTypesDeRespuestaCalcom(body: unknown): EventTypeCalcom[] {
  const raiz = body && typeof body === 'object' ? (body as { data?: unknown }).data ?? body : null;
  let crudos: unknown[] = [];
  if (Array.isArray(raiz)) crudos = raiz;
  else if (raiz && typeof raiz === 'object') {
    const grupos = (raiz as { eventTypeGroups?: unknown }).eventTypeGroups;
    if (Array.isArray(grupos)) {
      crudos = grupos.flatMap((g) => (g && typeof g === 'object' && Array.isArray((g as { eventTypes?: unknown }).eventTypes)
        ? (g as { eventTypes: unknown[] }).eventTypes : []));
    }
  }
  const out: EventTypeCalcom[] = [];
  for (const c of crudos) {
    if (!c || typeof c !== 'object') continue;
    const e = c as { id?: unknown; slug?: unknown; title?: unknown; lengthInMinutes?: unknown; length?: unknown };
    const id = txt(e.id);
    if (!id || out.some((x) => x.id === id)) continue;
    const largo = typeof e.lengthInMinutes === 'number' ? e.lengthInMinutes : typeof e.length === 'number' ? e.length : null;
    out.push({ id, slug: txt(e.slug), nombre: txt(e.title) ?? txt(e.slug) ?? id, duracionMin: largo != null && Number.isFinite(largo) ? largo : null });
  }
  return out;
}

/** Los tipos de evento de la cuenta de esa API key. Tira con el código de Cal.com si no contesta bien. */
export async function listarEventTypesCalcom(apiKey: string): Promise<EventTypeCalcom[]> {
  const r = await fetch(`${CALCOM_API.base}/event-types`, {
    headers: { ...calcomHeaders(apiKey), 'cal-api-version': VERSION_EVENT_TYPES_CALCOM },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  const body = await r.json().catch(() => null);
  if (r.status === 401 || r.status === 403) throw new Error('Cal.com no aceptó la API key: cópiala de nuevo en Integraciones.');
  if (!r.ok) throw new Error(`Cal.com respondió ${r.status}.`);
  // Un 200 con el error adentro (AGENTS.md: «res.ok no es salió bien»).
  if (body && typeof body === 'object' && (body as { status?: unknown }).status === 'error') throw new Error('Cal.com devolvió un error al listar los eventos.');
  return eventTypesDeRespuestaCalcom(body);
}

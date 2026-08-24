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
      'El webhook está dado de alta SIN secreto en Cal.com. Editalo y pegá el mismo valor que guardaste en MaKo.',
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
  title?: string;
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
  /** Respuestas del formulario de reserva. La forma cambió entre versiones. */
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
};

const txt = (v: unknown): string | null => {
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
  return s ? s : null;
};

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
  return {
    uid,
    email: txt(a.email)?.toLowerCase() ?? null,
    nombre: txt(a.name),
    telefono: telefonoDe(p, a),
    inicio: txt(p.startTime),
    fin: txt(p.endTime),
    eventType: {
      id: txt(p.eventTypeId),
      slug: txt(p.eventTypeSlug) ?? txt(p.type),
      nombre: txt(p.title),
    },
    cancelacion: txt(p.cancellationReason),
  };
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

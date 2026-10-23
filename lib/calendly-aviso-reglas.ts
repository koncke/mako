// =============================================================================
// calendly-aviso-reglas — ¿le llegan a MaKo las reservas NUEVAS de esta cuenta de Calendly? (23/10/2026)
// =============================================================================
// Puro: lo usan lib/calendly-aviso.ts, scripts/arreglar-webhook-calendly.ts y tests/calendly-aviso.test.ts.
//
// «Conectado» en /integraciones era tener el token y el tipo de evento de R1: con eso MaKo LEE la agenda y sabe a qué
// negocio va una reserva (el ruteo), pero la reserva nueva sólo entra si la cuenta tiene un AVISO (una suscripción de
// webhook) que apunte a MaKo. Calendly no tiene pantalla para crearlo (se crea por API, en planes pagos), así que se
// podía guardar todo, ver verde, y que ninguna reserva llegara nunca. Medido el 23/10/2026 con la agenda de MaKo: el
// ws 9 no tenía ni ruteo ni aviso, y el lanzamiento del 25/10 entero vende por esa agenda
// (docs/hallazgos-integraciones.md, «La agenda de MaKo NO entra al CRM de MaKo»).
// =============================================================================

import { DOMINIOS_DE_MAKO } from './editor-landing/dominios-reglas';

/**
 * activo = hay un aviso a MaKo que Calendly entrega · fallando = Calendly lo tiene activo pero ya no logra entregar
 * (reintenta) · incompleto = activo pero no avisa de reservas nuevas · apagado = lo hay y Calendly lo deshabilitó ·
 * sin-aviso = no lo hay.
 */
export type EstadoAvisoCalendly = 'activo' | 'fallando' | 'incompleto' | 'apagado' | 'sin-aviso';

/** Una suscripción de webhook como la devuelve `GET /webhook_subscriptions` (sólo lo que se mira). */
export type SuscripcionCalendly = {
  callback_url?: string | null;
  state?: string | null;
  /** Desde cuándo Calendly reintenta una entrega que falla; null = sana. */
  retry_started_at?: string | null;
  events?: readonly string[] | null;
};

/** El camino del webhook de MaKo (app/api/webhooks/calendly/route.ts). */
export const CAMINO_WEBHOOK_CALENDLY = '/api/webhooks/calendly';

/**
 * ¿Esta dirección es el webhook de MaKo? Camino Y dominio, los dos: el camino solo lo tiene cualquier app hecha con Next
 * (otro CRM, un túnel de pruebas, localhost), y el aviso de otro sitio pintaba verde sin que entrara una reserva. El
 * dominio es cualquiera de los de MaKo (`DOMINIOS_DE_MAKO`, con sus subdominios), no sólo el de hoy: el proxy exime a
 * /api/webhooks del 410 de la mudanza (proxy.ts, `EXENTAS_DE_HOST`), así que un aviso creado con el dominio de antes
 * puede seguir entregando, y marcarlo «sin aviso» sería una alarma falsa. Sólo https y sin puerto.
 */
export function esWebhookDeMako(url: string | null | undefined): boolean {
  try {
    const u = new URL(String(url ?? ''));
    if (u.protocol !== 'https:' || u.port !== '' || u.pathname.replace(/\/+$/, '') !== CAMINO_WEBHOOK_CALENDLY) return false;
    return DOMINIOS_DE_MAKO.some((d) => u.hostname === d || u.hostname.endsWith('.' + d));
  } catch {
    return false;
  }
}

/**
 * De las suscripciones de la cuenta, las que apuntan al webhook de MaKo, y en qué estado. Calendly deshabilita una
 * suscripción tras días de entregas fallidas y no deja reactivarla (scripts/arreglar-webhook-calendly.ts). «activo» pide
 * las tres cosas: `state: active`, sin reintentos en curso, y que avise de `invitee.created` (sin eso entrega las
 * cancelaciones y ninguna reserva nueva).
 */
export function estadoDelAviso(subs: readonly SuscripcionCalendly[]): EstadoAvisoCalendly {
  const nuestras = subs.filter((s) => esWebhookDeMako(s.callback_url));
  if (!nuestras.length) return 'sin-aviso';
  const vivas = nuestras.filter((s) => s.state === 'active');
  if (vivas.some((s) => !s.retry_started_at && s.events?.includes('invitee.created'))) return 'activo';
  if (vivas.some((s) => s.retry_started_at)) return 'fallando';
  if (vivas.length) return 'incompleto';
  return 'apagado';
}

/**
 * El veredicto de las DOS lecturas de la pantalla: las suscripciones de la organización (las que crea el script) y las del
 * usuario. null = no afirmar nada. ⚠️ Si Calendly niega el permiso de la organización ('sin-permiso': el usuario no la
 * administra), «no vi ningún aviso» NO es «no hay»: el de la organización es justo el que no se puede ver. Entonces sólo
 * «activo» (visto, sano) es un veredicto; lo demás (sin-aviso, apagado…) se calla. Antes decía «sin-aviso» y pintaba de
 * ámbar a quien tenía el aviso (revisión adversarial, 23/10/2026).
 */
export function estadoDeLasLecturas(l: {
  org: readonly SuscripcionCalendly[] | 'sin-permiso' | null;
  user: readonly SuscripcionCalendly[] | null;
}): EstadoAvisoCalendly | null {
  if (l.org == null || l.user == null) return null;
  const e = estadoDelAviso([...(l.org === 'sin-permiso' ? [] : l.org), ...l.user]);
  return l.org === 'sin-permiso' && e !== 'activo' ? null : e;
}

/** Lo que dice la pantalla cuando el aviso no anda (null = anda, o no se pudo leer: «no pude leer» no es «no está»). */
export function motivoDelAviso(e: EstadoAvisoCalendly | null): { chip: string; motivo: string } | null {
  if (e === 'sin-aviso') return { chip: 'Falta el aviso', motivo: 'Lee tu agenda, pero las reservas nuevas no entran: falta el aviso' };
  if (e === 'apagado') return { chip: 'Aviso apagado', motivo: 'Calendly apagó el aviso: las reservas nuevas no entran' };
  if (e === 'fallando') return { chip: 'Aviso con fallas', motivo: 'Calendly no logra entregar las reservas nuevas a MaKo: el aviso está reintentando' };
  if (e === 'incompleto') return { chip: 'Aviso incompleto', motivo: 'El aviso no incluye las reservas nuevas (invitee.created): no entran' };
  return null;
}

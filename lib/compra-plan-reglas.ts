// =============================================================================
// compra-plan-reglas — lo que decide el checkout público de /planes (puro, con test)
// =============================================================================
// El servidor vive en lib/compra-plan.ts. Acá: qué se acepta del pedido (nada de precio ni de capa), cómo se limpia el
// ORIGEN que manda la landing y el código de MaKo Partners, y qué pasarela se usa.
// =============================================================================

import type { Pasarela } from './cobros-tipos';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CODIGO_REF_RE = /^[a-z0-9-]{3,32}$/;

/**
 * De dónde vino quien compra. Lo manda la landing de MaKo («Landings de MaKo en Web Generator»): `landing` es el slug,
 * `avatar` a quién le habla y `funcionalidad` lo que vino a buscar (lo lee el onboarding). Más la campaña del anuncio.
 * Todo opcional, todo texto corto: es un dato que se MUESTRA y se usa para elegir una pantalla, nunca para cobrar.
 */
export type OrigenCompra = Partial<Record<(typeof CLAVES_ORIGEN)[number], string>>;

export const CLAVES_ORIGEN = ['landing', 'avatar', 'funcionalidad', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'] as const;
const TOPE_ORIGEN: Record<(typeof CLAVES_ORIGEN)[number], number> = {
  landing: 64, avatar: 40, funcionalidad: 40, utm_source: 100, utm_medium: 100, utm_campaign: 150, utm_content: 150, fbclid: 250,
};
/** Lo que puede venir en `landing`, `avatar` y `funcionalidad`: un slug. La campaña es texto libre (sin control). */
const SLUG_RE = /^[a-z0-9][a-z0-9-_]*$/;

/** El origen limpio, o null si no trae nada que valga. Las claves que no son de la lista se tiran. */
export function origenLimpio(v: unknown): OrigenCompra | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const out: OrigenCompra = {};
  for (const k of CLAVES_ORIGEN) {
    const crudo = typeof o[k] === 'string' ? (o[k] as string).trim() : '';
    if (!crudo) continue;
    // Sin caracteres de control (un salto de línea en un dato que después se escribe en un mail o en un log).
    // eslint-disable-next-line no-control-regex
    const s = crudo.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, TOPE_ORIGEN[k]);
    if (!s) continue;
    if ((k === 'landing' || k === 'avatar' || k === 'funcionalidad')) {
      const slug = s.toLowerCase();
      if (!SLUG_RE.test(slug)) continue;
      out[k] = slug;
    } else out[k] = s;
  }
  return Object.keys(out).length ? out : null;
}

/** El código de MaKo Partners del pedido (o de la cookie), en minúscula. null si no es uno. */
export function codigoRefLimpio(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return CODIGO_REF_RE.test(s) ? s : null;
}

export type PedidoCompra = { plan: string; nombre: string; email: string; pasarela: Pasarela | null; origen: OrigenCompra | null; ref: string | null };

/**
 * El pedido del formulario, validado. Lo que NUNCA sale de acá: el precio, la moneda y la capa (los pone el plan). El
 * campo trampa (`web`) lleno es un bot: se contesta como si nada (quien llama no crea nada).
 */
export function leerPedidoCompra(body: unknown): { ok: true; pedido: PedidoCompra } | { ok: false; error: string; bot?: true } {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  if (typeof b.web === 'string' && b.web.trim()) return { ok: false, error: 'bot', bot: true };
  const plan = typeof b.plan === 'string' ? b.plan.trim() : '';
  if (!/^[a-z0-9-]{1,32}$/.test(plan)) return { ok: false, error: 'Ese plan no existe.' };
  const nombre = (typeof b.nombre === 'string' ? b.nombre : '').replace(/\s+/g, ' ').trim().slice(0, 120);
  if (nombre.length < 2) return { ok: false, error: 'Escribe tu nombre.' };
  const email = (typeof b.email === 'string' ? b.email : '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return { ok: false, error: 'Escribe un email válido: por ahí te llega el acceso.' };
  const pasarela = b.pasarela === 'stripe' || b.pasarela === 'mercadopago' ? b.pasarela : null;
  return { ok: true, pedido: { plan, nombre, email, pasarela, origen: origenLimpio(b.origen), ref: codigoRefLimpio(b.ref) } };
}

/**
 * Con qué pasarela se cobra: la que eligió (si está conectada y el plan tiene precio en su moneda), o la única que sirve.
 * Con dos que sirven y ninguna elegida, se pregunta (null + `elegir`).
 */
export function pasarelaDeLaCompra(p: {
  pedida: Pasarela | null;
  sirven: readonly Pasarela[];
}): { ok: true; pasarela: Pasarela } | { ok: false; motivo: 'sin-pasarela' | 'elegir' | 'no-sirve' } {
  if (!p.sirven.length) return { ok: false, motivo: 'sin-pasarela' };
  if (p.pedida) return p.sirven.includes(p.pedida) ? { ok: true, pasarela: p.pedida } : { ok: false, motivo: 'no-sirve' };
  return p.sirven.length === 1 ? { ok: true, pasarela: p.sirven[0] } : { ok: false, motivo: 'elegir' };
}

// =============================================================================
// SIN PASARELA (23/10/2026): lo que no se puede cobrar no se muestra como si se pudiera
// =============================================================================
// Hasta que Martín conecte la pasarela de MaKo (/integraciones?ws=9), ningún plan se puede pagar en línea. /planes
// prometía «entras en el acto» con un botón «Empezar», y el paso siguiente decía «Escríbenos» sin dar a dónde: un
// callejón. La salida es la de las landings de MaKo, la agenda (app/vsl/Landing.tsx la usa también): una llamada y
// el alta a mano. Se decide POR PLAN y con la misma cuenta que el checkout (lib/compra-plan.ts, `ofertasDeLosPlanes`):
// un plan sin precio en la moneda de la pasarela tampoco se cobra.

/** La agenda de MaKo: una llamada con Martín. La misma de las landings. */
export const AGENDA_MAKO = 'https://calendly.com/koncke/asesoria';

export const TEXTO_SIN_PASARELA = 'Todavía no cobramos en línea. Agenda una llamada y te damos de alta.';

/** Las UTM que la agenda le pasa al CRM (el webhook de Calendly las lee de `payload.tracking`). `utm_term` no: lleva el
 *  id anónimo de la landing, y desde /planes no se tiene. */
const UTM_DE_LA_AGENDA = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;

/** Las UTM con las que viaja el código de MaKo Partners a la agenda: `utm_campaign` lleva el código. */
export const UTM_PARTNER = { utm_source: 'mako-partners', utm_medium: 'referido' } as const;

/**
 * La agenda con el origen de la campaña, para que la venta a mano no pierda de qué anuncio vino.
 *
 * EL CÓDIGO DE PARTNER (23/10/2026): la cookie `mako_ref` es httpOnly de MaKo y Calendly no la ve, así que una venta por
 * llamada perdía al partner del todo (docs/hallazgos-partners.md). Sin campaña (el link /r/<código> llega SIEMPRE sin
 * UTM: arma /planes de cero), el código viaja como UTM y queda en la reserva de Calendly y, con la agenda atada al ws 9,
 * en el lead. Con campaña, gana la campaña: no se pisa de qué anuncio vino.
 */
export function agendaConOrigen(origen: OrigenCompra | null, ref: string | null = null): string {
  const qs = new URLSearchParams();
  for (const k of UTM_DE_LA_AGENDA) {
    const v = origen?.[k];
    if (v) qs.set(k, v);
  }
  if (ref && !qs.has('utm_source')) {
    qs.set('utm_source', UTM_PARTNER.utm_source);
    qs.set('utm_medium', UTM_PARTNER.utm_medium);
    qs.set('utm_campaign', ref);
  }
  const s = qs.toString();
  return s ? `${AGENDA_MAKO}?${s}` : AGENDA_MAKO;
}

/** El botón de un plan en /planes: comprar si se puede cobrar, si no la agenda. Nunca «Empezar» sin cobro detrás. */
export function botonDelPlan(p: { id: string; nombre: string; cobrable: boolean; sufijo: string; origen: OrigenCompra | null; ref: string | null }): { href: string; texto: string; afuera: boolean } {
  return p.cobrable
    ? { href: `/planes/${p.id}${p.sufijo}`, texto: `Empezar con ${p.nombre}`, afuera: false }
    : { href: agendaConOrigen(p.origen, p.ref), texto: 'Agendar una llamada', afuera: true };
}

/** La bajada de /planes: «entras en el acto» sólo si algún plan se puede pagar en línea. */
export function bajadaDePlanes(algunoCobrable: boolean): string {
  return algunoCobrable
    ? 'Pagas por mes y entras en el acto. Te das de baja cuando quieras.'
    : 'Agenda una llamada y te damos de alta. Te das de baja cuando quieras.';
}

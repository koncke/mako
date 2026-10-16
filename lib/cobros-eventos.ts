// =============================================================================
// cobros-eventos — qué dice un aviso de Stripe o de Mercado Pago (puro)
// =============================================================================
// Puro y SIN `server-only`: lo ejecuta tests/cobros-eventos.test.ts sobre cuerpos como los de la
// documentación de cada webhook. Acá se decide QUÉ COBRO buscar y QUÉ ACCIÓN corresponde; quien
// relee al proveedor, busca el cobro y lo aplica es lib/cobros-webhook.ts, y quien recibe el pedido,
// las dos rutas (app/api/webhooks/stripe y app/api/webhooks/mercadopago). El contrato está en
// docs/diseno-pasarela-pagos.md §4.5.
//
// ⚠️ NUNCA SE CONFÍA EN UN MONTO DEL CUERPO. Del aviso sale qué objeto releer y con qué identificador
// buscar el cobro; el estado y la plata salen de la RELECTURA al proveedor con la clave del negocio
// (lib/cobros-webhook.ts). Por eso nada de acá devuelve un monto del cuerpo.
//
// ⚠️ LA FORMA SE MIDIÓ EN EL WEBHOOK, NO EN LA API REST (AGENTS.md «Una integracion son TRES
// registros»). Stripe: el `Event` con `data.object` (docs.stripe.com/webhooks y
// /billing/subscriptions/webhooks; desde basil la factura trae la suscripción en
// `parent.subscription_details`, no en `subscription`). Mercado Pago: la notificación FLACA
// `{ type, action, user_id, data: { id } }` con `data.id` también en el query, y el formato IPN viejo
// `?topic=…&id=…` (mercadopago.com.ar/developers, «Notificaciones»). Los de suscripción de MP están
// escritos con la forma genérica de su doc: falta medirlos con un cuerpo real.

import { esTokenCobro } from './cobros-tipos';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : null;
/** Un campo expandible de Stripe llega como id (string) o como objeto con `id`. */
const idDe = (v: unknown): string | null => str(v) ?? str(obj(v).id);
/** Un id de objeto de Stripe (`cs_…`, `in_…`, `sub_…`, `ch_…`, `pi_…`): letras, guion bajo, tope. */
const idStripe = (v: unknown, prefijos: readonly string[]): string | null => {
  const s = idDe(v);
  return s && s.length <= 255 && /^[a-z]{2,6}_[A-Za-z0-9_]+$/.test(s) && prefijos.some((p) => s.startsWith(`${p}_`)) ? s : null;
};
const token = (v: unknown): string | null => (esTokenCobro(v) ? v : null);

/** Cómo se busca el cobro (lo mismo que pide `cobroDelAviso` de lib/cobros.ts, sin el proveedor). */
export type ClaveCobro = { token?: string | null; ref?: string | null; pagoId?: string | null; suscripcionId?: string | null };

export type AccionCobro = 'aprobado' | 'fallido' | 'reembolso' | 'reembolso_fallido' | 'disputa' | 'suscripcion_cancelada' | 'ignorar';

/**
 * En qué va un CONTRACARGO (15/10/2026). En Stripe la plata se mueve con eventos propios: SALE con
 * `charge.dispute.funds_withdrawn` y VUELVE con `charge.dispute.funds_reinstated`; abrirse y cerrarse sólo se cuentan.
 * En Mercado Pago (`mp`) sólo se cuenta: su documentación se contradice sobre qué significan `settled` y `reimbursed`
 * (una página dice que `settled` es en contra del vendedor; otra, que es la plata devuelta al comprador), y lo confiable
 * (`coverage_applied` del contracargo) no está medido.
 */
export type FaseContracargo = 'abierto' | 'plata_salio' | 'plata_volvio' | 'cerrado' | 'mp';

const FASE_DE_DISPUTA: Readonly<Record<string, FaseContracargo>> = {
  'charge.dispute.created': 'abierto',
  'charge.dispute.funds_withdrawn': 'plata_salio',
  'charge.dispute.funds_reinstated': 'plata_volvio',
  'charge.dispute.closed': 'cerrado',
};
export const faseDeDisputa = (tipo: string): FaseContracargo | null => FASE_DE_DISPUTA[tipo] ?? null;

/** Lo que queda en la fila de `pasarela_eventos` al terminar. */
export type ResultadoEvento = { estado: 'procesado' | 'ignorado'; motivo: string | null; cobroId: number | null };

/**
 * El motivo que se GUARDA (fila de `pasarela_eventos`, log): ≤300 y sin datos personales. Lo que
 * llega acá muchas veces es el mensaje de un error de la base o del proveedor, y ésos pueden traer un
 * email (un `duplicate key … (email)=(…)`), un teléfono o un pedazo de clave (Stripe contesta «Invalid
 * API Key provided: sk_live_****1234»). AGENTS.md «Una política puede RECHAZAR; no puede no dejar
 * rastro»: lo que se guarda es que pasó y por qué, no de quién.
 */
export function motivoSinDatos(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/\b(?:sk|rk|pk|whsec)_[A-Za-z0-9_*]+/g, '[clave]')
    .replace(/\b(?:APP_USR|TEST)-[A-Za-z0-9-]+/g, '[token]')
    .replace(/[^\s@()<>"',;:]+@[^\s@()<>"',;:]+\.[A-Za-z]{2,}/g, '[email]')
    .replace(/\+?\d(?:[\s.-]?\d){8,}/g, '[número]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stripe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * El `?acct=` de la URL del webhook (MaKo lo registra con el `acct_…` de la cuenta del negocio). Se
 * lee ANTES de la firma, así que va con tope de largo y alfabeto: un valor de 20 KB armaría una
 * consulta por pedido sin firmar (molde: el `c.length <= 300` de app/api/webhooks/calcom).
 */
export function acctDelWebhook(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim();
  return s && s.length <= 64 && /^[A-Za-z0-9_]+$/.test(s) ? s : null;
}

export type EventoStripe = { id: string; tipo: string; livemode: boolean | null; objeto: Json };

/** El sobre de un evento de Stripe (`{ id: 'evt_…', object: 'event', type, livemode, data: { object } }`). */
export function eventoStripe(cuerpo: unknown): EventoStripe | null {
  const b = obj(cuerpo);
  const id = str(b.id);
  const tipo = str(b.type);
  if (!id || id.length > 200 || !/^evt_[A-Za-z0-9_]+$/.test(id)) return null;
  if (!tipo || tipo.length > 120) return null;
  if (b.object != null && b.object !== 'event') return null;
  return { id, tipo, livemode: typeof b.livemode === 'boolean' ? b.livemode : null, objeto: obj(obj(b.data).object) };
}

export type ObjetoStripe = 'checkout' | 'factura' | 'suscripcion' | 'cargo' | 'reembolso' | 'disputa';

export type AvisoStripe =
  | { accion: 'ignorar'; motivo: string }
  | { accion: Exclude<AccionCobro, 'ignorar'>; leer: { objeto: ObjetoStripe; id: string }; buscar: ClaveCobro };

const ignorar = (motivo: string): { accion: 'ignorar'; motivo: string } => ({ accion: 'ignorar', motivo });

/** Las facturas que son un PAGO de la suscripción: la primera y cada renovación. */
const FACTURAS_DE_PAGO: ReadonlySet<string> = new Set(['subscription_create', 'subscription_cycle']);

/**
 * Qué objeto releer y con qué buscar el cobro, según el evento. Los identificadores salen del cuerpo
 * (firmado por Stripe); el ESTADO se confirma con la relectura (`confirmar*`, abajo).
 *
 * ⚠️ LA PRIMERA FACTURA DE UNA SUSCRIPCIÓN LLEGA DOS VECES: `checkout.session.completed` (con su
 * `invoice`) y `invoice.paid` con `billing_reason: 'subscription_create'`. Los dos caminos usan el id
 * de ESA factura como `proveedorPagoId` (`confirmarCheckout` y `confirmarFactura`): así la cuota del
 * CRM, única por (workspace, proveedor, proveedor_pago_id), no se duplica, y la segunda es una
 * reentrega y no una «renovación».
 */
export function avisoStripe(ev: EventoStripe): AvisoStripe {
  const o = ev.objeto;
  const meta = obj(o.metadata);
  switch (ev.tipo) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed': {
      const id = idStripe(o.id, ['cs']);
      if (!id) return ignorar('el evento no trae la sesión de pago');
      const pago = str(o.payment_status);
      if (ev.tipo === 'checkout.session.completed' && pago === 'unpaid') {
        // Un medio diferido (OXXO, transferencia): la plata no entró. Entra con async_payment_succeeded.
        return ignorar('pago diferido: entra con checkout.session.async_payment_succeeded');
      }
      if (ev.tipo === 'checkout.session.completed' && pago !== 'paid') return ignorar(`sesión sin pago (${pago ?? 'sin estado'})`);
      return {
        accion: ev.tipo === 'checkout.session.async_payment_failed' ? 'fallido' : 'aprobado',
        leer: { objeto: 'checkout', id },
        buscar: { token: token(meta.mako_cobro) ?? token(o.client_reference_id), ref: id },
      };
    }
    case 'checkout.session.expired':
      // El cobro sigue pendiente: /pagar/<token> crea otra sesión al abrir el link (urlParaPagar).
      return ignorar('la sesión venció sin pago: el link de MaKo crea otra al abrirse');
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const id = idStripe(o.id, ['in']);
      if (!id) return ignorar('el evento no trae la factura');
      const det = obj(obj(o.parent).subscription_details);
      const sub = idStripe(det.subscription, ['sub']);
      if (!sub) return ignorar('factura que no es de una suscripción');
      const motivo = str(o.billing_reason);
      if (ev.tipo === 'invoice.paid' && !FACTURAS_DE_PAGO.has(motivo ?? '')) return ignorar(`factura de ${motivo ?? 'motivo desconocido'}: no es un pago de la suscripción`);
      return {
        accion: ev.tipo === 'invoice.paid' ? 'aprobado' : 'fallido',
        leer: { objeto: 'factura', id },
        buscar: { token: token(obj(det.metadata).mako_cobro), suscripcionId: sub },
      };
    }
    case 'customer.subscription.deleted': {
      const id = idStripe(o.id, ['sub']);
      if (!id) return ignorar('el evento no trae la suscripción');
      return { accion: 'suscripcion_cancelada', leer: { objeto: 'suscripcion', id }, buscar: { token: token(meta.mako_cobro), suscripcionId: id } };
    }
    case 'charge.refunded': {
      const id = idStripe(o.id, ['ch', 'py']);
      if (!id) return ignorar('el evento no trae el cargo');
      // Desde basil el cargo ya NO trae `invoice`: para una cuota de suscripción se llega a la
      // factura por el payment intent (lib/cobros-webhook.ts, facturaDePagoStripe).
      return { accion: 'reembolso', leer: { objeto: 'cargo', id }, buscar: { token: token(meta.mako_cobro), pagoId: idStripe(o.payment_intent, ['pi']) } };
    }
    case 'charge.dispute.created':
    case 'charge.dispute.funds_withdrawn':
    case 'charge.dispute.funds_reinstated':
    case 'charge.dispute.closed': {
      // Un CONTRACARGO (15/10/2026). La fase sale del TIPO del evento (`faseDeDisputa`); el estado, de la relectura.
      const id = idStripe(o.id, ['dp', 'du']);
      if (!id) return ignorar('el evento no trae la disputa');
      return { accion: 'disputa', leer: { objeto: 'disputa', id }, buscar: { token: null, pagoId: idStripe(o.payment_intent, ['pi']) } };
    }
    case 'refund.failed': {
      // Una devolución que había salido y FALLÓ (15/10/2026): el cargo vuelve a estar cobrado. La metadata de la
      // devolución es la de MaKo (`mako: '1'`), no la del cobro: el cobro se busca por el payment intent.
      const id = idStripe(o.id, ['re', 'pyr']);
      if (!id) return ignorar('el evento no trae la devolución');
      return { accion: 'reembolso_fallido', leer: { objeto: 'reembolso', id }, buscar: { token: token(meta.mako_cobro), pagoId: idStripe(o.payment_intent, ['pi']) } };
    }
    default:
      return ignorar(`evento ${ev.tipo}: MaKo no lo procesa`);
  }
}

/** El token del cobro que dice el objeto RELEÍDO (metadata o client_reference_id), si dice alguno. */
export function tokenReleido(p: { metadata?: Record<string, string> | null; referencia?: string | null }): string | null {
  return token(p.metadata?.mako_cobro) ?? token(p.referencia);
}

/**
 * ¿El objeto releído es de ESTE cobro? Si el objeto trae un token de MaKo y no es el del cobro, no:
 * el cobro se encontró por otro camino (la suscripción, el pago) y algo no cierra. Sin token, sí
 * (una renovación o un reembolso no siempre lo traen).
 */
export const esDelCobro = (tokenDelCobro: string, releido: string | null): boolean => !releido || releido === tokenDelCobro;

/** ¿El aviso es del mismo modo (real/prueba) que el cobro? Un evento sin `livemode` no se juzga. */
export function mismoModo(livemode: boolean | null, modo: 'real' | 'prueba'): boolean {
  return livemode == null || livemode === (modo === 'real');
}

export const nombreModo = (livemode: boolean): string => (livemode ? 'real' : 'prueba');

type Confirmacion<T> = ({ ok: true } & T) | { ok: false; motivo: string };

/**
 * La sesión RELEÍDA confirma el aviso. Aprobado: `complete` + `paid`, y el id del pago es el payment
 * intent en un pago único y la FACTURA en una suscripción (ver `avisoStripe`). Sin factura todavía, la
 * suscripción se aplica con su `invoice.paid`: con el id de la sesión, ese aviso se leería como una
 * renovación y duplicaría la cuota.
 */
export function confirmarCheckout(
  accion: 'aprobado' | 'fallido',
  s: { estado: string | null; pagoEstado: string | null; paymentIntent: string | null; subscription: string | null; invoice: string | null },
): Confirmacion<{ proveedorPagoId: string | null; suscripcionId: string | null }> {
  if (accion === 'fallido') {
    return s.pagoEstado === 'paid' ? { ok: false, motivo: 'la sesión ya figura pagada' } : { ok: true, proveedorPagoId: null, suscripcionId: null };
  }
  if (s.estado !== 'complete' || s.pagoEstado !== 'paid') return { ok: false, motivo: `la sesión releída no está pagada (${s.estado ?? '—'}/${s.pagoEstado ?? '—'})` };
  if (s.subscription) {
    return s.invoice
      ? { ok: true, proveedorPagoId: s.invoice, suscripcionId: s.subscription }
      : { ok: false, motivo: 'suscripción sin factura todavía: se aplica con su invoice.paid' };
  }
  return s.paymentIntent ? { ok: true, proveedorPagoId: s.paymentIntent, suscripcionId: null } : { ok: false, motivo: 'la sesión pagada no trae el pago' };
}

/** La factura RELEÍDA confirma el aviso. Una renovación lleva el id de ESA factura (es otra cuota). */
export function confirmarFactura(
  accion: 'aprobado' | 'fallido',
  f: { id: string; estado: string | null; montoPagado: number | null; moneda: string | null; motivo: string | null; suscripcion: string | null },
): Confirmacion<{ proveedorPagoId: string; monto: number | null; moneda: string | null; suscripcionId: string | null }> {
  if (accion === 'fallido') {
    return f.estado === 'paid'
      ? { ok: false, motivo: 'la factura ya figura pagada' }
      : { ok: true, proveedorPagoId: f.id, monto: null, moneda: null, suscripcionId: f.suscripcion };
  }
  if (f.estado !== 'paid') return { ok: false, motivo: `la factura releída no está pagada (${f.estado ?? '—'})` };
  if (!FACTURAS_DE_PAGO.has(f.motivo ?? '')) return { ok: false, motivo: `factura de ${f.motivo ?? 'motivo desconocido'}: no es un pago de la suscripción` };
  if (!(Number(f.montoPagado) > 0)) return { ok: false, motivo: 'factura en cero: no hay plata que registrar' };
  return { ok: true, proveedorPagoId: f.id, monto: f.montoPagado, moneda: f.moneda, suscripcionId: f.suscripcion };
}

/** La devolución RELEÍDA confirma que falló: `failed` (o `canceled`, que tampoco devolvió nada). Un aviso viejo de una que después salió, no. */
export function confirmarDevolucionFallida(d: { estado: string | null; cargo: string | null }): Confirmacion<{ cargo: string }> {
  if (d.estado !== 'failed' && d.estado !== 'canceled') return { ok: false, motivo: `la devolución releída no falló (${d.estado ?? 'sin estado'})` };
  if (!d.cargo) return { ok: false, motivo: 'la devolución releída no dice de qué cargo es' };
  return { ok: true, cargo: d.cargo };
}

/** El cargo RELEÍDO confirma el reembolso: `refunded` es el TOTAL; un monto devuelto menor es parcial. */
export function confirmarCargo(c: { paymentIntent: string | null; reembolsado: boolean; montoReembolsado: number | null }): Confirmacion<{ total: boolean; paymentIntent: string | null }> {
  if (!c.reembolsado && !(Number(c.montoReembolsado) > 0)) return { ok: false, motivo: 'el cargo releído no tiene reembolsos' };
  return { ok: true, total: c.reembolsado, paymentIntent: c.paymentIntent };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mercado Pago
// ─────────────────────────────────────────────────────────────────────────────

export type TipoMp = 'payment' | 'subscription_preapproval' | 'subscription_authorized_payment';
const TIPOS_MP: ReadonlySet<string> = new Set<TipoMp>(['payment', 'subscription_preapproval', 'subscription_authorized_payment']);
/** Los nombres viejos (IPN) de los mismos recursos. Releer siempre al proveedor hace inofensivo aceptarlos. */
const ALIAS_MP: Readonly<Record<string, TipoMp>> = { preapproval: 'subscription_preapproval', authorized_payment: 'subscription_authorized_payment' };

export type NotificacionMp =
  | {
    ok: true;
    /** 'webhook' = `type` + `data.id` (se puede firmar) · 'ipn' = `?topic=&id=` (MP: «no se puede validar»). */
    formato: 'webhook' | 'ipn';
    /** El tipo normalizado; `procesable` dice si MaKo hace algo con él. */
    tipo: string;
    procesable: boolean;
    id: string;
    /** El `user_id` de la cuenta que cobró (cuerpo) o el `?u=` que MaKo puso en la notification_url. */
    userId: string | null;
  }
  | { ok: false; motivo: string };

const ID_NUMERICO = /^\d{1,20}$/;
const ID_ALFANUMERICO = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Lo que dice una notificación de Mercado Pago, en sus dos formatos. Es FLACA a propósito (de MP): un
 * tipo y un id. El estado se pide después al recurso (`/v1/payments`, `/preapproval`,
 * `/authorized_payments`) con el token del negocio.
 *
 * `data.id` se toma del QUERY primero: es el que entra en el manifiesto que MP firma.
 */
export function notificacionMp(p: { query: { get(k: string): string | null }; cuerpo: unknown }): NotificacionMp {
  const b = obj(p.cuerpo);
  const deQuery = (k: string): string | null => str(p.query.get(k));
  let formato: 'webhook' | 'ipn' = 'webhook';
  let tipo = str(b.type) ?? deQuery('type');
  let id = deQuery('data.id') ?? str(obj(b.data).id);
  if (!tipo || !id) {
    const topic = deQuery('topic') ?? str(b.topic);
    const idIpn = deQuery('id');
    if (topic && idIpn) { formato = 'ipn'; tipo = topic; id = idIpn; }
  }
  if (!tipo || !id) return { ok: false, motivo: 'la notificación no trae tipo e id' };
  if (tipo.length > 60 || !/^[a-z_.-]+$/.test(tipo)) return { ok: false, motivo: 'tipo de notificación inválido' };
  const normal = ALIAS_MP[tipo] ?? tipo;
  const procesable = TIPOS_MP.has(normal);
  const formaId = normal === 'subscription_preapproval' || !procesable ? ID_ALFANUMERICO : ID_NUMERICO;
  if (!formaId.test(id)) return { ok: false, motivo: 'id de recurso inválido' };
  const u = str(b.user_id) ?? deQuery('u');
  return { ok: true, formato, tipo: normal, procesable, id, userId: u && ID_NUMERICO.test(u) ? u : null };
}

/**
 * La clave de deduplicación de un aviso de MP: `<tipo>:<id>:<estado resultante>`. MP manda VARIAS
 * notificaciones por el mismo pago (created/updated) y no trae un id de evento estable: lo que se
 * procesa una vez es cada ESTADO del recurso (aprobado, reembolsado…), que sale de la relectura.
 */
export function claveEventoMp(tipo: string, id: string, estado: string): string {
  const e = (estado || 'sin-estado').toLowerCase().replace(/[^a-z0-9_.-]/g, '-');
  return `${tipo}:${id}:${e}`.slice(0, 200);
}

/** Los rechazos de MP, en palabras de una persona (van al historial del lead). */
const RECHAZOS_MP: Readonly<Record<string, string>> = {
  cc_rejected_insufficient_amount: 'La tarjeta no tiene fondos suficientes.',
  cc_rejected_high_risk: 'Mercado Pago lo rechazó por seguridad.',
  rejected_high_risk: 'Mercado Pago lo rechazó por seguridad.',
  cc_rejected_call_for_authorize: 'El banco pide autorizar el pago.',
  cc_rejected_duplicated_payment: 'Era un pago duplicado.',
  cc_rejected_card_disabled: 'La tarjeta está deshabilitada.',
  cc_rejected_max_attempts: 'Se superó el límite de intentos.',
  bank_rejected: 'El banco lo rechazó.',
  expired: 'Venció sin pagarse.',
  by_payer: 'Lo canceló quien pagaba.',
  by_collector: 'Lo canceló el negocio.',
};

export function motivoRechazoMp(detalle: string | null): string {
  if (detalle && RECHAZOS_MP[detalle]) return RECHAZOS_MP[detalle];
  if (detalle?.startsWith('cc_rejected_bad_filled')) return 'Los datos de la tarjeta estaban mal.';
  return 'Mercado Pago lo rechazó.';
}

export type PlanPagoMp =
  | { accion: 'aprobado'; estadoResultante: string; reembolsoParcial: boolean }
  | { accion: 'fallido'; estadoResultante: string; motivo: string }
  | { accion: 'reembolso'; estadoResultante: string; total: true }
  | { accion: 'contracargo'; estadoResultante: string; detalle: string | null }
  | { accion: 'ignorar'; estadoResultante: string; motivo: string };

/**
 * Qué hacer con un pago de MP RELEÍDO. Un pago aprobado con una devolución parcial sigue `approved`
 * (con `status_detail: 'partially_refunded'`): se registra el pago —por si el aviso del aprobado se
 * perdió— y la devolución parcial queda en el historial; su clave lleva el monto devuelto, así una
 * segunda devolución parcial no choca con la primera.
 *
 * Un CONTRACARGO no mueve la cuota: si la plata salió o volvió, MP lo documenta de dos maneras opuestas
 * (`settled`/`reimbursed`, ver FaseContracargo) y no está medido. Se CUENTA en el historial y en el cobro (15/10/2026;
 * antes quedaba sólo en una fila de `pasarela_eventos` que nadie miraba).
 */
export function planDePagoMp(p: { estado: string | null; detalle: string | null; reembolsado: number | null }): PlanPagoMp {
  const estado = p.estado ?? 'sin-estado';
  switch (p.estado) {
    case 'approved': {
      const parcial = p.detalle === 'partially_refunded' && Number(p.reembolsado) > 0;
      return { accion: 'aprobado', estadoResultante: parcial ? `partially_refunded-${Number(p.reembolsado)}` : 'approved', reembolsoParcial: parcial };
    }
    case 'refunded':
      return { accion: 'reembolso', estadoResultante: 'refunded', total: true };
    case 'rejected':
    case 'cancelled':
      return { accion: 'fallido', estadoResultante: estado, motivo: motivoRechazoMp(p.detalle) };
    case 'charged_back':
      // Se CUENTA (historial y motivo del cobro), una vez por cada `status_detail`, sin tocar la cuota (ver FaseContracargo).
      return { accion: 'contracargo', estadoResultante: `charged_back-${p.detalle ?? 'sin-detalle'}`, detalle: p.detalle };
    case 'pending':
    case 'in_process':
    case 'authorized':
    case 'in_mediation':
      return { accion: 'ignorar', estadoResultante: estado, motivo: `el pago sigue en curso (${estado})` };
    default:
      return { accion: 'ignorar', estadoResultante: estado, motivo: `estado de pago desconocido (${estado})` };
  }
}

/** Una suscripción de MP cancelada: `cancelled` al leerla (y `canceled`, con una ele, al cancelarla). */
export const suscripcionMpCancelada = (estado: string | null): boolean => estado === 'cancelled' || estado === 'canceled';

/** Cómo se busca el cobro de un pago de MP releído: por su external_reference (el token) y su suscripción. */
export function buscarDePagoMp(p: { id: string; referencia: string | null; preapprovalId: string | null }): ClaveCobro {
  return { token: token(p.referencia), ref: p.preapprovalId, suscripcionId: p.preapprovalId, pagoId: p.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// El tiempo del proveedor
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Espera el trabajo hasta `ms`. Si termina antes, su valor (o su error); si no, `{ listo: false }` y
 * el trabajo SIGUE corriendo: quien llama lo deja en `after()`. Es lo que permite contestar a tiempo
 * sin perder el reintento del proveedor en lo rápido (Stripe espera hasta 10 s la respuesta de
 * `checkout.session.completed` antes de devolver al comprador; Mercado Pago pide la respuesta en
 * menos de 22 s).
 *
 * Un error que llega DESPUÉS del tope no queda como rechazo sin manejar: lo maneja quien siguió el
 * trabajo en `after()`.
 */
export function conPresupuesto<T>(trabajo: Promise<T>, ms: number): Promise<{ listo: true; valor: T } | { listo: false }> {
  let reloj: ReturnType<typeof setTimeout> | undefined;
  const vence = new Promise<{ listo: false }>((resolve) => { reloj = setTimeout(() => resolve({ listo: false }), ms); });
  const hecho = trabajo.then((valor) => ({ listo: true as const, valor }));
  return Promise.race([hecho, vence]).finally(() => clearTimeout(reloj));
}

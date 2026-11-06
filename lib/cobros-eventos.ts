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
import { montoUsdDeLaCuota } from './cobros-reglas';
import { aUnidadMinima } from './pasarela-moneda';

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
    .replace(/\b(?:sk|rk|pk|whsec|creem)_[A-Za-z0-9_*-]+/g, '[clave]')
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

/** `creado`: cuándo PASÓ (el `created` del evento, no cuándo llegó): un aviso reintentado llega días después (15/10/2026). */
export type EventoStripe = { id: string; tipo: string; livemode: boolean | null; objeto: Json; creado?: string | null };

/** El sobre de un evento de Stripe (`{ id: 'evt_…', object: 'event', type, livemode, data: { object } }`). */
export function eventoStripe(cuerpo: unknown): EventoStripe | null {
  const b = obj(cuerpo);
  const id = str(b.id);
  const tipo = str(b.type);
  if (!id || id.length > 200 || !/^evt_[A-Za-z0-9_]+$/.test(id)) return null;
  if (!tipo || tipo.length > 120) return null;
  if (b.object != null && b.object !== 'event') return null;
  const creado = Number(b.created) > 0 && Number.isFinite(Number(b.created)) ? new Date(Number(b.created) * 1000).toISOString() : null;
  return { id, tipo, livemode: typeof b.livemode === 'boolean' ? b.livemode : null, objeto: obj(obj(b.data).object), creado };
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

/**
 * ¿La sesión RELEÍDA es la que MaKo armó para ESTE cobro, y cobró lo que el cobro pide? (28/10/2026, la verificación de
 * 3ca2d8328). El aviso encuentra el cobro por el `client_reference_id`, y un Payment Link lo acepta en su URL: una venta de US$1
 * con `?client_reference_id=<token>` (el token viaja en /pagar/<token>) marcaba PAGADO un cobro de MaKo de US$1.500, con su
 * cuota y el lead ganado. MaKo arma su sesión con `metadata.mako_cobro` y un solo ítem al monto del cobro, sin cupones ni
 * impuestos (lib/stripe-api.ts, `crearCheckoutStripe`): se exige eso, y nunca un Payment Link. Si Stripe le cobró en otra
 * moneda (`currency_conversion`), vale el monto de origen. Un pago diferido que FALLÓ no trae plata: ahí no se mira el monto.
 */
export function sesionDelCobro(
  c: { token: string; monto: number; moneda: string; proveedor_ref: string | null },
  s: { id: string; metadata: Record<string, string>; paymentLink?: string | null; monto: number | null; moneda: string | null; montoOrigen?: number | null; monedaOrigen?: string | null },
  accion: 'aprobado' | 'fallido',
): Confirmacion<object> {
  if (s.paymentLink) return { ok: false, motivo: `la sesión salió de un Payment Link (${s.paymentLink}), no del checkout de MaKo de este cobro` };
  if (s.metadata.mako_cobro !== c.token && s.id !== c.proveedor_ref) return { ok: false, motivo: 'la sesión no es la que MaKo armó para este cobro' };
  if (accion === 'fallido') return { ok: true };
  const pide = c.moneda.toUpperCase();
  // En UNIDAD MÍNIMA, como se lo pidió MaKo a Stripe (la verificación de a196d5a93): un cobro de 49900.4 CLP se arma por 49900, y
  // comparar contra el 49900.4 abría un ticket falso por una sesión que cobró justo lo pedido.
  const enUnidad = (monto: number | null | undefined, moneda: string): number | null => (monto != null && monto > 0 ? aUnidadMinima(monto, moneda) : null);
  const pedido = enUnidad(c.monto, pide);
  const alcanza = (monto: number | null | undefined, moneda: string | null | undefined) => {
    const pagado = (moneda ?? '').toUpperCase() === pide ? enUnidad(monto, pide) : null;
    return pagado != null && pedido != null && pagado >= pedido;
  };
  if (alcanza(s.monto, s.moneda) || alcanza(s.montoOrigen, s.monedaOrigen)) return { ok: true };
  return { ok: false, motivo: `la sesión cobró ${s.monto ?? '—'} ${s.moneda ?? ''} y el cobro es de ${c.monto} ${pide}`.replace(/\s+/g, ' ') };
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

/**
 * EL COBRO DEL DÍA 8 DE UNA PRUEBA DE STRIPE, para el cron (28/10/2026): de las facturas pagadas de su suscripción (la más
 * nueva primero, como las da Stripe), la más VIEJA que es un pago de ESTE cobro, con el mismo filtro que el aviso
 * (`confirmarFactura`: la de US$ 0 del inicio no cuenta). Con el id de la factura, como el `invoice.paid`: si el aviso llega
 * después, no es otra cuota. Null si todavía no se cobró nada.
 */
export function primerCobroDeLaPrueba(
  facturas: ReadonlyArray<{ id: string; estado: string | null; montoPagado: number | null; moneda: string | null; motivo: string | null; suscripcion: string | null; metadata: Record<string, string>; pagadoAt: string | null }>,
  token: string,
): { proveedorPagoId: string; monto: number | null; moneda: string | null; suscripcionId: string | null; pagadoAt: string | null } | null {
  for (const f of [...facturas].reverse()) {
    if (f.metadata.mako_cobro !== token) continue;
    const conf = confirmarFactura('aprobado', f);
    if (conf.ok) return { proveedorPagoId: conf.proveedorPagoId, monto: conf.monto, moneda: conf.moneda, suscripcionId: conf.suscripcionId, pagadoAt: f.pagadoAt };
  }
  return null;
}

/**
 * Cuánto se espera desde que Stripe cobró una renovación antes de que el cron la asiente: CUATRO DÍAS. Stripe reintenta un aviso
 * hasta 3 días; si el cron la asentara antes y el reintento llegara después, el aviso volvería a llamar al CRON «Pagos» del lead
 * (una automatización con reentrada «siempre» le diría «gracias» dos veces: la revisión del 6/11/2026). Pasados los 3 días, el
 * aviso ya no llega: lo que falta, falta de verdad.
 */
export const MARGEN_AVISO_RENOVACION_MS = 4 * 86_400_000;
/**
 * Hasta qué edad una renovación perdida se asienta SOLA: asentarla dispara el aviso al equipo y el CRON «Pagos» del lead, y un
 * WhatsApp de «gracias por tu pago» por un pago de hace meses es peor que no mandarlo. Las más viejas se DICEN (`viejas`).
 */
export const MAX_EDAD_RENOVACION_MS = 14 * 86_400_000;

/**
 * LAS RENOVACIONES DE STRIPE CON SU AVISO PERDIDO (6/11/2026, docs/relevo/pendientes-barrido.md). El mes 2 en adelante de una
 * suscripción entra SÓLO por `invoice.paid`: el cron miraba la sesión del checkout, que ya está pagada, y si ese aviso se perdía
 * (Stripe deja de reintentar a los 3 días) la plata entraba y MaKo no asentaba la cuota, no se la acreditaba al partner (el 2º
 * mes) y el corte por falta de pago la leería como impaga. De las facturas PAGADAS de la suscripción (la más nueva primero,
 * como las da Stripe), las que el cron tiene que asentar, de la más VIEJA a la más nueva:
 *   · sólo las de un CICLO (`subscription_cycle`): la primera (`subscription_create`) nunca es una renovación, y un cobro viejo
 *     que guardó otro id para su primer pago la duplicaría como renovación;
 *   · de la suscripción vigente del cobro y de ESTE cobro (el mismo `esDelCobro` que el aviso), con plata (`confirmarFactura`);
 *   · que no sea el primer pago del cobro (`primera`: en una prueba, el día 8 es un ciclo) ni una que ya tiene su cuota;
 *   · con valor en dólares (si no, el CRM no la asienta nunca: no es una renovación perdida);
 *   · cobrada hace más de `MARGEN_AVISO_RENOVACION_MS` (Stripe dejó de reintentar su aviso);
 *   · y de hace menos de `MAX_EDAD_RENOVACION_MS`: las más viejas vuelven en `viejas` (las mira una persona).
 * Con el id de la factura, como el aviso: si después llega, es la misma cuota.
 */
export function renovacionesQueFaltan(
  facturas: ReadonlyArray<{ id: string; estado: string | null; montoPagado: number | null; moneda: string | null; motivo: string | null; suscripcion: string | null; metadata: Record<string, string>; pagadoAt: string | null }>,
  c: {
    token: string; suscripcion: string; primera: string | null; conocidas: ReadonlySet<string>; ahoraMs: number;
    /** Lo del cobro con que se calcula el valor en dólares de la cuota (`montoUsdDeLaCuota`, el mismo que `aplicarPagoAprobado`). */
    cobro: { monto_usd: number | null; monto: number | null; moneda: string | null };
  },
): { asentar: Array<{ proveedorPagoId: string; monto: number | null; moneda: string | null; suscripcionId: string | null; pagadoAt: string | null }>; viejas: string[] } {
  const asentar: Array<{ proveedorPagoId: string; monto: number | null; moneda: string | null; suscripcionId: string | null; pagadoAt: string | null }> = [];
  const viejas: string[] = [];
  for (const f of [...facturas].reverse()) {
    if (f.motivo !== 'subscription_cycle') continue;
    if (f.suscripcion !== c.suscripcion) continue;
    if (!esDelCobro(c.token, tokenReleido({ metadata: f.metadata }))) continue;
    if (f.id === c.primera || c.conocidas.has(f.id)) continue;
    const conf = confirmarFactura('aprobado', f);
    if (!conf.ok) continue;
    // ⚠️ SIN VALOR EN DÓLARES NO HAY CUOTA (la revisión del 6/11/2026): `aplicarPagoAprobado` no la escribe (pagos.monto_usd es NOT
    // NULL y nunca se inventa una tasa), así que nunca quedaría «conocida»: se volvería a aplicar cada día, reescribiendo el
    // `motivo` del cobro, y al final abriría un ticket falso. Una venta externa en pesos nace así. No es una renovación perdida.
    if (montoUsdDeLaCuota({ montoCuota: conf.monto, monedaCuota: conf.moneda ?? c.cobro.moneda, cobroMontoUsd: c.cobro.monto_usd, cobroMonto: c.cobro.monto, cobroMoneda: c.cobro.moneda }) == null) continue;
    const pagada = f.pagadoAt ? Date.parse(f.pagadoAt) : NaN;
    if (!Number.isFinite(pagada)) continue;
    const edad = c.ahoraMs - pagada;
    if (edad < MARGEN_AVISO_RENOVACION_MS) continue;
    if (edad > MAX_EDAD_RENOVACION_MS) { viejas.push(f.id); continue; }
    asentar.push({ proveedorPagoId: conf.proveedorPagoId, monto: conf.monto, moneda: conf.moneda, suscripcionId: conf.suscripcionId, pagadoAt: f.pagadoAt });
  }
  return { asentar, viejas };
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

// ─────────────────────────────────────────────────────────────────────────────
// Creem (31/10/2026)
// ─────────────────────────────────────────────────────────────────────────────

/** Un evento de Creem, ya verificado por firma. */
export type EventoCreem = { id: string; tipo: string; objeto: Json; creado: string | null };

/**
 * El evento de Creem del cuerpo, o null si no lo es.
 *
 * ⚠️ TRES TRAMPAS DE NOMBRE, y las tres se escriben mal de memoria por asumir que Creem es Stripe:
 *   · el tipo del evento está en **`eventType`** (camelCase), no en `type` ni en `event_type`. El resto del payload es
 *     snake_case: la API mezcla convenciones a propósito y no hay forma de deducirlo.
 *   · `created_at` llega en MILISEGUNDOS y como NÚMERO (1728734327355), no en segundos como Stripe ni en ISO.
 *   · el id del evento es `evt_…` — igual que Stripe, lo cual es justo lo que hace creíble el error de suponer el resto.
 *
 * El `id` es la clave de idempotencia (`pasarela_eventos`). La doc aclara el detalle fino: los reintentos automáticos
 * CONSERVAN el `id`, pero un reenvío a mano desde el panel llega con un `id` NUEVO — así que deduplicar por `id` no
 * protege de un reenvío manual, y por eso lo que se aplica sale de RELEER el estado al proveedor y no de contar eventos.
 */
export function eventoCreem(cuerpo: unknown): EventoCreem | null {
  const b = obj(cuerpo);
  const id = str(b.id);
  const tipo = str(b.eventType);
  if (!id || id.length > 200 || !/^evt_[A-Za-z0-9_-]+$/.test(id)) return null;
  if (!tipo || tipo.length > 120) return null;
  const ms = Number(b.created_at);
  const creado = Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
  return { id, tipo, objeto: obj(b.object), creado };
}

/** Qué hacer con un evento de Creem. `leer` dice qué releer antes de aplicar: nunca se confía en el cuerpo. */
export type AvisoCreem =
  | { accion: 'ignorar'; motivo: string }
  | { accion: 'aprobado' | 'fallido' | 'cancelada' | 'reembolso' | 'disputa'; suscripcionId: string | null; checkoutId: string | null; token: string | null; pagoId: string | null };

/**
 * Qué significa cada evento de Creem. Decide SIN red (puro, con test).
 *
 * ⚠️ EL ACCESO SE DA CON `subscription.paid`, NO CON `subscription.active`. Lo dice la propia doc de Creem:
 * «[subscription.active] Use only for synchronization, we encourage using `subscription.paid` for activating access».
 * Y `subscription.paid` «fires for the first payment and every renewal», o sea que el alta y la renovación entran por
 * el MISMO evento — que es justo lo que `aplicarPagoAprobado` ya sabe manejar (es idempotente y distingue el primer
 * pago de una renovación por el id del pago).
 *
 * ⚠️ `subscription.expired` NO CORTA NADA. Su ejemplo oficial llega con `status: "active"`, la doc dice que «payment
 * retries can happen at this stage» y que el estado es terminal SÓLO cuando pasa a `canceled`. Tratarlo como una baja
 * le cortaría el acceso a alguien que todavía puede pagar. Se ignora con rastro.
 *
 * ⚠️ `past_due` y `unpaid` son el período de gracia del reintento (dunning), no una baja: la doc de Creem advierte
 * explícitamente contra gatear por `status === 'active'` porque voltea a los que están en prueba o en dunning. Se
 * anotan como cobro fallido (que es lo que son) y no como suscripción cancelada.
 */
export function avisoCreem(ev: EventoCreem): AvisoCreem {
  const o = ev.objeto;
  const sus = obj(o.subscription);
  // En un evento de suscripción el objeto ES la suscripción; en uno de checkout, la trae adentro.
  const esSuscripcion = ev.tipo.startsWith('subscription.');
  const suscripcionId = esSuscripcion ? str(o.id) : (str(sus.id) ?? str(o.subscription));
  // ⚠️ UN REEMBOLSO O UNA DISPUTA NO TRAEN `metadata` NI `request_id` ARRIBA (`RefundEntity`, `DisputeEntity`): están en su `checkout`,
  // y sólo `transaction` es obligatorio. Sin mirar ahí, el de un pago ÚNICO no encontraba su cobro y se ignoraba con 200, y a
  // quien devolvía se le había prometido que MaKo lo registraba solo.
  const esDePlata = ev.tipo === 'refund.created' || ev.tipo === 'dispute.created';
  const ch = obj(o.checkout);
  const checkoutId = ev.tipo === 'checkout.completed' ? str(o.id) : esDePlata ? (str(ch.id) ?? str(o.checkout)) : null;
  // El token del cobro de MaKo viaja por los dos caminos que le pusimos al abrir el checkout.
  const token = str(obj(o.metadata).mako_cobro) ?? str(o.request_id) ?? str(obj(ch.metadata).mako_cobro) ?? str(ch.request_id);
  const pagoId = esDePlata ? (str(obj(o.transaction).id) ?? str(o.transaction)) : null;
  const base = { suscripcionId, checkoutId, token, pagoId };
  switch (ev.tipo) {
    case 'subscription.paid':
      return { accion: 'aprobado', ...base };
    case 'checkout.completed':
      // Un pago ÚNICO entra por acá (no tiene suscripción que pague). En una suscripción, el que asienta la plata es
      // `subscription.paid`: los dos son idempotentes, así que si llegan los dos no se duplica nada.
      return { accion: 'aprobado', ...base };
    case 'subscription.past_due':
    case 'subscription.unpaid':
      return { accion: 'fallido', ...base };
    case 'subscription.canceled':
      return { accion: 'cancelada', ...base };
    case 'refund.created':
      return { accion: 'reembolso', ...base };
    case 'dispute.created':
      return { accion: 'disputa', ...base };
    case 'subscription.scheduled_cancel':
      // La baja quedó agendada para el fin del período: la suscripción SIGUE activa y cobrando hasta entonces. La baja
      // real llega después como `subscription.canceled`. Cortar acá le saca el acceso a un mes que ya pagó.
      return { accion: 'ignorar', motivo: 'baja agendada para el fin del período: sigue activa hasta entonces' };
    case 'subscription.expired':
      return { accion: 'ignorar', motivo: 'venció el período sin pago nuevo, pero Creem todavía puede reintentar (sólo `canceled` es terminal)' };
    case 'subscription.trialing':
      return { accion: 'ignorar', motivo: 'arrancó la prueba: todavía no hay plata' };
    default:
      return { accion: 'ignorar', motivo: `evento que MaKo no usa: ${ev.tipo}` };
  }
}

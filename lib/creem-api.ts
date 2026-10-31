// =============================================================================
// creem-api — el cliente HTTP de Creem para la pasarela (BYOK: la clave es del negocio)
// =============================================================================
// fetch crudo, sin SDK. Cada función RECIBE la clave: no la lee sola (molde: lib/mercadopago-api.ts,
// lib/stripe-api.ts). Creem es MERCHANT OF RECORD: cobra el impuesto de cada país, lo remite él, y
// aparece él en el resumen de la tarjeta. MaKo no calcula ni informa impuestos.
//
// Lo que no se ve en el código y muerde (docs.creem.io, leída en pantalla el 31/10/2026 — truco:
// cualquier URL de la doc acepta `.md` al final y las de /api-reference/endpoint/* devuelven el
// OpenAPI completo, con los enums):
//   · LA CLAVE VA EN `x-api-key`, no en `Authorization: Bearer`. Es el primer error que uno escribe
//     de memoria creyendo que Creem es Stripe con otro nombre.
//   · EL CHECKOUT NECESITA UN `product_id`: no existe el precio en línea de Stripe (`price_data`).
//     Para cobrar algo hay que CREAR un producto primero (`asegurarProductoCreem`), y por eso todo
//     POST lleva `Idempotency-Key` (la doc: «makes retries return the originally created product
//     instead of creating a duplicate»).
//   · `price` va en CENTAVOS y tiene piso: «Must be 0 (free product) or at least 100». No hay
//     precios de 50 centavos.
//   · LA MONEDA ES UN ENUM CERRADO DE DOS VALORES: `EUR` | `USD`. La página de precios promete
//     «multi-currency» pero el OpenAPI no deja otra. MaKo cobra en USD por acá.
//   · `billing_period: 'every-month'` es el mensual. `recurring_interval` NO se manda con un preset
//     («must be omitted for preset billing periods»), sólo con `billing_period: 'custom'`.
//   · LEER UNA SUSCRIPCIÓN ES POR QUERY STRING: `GET /v1/subscriptions?subscription_id=…`. No es
//     `/v1/subscriptions/{id}` (ésa no existe). Cancelar y actualizar SÍ son por path.
//   · CANCELAR NO TIENE `cancel_at_period_end`: es `{ mode: 'immediate' | 'scheduled' }`. Y sin
//     mandar `mode` el default «can be configured in the store billing settings» — o sea que
//     depende del panel y no del código: SE MANDA SIEMPRE EXPLÍCITO.
//   · `onExecute` es camelCase en una API que por lo demás es snake_case. No es un typo de la doc.
//   · EL DESCUENTO DE UN SOLO CICLO EXISTE DE VERDAD: `duration: 'once'` — «Applies only to the
//     first payment», y el caso de uso que da la doc es literal «Get 50% off your first month».
//     Se aplica EN EL CHECKOUT (`discount_code`), y después el precio vuelve solo al lleno. Por eso
//     Creem NO necesita el remiendo de lib/primer-mes.ts (que a Mercado Pago le sube el monto a mano
//     al entrar el primer pago).
//   · NO HAY ENDPOINT PARA DESCONTARLE A UNA SUSCRIPCIÓN YA ABIERTA: `UpdateSubscriptionRequest`
//     sólo tiene `items` y `update_behavior`. Un cupón se aplica al nacer o no se aplica. Lo que sí
//     se puede es CAMBIARLE EL PRODUCTO (`/upgrade`), y así se rebaja y se sube: `cambiarPrecioCreem`.
//   · LA PAUSA NO TIENE FECHA DE VUELTA: `POST …/pause` no lleva cuerpo y no vuelve sola. Y qué pasa
//     con `next_transaction_date` al reanudar NO ESTÁ DOCUMENTADO. Sin medir con claves de verdad.
//   · NI LA SUSCRIPCIÓN NI EL CLIENTE TRAEN LA TARJETA: no hay huella ni id de medio de pago.
//   · NO HAY «TERMINAR EL DÍA X»: la baja agendada es al fin del período en curso y nada más. Un
//     plazo fijo se cierra agendando la baja cuando se paga el ÚLTIMO ciclo (`tocaCerrarElPlazo`).
//   · EL SECRETO DEL AVISO SE PUEDE PEDIR POR API: `POST /v1/webhooks` lo devuelve UNA vez, y
//     `GET /v1/webhooks/{id}/secret` lo vuelve a dar. Así que Creem se conecta como Stripe (MaKo
//     registra el aviso y se queda con el secreto), no como Mercado Pago (que obliga a copiarlo del
//     panel a mano).
//   · LOS MONTOS DEL AVISO VIENEN POR TRIPLICADO: `amount` SIN impuesto, `tax_amount` el impuesto y
//     `amount_paid` CON impuesto. Lo que MaKo asienta es lo que cobró el plan (`amount`): el impuesto
//     no es ingreso nuestro, es de Creem, que lo remite.
//   · ⚠️ TODOS VIENEN EN CENTAVOS («1000 = $10.00»), también el `price` que se lee. `montoDeCreem` los
//     pasa a unidades al entrar: MaKo los leía tal cual, y una renovación de US$47 entraba al cash
//     como US$4.700 (31/10/2026). Un monto de este archivo hacia afuera está SIEMPRE en unidades.
//   · ⚠️ `created_at` DE UNA TRANSACCIÓN ES UN NÚMERO (`TransactionEntity`: «as timestamp»), y el de una
//     suscripción una fecha ISO. Leído como texto, `Date.parse` daba NaN: ningún orden servía, y la
//     cuota llevaba la fecha de hoy. Lo normaliza `fechaDeCreem`. Su unidad no está documentada.
//   · ⚠️ `/transactions/search` NO FILTRA POR SUSCRIPCIÓN: su OpenAPI sólo tiene `customer_id`,
//     `order_id`, `product_id` y la página, sin orden. Sin filtro devuelve las de TODA la tienda, y la
//     más nueva podía ser de otro cliente. Se filtra por cliente y se vuelve a mirar acá adentro.
//   · LA COMISIÓN PEGA SOBRE EL TOTAL CON IMPUESTO, no sobre el precio. La página de precios dice
//     «3.9% + 40¢» y deja creer que es sobre la venta; la doc de payouts da el ejemplo: US$20 + US$4
//     de IVA → comisión US$1,33 (3,9% de 24 + 0,40), no US$1,18.
//   · `mode` en los ejemplos del payload llega como `"local"`, pero el enum es test|prod|sandbox: NO
//     se hace lista blanca por `mode`.

import 'server-only';

export const CREEM_API = 'https://api.creem.io/v1';
/** El entorno de prueba es OTRO host y las claves NO son intercambiables (una `creem_test_…` acá da 401). */
export const CREEM_API_PRUEBA = 'https://test-api.creem.io/v1';

export type R<T> = ({ ok: true } & T) | { ok: false; status: number; error: string };

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);
const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const fallo = <T>(x: { status: number; error: string }): R<T> => ({ ok: false, status: x.status, error: x.error });
/** Un monto de Creem (centavos) en unidades de la moneda. */
const montoDeCreem = (v: unknown): number | null => { const c = num(v); return c == null ? null : c / 100; };
/** Una fecha de Creem en ISO: un timestamp en milisegundos o en segundos (por su tamaño), o la ISO que ya venía. null = no se lee. */
const fechaDeCreem = (v: unknown): string | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : NaN;
  const ms = Number.isFinite(n) ? (n < 1e12 ? n * 1000 : n) : typeof v === 'string' ? Date.parse(v) : NaN;
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};

/** Las dos monedas que acepta un producto de Creem (`ProductCurrency`, enum cerrado del OpenAPI). */
export const MONEDAS_CREEM: readonly string[] = ['USD', 'EUR'];
export const esMonedaCreem = (m: string | null | undefined): boolean => MONEDAS_CREEM.includes(String(m ?? '').toUpperCase());

/**
 * El modo de una clave de Creem por su prefijo: las de prueba son `creem_test_…`. ⚠️ No es simétrico con Stripe: una
 * clave de producción NO lleva un prefijo que la distinga (es `creem_…`), así que esto reconoce la de prueba y asume
 * producción en el resto. Lo que decide a qué host se habla es esto (`baseDe`).
 */
export const modoDeClaveCreem = (key: string | null | undefined): 'real' | 'prueba' | null => {
  const k = String(key ?? '').trim();
  if (!/^creem_[A-Za-z0-9_-]{8,}$/.test(k)) return null;
  return k.startsWith('creem_test_') ? 'prueba' : 'real';
};

/** El host que le corresponde a esta clave. Una clave de prueba contra el host de producción da 401 y al revés. */
const baseDe = (key: string): string => (modoDeClaveCreem(key) === 'prueba' ? CREEM_API_PRUEBA : CREEM_API);

/**
 * Un pedido a Creem. `idem` va como `Idempotency-Key` en los POST (la doc lo documenta para productos; en el resto es
 * inofensivo y nos cubre del reintento). El error se lee ADENTRO de la respuesta: Creem devuelve `trace_id` en cada
 * fallo, y se adjunta porque es lo que su soporte pide.
 */
export async function llamar(
  key: string,
  metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  ruta: string,
  body?: unknown,
  idem?: string | null,
): Promise<{ ok: true; body: Json } | { ok: false; status: number; error: string }> {
  const headers: Record<string, string> = { 'x-api-key': key };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idem && metodo !== 'GET') headers['Idempotency-Key'] = idem.slice(0, 64);
  let r: Response;
  try {
    r = await fetch(`${baseDe(key)}${ruta}`, {
      method: metodo, headers, body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store', signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    // Sin `e.message`: con un header inválido fetch tira con la CLAVE entera adentro (ver lib/stripe-api.ts).
    return { ok: false, status: 0, error: `Creem no contestó (${e instanceof Error ? e.name : 'error de red'})` };
  }
  let crudo: unknown = null;
  try { crudo = await r.json(); } catch { /* respuesta no-JSON */ }
  const j = obj(crudo);
  if (!r.ok) {
    const msg = str(j.message) ?? str(j.error) ?? str(obj(j.error).message) ?? `Creem respondió ${r.status}`;
    const traza = str(j.trace_id);
    const texto = r.status === 401 ? 'Creem no aceptó la clave (401). Revisa que sea la de producción y que esté completa.'
      : r.status === 403 ? 'Creem rechazó la clave (403): no tiene permiso para esto.'
      : msg;
    return { ok: false, status: r.status, error: traza ? `${texto} (traza ${traza})` : texto };
  }
  return { ok: true, body: j };
}

// ─────────────────────────────────────────────────────────────────────────────
// La cuenta: Creem no publica un `GET /me`, así que la identidad sale de que la clave FUNCIONE
// ─────────────────────────────────────────────────────────────────────────────

export type CuentaCreem = { id: string; moneda: string | null; nombre: string | null; modo: 'real' | 'prueba' };

/**
 * Prueba la clave y devuelve con qué identificar la cuenta.
 *
 * ⚠️ AQUÍ ESTÁ LA DIFERENCIA MÁS INCÓMODA CON LAS OTRAS DOS PASARELAS: Creem **no tiene** un endpoint que diga «esta
 * clave es de la cuenta X» (Stripe tiene `GET /v1/account` → `acct_…`; Mercado Pago `GET /users/me` → `user_id`). El
 * ruteo de los avisos de MaKo necesita un identificador estable por cuenta (`webhook_routing`), y acá no hay ninguno
 * que Creem nos dé. Así que el identificador de ruteo de Creem es **el id del endpoint de aviso** (`wh_…`) que MaKo
 * registra en esa cuenta (`asegurarWebhookCreem`): es estable, es de esa cuenta y sólo lo conoce quien tiene la clave.
 * `probarClaveCreem` sólo contesta «la clave sirve»: se apoya en `/products/search`, que es una lectura y está vacía en
 * una cuenta nueva (verificado el 31/10/2026: 200 con `items: []`).
 */
export async function probarClaveCreem(key: string): Promise<R<{ modo: 'real' | 'prueba' }>> {
  const modo = modoDeClaveCreem(key);
  if (!modo) return { ok: false, status: 400, error: 'Eso no parece una clave de Creem (empieza con creem_).' };
  const r = await llamar(key, 'GET', '/products/search?page_size=1');
  if (!r.ok) return fallo(r);
  return { ok: true, modo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Productos — el checkout de Creem no cobra sin uno
// ─────────────────────────────────────────────────────────────────────────────

export type ProductoCreem = { id: string; nombre: string | null; precio: number | null; moneda: string | null; recurrente: boolean };

const productoDe = (b: Json): ProductoCreem => ({
  id: str(b.id) ?? '',
  nombre: str(b.name),
  precio: num(b.price),
  moneda: str(b.currency)?.toUpperCase() ?? null,
  recurrente: str(b.billing_type) === 'recurring',
});

/**
 * Crea el producto que va a cobrar este cobro. `monto` llega en unidades de la moneda (47 = US$47) y se manda en
 * CENTAVOS, que es lo que pide Creem.
 *
 * `tax_category: 'saas'` y `tax_mode: 'inclusive'`: el precio que ve la persona es el que paga, y Creem calcula hacia
 * adentro el impuesto de su país y lo remite (es merchant of record). Con `exclusive` el impuesto se le SUMA arriba y
 * un plan de US$47 se cobraría US$56,87 en un país con 21%: la vitrina de MaKo promete US$47.
 */
export async function crearProductoCreem(
  key: string,
  p: { idem: string; nombre: string; monto: number; moneda: string; recurrente: boolean; diasDePrueba?: number | null },
): Promise<R<ProductoCreem>> {
  const moneda = p.moneda.toUpperCase();
  if (!esMonedaCreem(moneda)) return { ok: false, status: 400, error: `Creem cobra en dólares o en euros, no en ${moneda}.` };
  const centavos = Math.round(p.monto * 100);
  // El piso del OpenAPI: «Must be 0 (free product) or at least 100». Un monto que redondea a menos de un dólar lo
  // rechazaría Creem con un 400 crudo; se dice acá, con el monto.
  if (centavos < 100) return { ok: false, status: 400, error: `Creem no cobra menos de 1 ${moneda} (pediste ${p.monto}).` };
  const r = await llamar(key, 'POST', '/products', {
    name: p.nombre.slice(0, 200),
    description: p.nombre.slice(0, 200),
    price: centavos,
    currency: moneda,
    billing_type: p.recurrente ? 'recurring' : 'onetime',
    // `every-month` es el preset mensual. ⚠️ `recurring_interval` NO se manda con un preset: la doc dice «must be
    // omitted for preset billing periods», y mandarlo es un 400.
    billing_period: p.recurrente ? 'every-month' : 'once',
    tax_mode: 'inclusive',
    tax_category: 'saas',
    ...(p.recurrente && p.diasDePrueba && p.diasDePrueba > 0 ? { trial_period_days: p.diasDePrueba } : {}),
  }, p.idem);
  if (!r.ok) return fallo(r);
  const prod = productoDe(r.body);
  if (!prod.id) return { ok: false, status: 502, error: 'Creem no devolvió el id del producto.' };
  return { ok: true, ...prod };
}

// ─────────────────────────────────────────────────────────────────────────────
// Descuentos — el 50% del primer mes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Un código de descuento de UN SOLO ciclo, para el 50% del primer mes. `duration: 'once'` es literalmente el caso de
 * uso que documenta Creem («Get 50% off your first month»), y el segundo mes vuelve al precio lleno sin que MaKo toque
 * nada — al revés que Mercado Pago, donde la suscripción nace rebajada y hay que subirla a mano (lib/primer-mes.ts).
 *
 * Devuelve el CÓDIGO, que es lo que viaja al checkout (`discount_code`). `applies_to_products` es obligatorio.
 */
export async function crearDescuentoDeEntradaCreem(
  key: string,
  p: { idem: string; codigo: string; nombre: string; pct: number; productoId: string },
): Promise<R<{ id: string; codigo: string }>> {
  if (!Number.isInteger(p.pct) || p.pct < 1 || p.pct > 99) return { ok: false, status: 400, error: 'El descuento va de 1 a 99%.' };
  const r = await llamar(key, 'POST', '/discounts', {
    name: p.nombre.slice(0, 200),
    code: p.codigo,
    type: 'percentage',
    percentage: p.pct,
    duration: 'once',
    applies_to_products: [p.productoId],
    max_redemptions: 1,
  }, p.idem);
  if (!r.ok) return fallo(r);
  const id = str(r.body.id);
  // El código vuelve en la respuesta; si no, vale el que mandamos (lo elegimos nosotros).
  const codigo = str(r.body.code) ?? p.codigo;
  if (!id) return { ok: false, status: 502, error: 'Creem no devolvió el descuento.' };
  return { ok: true, id, codigo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Checkout
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Abre el checkout. `request_id` y `metadata.mako_cobro` llevan el TOKEN del cobro de MaKo: los dos vuelven en el
 * aviso, y son lo que ata el pago a su cobro (el equivalente del `external_reference` de Mercado Pago y del
 * `metadata.mako_cobro` de Stripe).
 *
 * ⚠️ El link NO vence (no hay campo de vencimiento en `CreateCheckoutRequest`), así que `venceAt` es null y
 * `urlParaPagar` devuelve el que ya está guardado sin rehacer nada. Un `status: 'expired'` existe del lado de Creem,
 * pero no lo fija el que crea el checkout.
 */
export async function crearCheckoutCreem(
  key: string,
  p: { idem: string; productoId: string; token: string; email?: string | null; nombre?: string | null; successUrl: string; codigoDescuento?: string | null },
): Promise<R<{ id: string; url: string }>> {
  const r = await llamar(key, 'POST', '/checkouts', {
    product_id: p.productoId,
    request_id: p.token,
    success_url: p.successUrl,
    metadata: { mako_cobro: p.token },
    // `customer.email` es el email precargado. La doc avisa: «You may only specify one of these parameters: id, email».
    ...(p.email ? { customer: { email: p.email, ...(p.nombre ? { name: p.nombre.slice(0, 120) } : {}) } } : {}),
    ...(p.codigoDescuento ? { discount_code: p.codigoDescuento } : {}),
  }, p.idem);
  if (!r.ok) return fallo(r);
  const id = str(r.body.id);
  const url = str(r.body.checkout_url);
  if (!id || !url) return { ok: false, status: 502, error: 'Creem no devolvió el link del pago.' };
  return { ok: true, id, url };
}

export type CheckoutCreem = {
  id: string; estado: string | null; suscripcionId: string | null; pedidoId: string | null;
  transaccionId: string | null; email: string | null; referencia: string | null; monto: number | null; moneda: string | null;
};

/** `GET /v1/checkouts?checkout_id=…` — por QUERY, como la suscripción. */
export async function leerCheckoutCreem(key: string, id: string): Promise<R<CheckoutCreem>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de checkout inválido' };
  const r = await llamar(key, 'GET', `/checkouts?checkout_id=${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  const b = r.body;
  const pedido = obj(b.order);
  const sus = obj(b.subscription);
  return {
    ok: true,
    id: str(b.id) ?? id,
    estado: str(b.status),
    // La suscripción y el pedido pueden venir como objeto o como id suelto.
    suscripcionId: str(sus.id) ?? str(b.subscription),
    pedidoId: str(pedido.id) ?? str(b.order),
    transaccionId: str(pedido.transaction) ?? null,
    email: str(obj(b.customer).email),
    referencia: str(b.request_id) ?? str(obj(b.metadata).mako_cobro),
    // `amount` es SIN impuesto: es lo que cobra el plan, y es lo que MaKo asienta.
    monto: montoDeCreem(pedido.amount) ?? montoDeCreem(pedido.sub_total),
    moneda: str(pedido.currency)?.toUpperCase() ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suscripciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los estados de una suscripción de Creem (`SubscriptionStatus`, enum del OpenAPI). Son SIETE.
 *
 * ⚠️ `incomplete` NO está en el enum pero SÍ en la prosa de la doc de features, y hay un evento
 * `subscription.expired` cuyo ejemplo oficial llega con `status: "active"`. Por eso el estado se lee SIEMPRE de
 * `object.status` y nunca se deduce del nombre del evento, y este tipo deja pasar un valor desconocido.
 */
export const ESTADOS_SUSCRIPCION_CREEM = ['active', 'canceled', 'unpaid', 'paused', 'trialing', 'scheduled_cancel', 'past_due'] as const;

export type SuscripcionCreem = {
  id: string; estado: string | null; referencia: string | null; productoId: string | null;
  email: string | null; proximoCobro: string | null; finDelPeriodo: string | null; canceladaAt: string | null;
  /** El precio de su producto, en unidades de la moneda. null = el producto vino como un id suelto: NO quiere decir «cero». */
  montoProducto: number | null;
  clienteId: string | null; creadaAt: string | null;
  /** La transacción que se acaba de pagar: «The ID of the last paid transaction». */
  ultimaTransaccionId: string | null;
};

const suscripcionDe = (b: Json, id: string): SuscripcionCreem => ({
  id: str(b.id) ?? id,
  estado: str(b.status),
  referencia: str(obj(b.metadata).mako_cobro) ?? str(b.request_id),
  productoId: str(obj(b.product).id) ?? str(b.product),
  email: str(obj(b.customer).email),
  proximoCobro: str(b.next_transaction_date),
  finDelPeriodo: str(b.current_period_end_date),
  canceladaAt: str(b.canceled_at),
  montoProducto: montoDeCreem(obj(b.product).price),
  clienteId: str(obj(b.customer).id) ?? str(b.customer),
  creadaAt: str(b.created_at),
  ultimaTransaccionId: str(b.last_transaction_id) ?? str(obj(b.last_transaction).id),
});

/** ⚠️ `GET /v1/subscriptions?subscription_id=…`: por QUERY STRING. `/v1/subscriptions/{id}` no existe. */
export async function leerSuscripcionCreem(key: string, id: string): Promise<R<SuscripcionCreem>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamar(key, 'GET', `/subscriptions?subscription_id=${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  return { ok: true, ...suscripcionDe(r.body, id) };
}

/**
 * Cancela. `alFinDelPeriodo` elige entre los dos modos de Creem:
 *   · false → `{ mode: 'immediate' }`: se corta ya, el estado queda `canceled`.
 *   · true  → `{ mode: 'scheduled' }`: sigue activa hasta `current_period_end_date` y recién ahí pasa a `canceled`.
 *             El estado intermedio es `scheduled_cancel`, y se puede revertir con `/resume`.
 *
 * ⚠️ `mode` SE MANDA SIEMPRE: sin él, el default sale de la configuración de la tienda en el panel de Creem, y entonces
 * qué hace «dar de baja» dependería de una pantalla y no del código.
 */
export async function cancelarSuscripcionCreem(key: string, id: string, idem: string, alFinDelPeriodo: boolean): Promise<R<{ estado: string | null; finDelPeriodo: string | null }>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamar(key, 'POST', `/subscriptions/${encodeURIComponent(id)}/cancel`, {
    mode: alFinDelPeriodo ? 'scheduled' : 'immediate',
    // `onExecute` sólo lo mira el modo `scheduled` («ignored when mode is immediate»). camelCase: así está en el OpenAPI.
    ...(alFinDelPeriodo ? { onExecute: 'cancel' } : {}),
  }, idem);
  if (!r.ok) return fallo(r);
  return { ok: true, estado: str(r.body.status), finDelPeriodo: str(r.body.current_period_end_date) };
}

/**
 * Pausa o reanuda. Ninguno de los dos lleva cuerpo. Si Creem contesta que no, se RELEE: un reintento sobre una suscripción
 * que ya quedó así (la respuesta anterior se perdió) no es una falla, y sin esto el cron reintentaría para siempre.
 */
async function estadoDePausaCreem(key: string, id: string, accion: 'pause' | 'resume', quedaEn: string, idem: string): Promise<R<{ estado: string | null }>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamar(key, 'POST', `/subscriptions/${encodeURIComponent(id)}/${accion}`, undefined, idem);
  if (r.ok) return { ok: true, estado: str(r.body.status) };
  const s = await leerSuscripcionCreem(key, id);
  return s.ok && s.estado === quedaEn ? { ok: true, estado: s.estado } : fallo(r);
}
export const pausarSuscripcionCreem = (key: string, id: string, idem: string) => estadoDePausaCreem(key, id, 'pause', 'paused', idem);
export const reanudarSuscripcionCreem = (key: string, id: string, idem: string) => estadoDePausaCreem(key, id, 'resume', 'active', idem);

/**
 * Cambia de plan (subir/bajar). `cobrarDiferencia`: `proration-charge-immediately` cobra la diferencia ya, y si no pasa la
 * suscripción no cambia; `proration-none` deja el precio nuevo para el próximo período, sin cobrar ni devolver nada.
 */
export async function cambiarPlanSuscripcionCreem(
  key: string, id: string, productoId: string, idem: string, cobrarDiferencia = true,
): Promise<R<{ estado: string | null }>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de suscripción inválido' };
  const r = await llamar(key, 'POST', `/subscriptions/${encodeURIComponent(id)}/upgrade`, {
    product_id: productoId, update_behavior: cobrarDiferencia ? 'proration-charge-immediately' : 'proration-none',
  }, idem);
  if (!r.ok) return fallo(r);
  return { ok: true, estado: str(r.body.status) };
}

/** Un status con el que no se sabe si Creem aplicó el pedido: no contestó, o se cayó. */
export const sinConfirmarCreem = (status: number): boolean => status === 0 || status >= 500;

/**
 * LO QUE COBRA UNA SUSCRIPCIÓN YA ABIERTA. Creem no tiene un precio en línea ni un descuento sobre una suscripción abierta:
 * el precio ES el del producto, así que cambiarlo es crear un producto a ese precio y pasarla a él.
 *
 * `yaEstaba`: si ya cobra ese monto no se le pide nada, y un reintento después de un corte no cobra otra vez la diferencia.
 * ⚠️ Sólo sobre una ACTIVA: en una pausada, vencida o con la baja agendada, el cambio movería lo que no corresponde.
 */
export async function cambiarPrecioCreem(
  key: string, id: string, p: { monto: number; moneda: string; nombre: string; idem: string; cobrarDiferencia: boolean },
): Promise<R<{ yaEstaba: boolean; monto: number }>> {
  const s = await leerSuscripcionCreem(key, id);
  if (!s.ok) return fallo(s);
  if (s.montoProducto != null && Math.round(s.montoProducto * 100) === Math.round(p.monto * 100)) return { ok: true, yaEstaba: true, monto: p.monto };
  if (s.estado !== 'active') return { ok: false, status: 409, error: `La suscripción está en ${s.estado ?? 'un estado desconocido'}: no se le cambia el precio.` };
  const prod = await crearProductoCreem(key, { idem: `prod-${p.idem}`, nombre: p.nombre, monto: p.monto, moneda: p.moneda, recurrente: true });
  if (!prod.ok) return fallo(prod);
  const r = await cambiarPlanSuscripcionCreem(key, id, prod.id, p.idem, p.cobrarDiferencia);
  if (!r.ok) {
    // Un corte o un 5xx no dice que no pasó: se relee antes de decir «tu plan sigue igual» a quien ya pagó la diferencia.
    if (!sinConfirmarCreem(r.status)) return fallo(r);
    const otra = await leerSuscripcionCreem(key, id);
    const tomo = otra.ok && otra.montoProducto != null && Math.round(otra.montoProducto * 100) === Math.round(p.monto * 100);
    return tomo ? { ok: true, yaEstaba: false, monto: p.monto } : fallo(r);
  }
  return { ok: true, yaEstaba: false, monto: p.monto };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transacciones — la reconciliación (el cron que recoge lo que el aviso perdió)
// ─────────────────────────────────────────────────────────────────────────────

export type TransaccionCreem = {
  /** `TransactionStatus`: paid, refunded, partialRefund, chargedBack, declined… */
  id: string; estado: string | null; monto: number | null; montoPagado: number | null; impuesto: number | null;
  moneda: string | null; suscripcionId: string | null; pedidoId: string | null; fecha: string | null; reembolsado: number | null;
};

const transaccionDe = (b: Json): TransaccionCreem => ({
  id: str(b.id) ?? '',
  estado: str(b.status),
  // `amount` SIN impuesto (lo que cobra el plan), `amount_paid` CON impuesto (lo que pagó la persona). MaKo asienta
  // `amount`: el impuesto lo cobra y lo remite Creem, no es ingreso de MaKo.
  monto: montoDeCreem(b.amount),
  montoPagado: montoDeCreem(b.amount_paid),
  impuesto: montoDeCreem(b.tax_amount),
  moneda: str(b.currency)?.toUpperCase() ?? null,
  suscripcionId: str(obj(b.subscription).id) ?? str(b.subscription),
  pedidoId: str(obj(b.order).id) ?? str(b.order),
  fecha: fechaDeCreem(b.created_at),
  reembolsado: montoDeCreem(b.refunded_amount),
});

/**
 * Las transacciones de UNA suscripción, para releer qué se cobró de verdad. Las pide por su cliente (lo único que filtra) y se
 * queda con las de esa suscripción: una de otra no es plata de este cobro, y sin suscripción no se puede decir que lo sea.
 * Sin orden garantizado: quien quiera la última, la ordena.
 */
export async function buscarTransaccionesCreem(key: string, suscripcionId: string, clienteId?: string | null): Promise<R<{ transacciones: TransaccionCreem[] }>> {
  let cliente = clienteId ?? null;
  if (!cliente) {
    const s = await leerSuscripcionCreem(key, suscripcionId);
    if (!s.ok) return fallo(s);
    cliente = s.clienteId;
  }
  // Sin cliente, se mira igual y se filtra abajo: puede no estar, pero no se atribuye la de nadie más.
  const transacciones: TransaccionCreem[] = [];
  for (let pagina = 1; ; pagina++) {
    const q = new URLSearchParams({ page_size: '100', page_number: String(pagina), ...(cliente ? { customer_id: cliente } : {}) });
    const r = await llamar(key, 'GET', `/transactions/search?${q.toString()}`);
    if (!r.ok) return fallo(r);
    const items = Array.isArray(r.body.items) ? r.body.items : [];
    transacciones.push(...items.map((x) => transaccionDe(obj(x))).filter((t) => t.suscripcionId === suscripcionId));
    const total = num(obj(r.body.pagination).total_pages) ?? 1;
    if (pagina >= total) return { ok: true, transacciones };
    // Mirar sólo una parte daría «no pagó» por algo que no se leyó: mejor decir que no se pudo.
    if (pagina >= PAGINAS_DE_TRANSACCIONES) return { ok: false, status: 0, error: `Más de ${PAGINAS_DE_TRANSACCIONES} páginas de transacciones de un cliente.` };
  }
}

const PAGINAS_DE_TRANSACCIONES = 10;

/** Una transacción por su id (`GET /v1/transactions?transaction_id=`). Lo que dice un aviso se relee acá. */
export async function leerTransaccionCreem(key: string, id: string): Promise<R<TransaccionCreem>> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return { ok: false, status: 400, error: 'id de transacción inválido' };
  const r = await llamar(key, 'GET', `/transactions?transaction_id=${encodeURIComponent(id)}`);
  if (!r.ok) return fallo(r);
  return { ok: true, ...transaccionDe(r.body) };
}

/** El link del portal de cliente de Creem, donde cambia su tarjeta: `POST /v1/customers/billing`. */
export async function portalDeClienteCreem(key: string, clienteId: string): Promise<R<{ url: string }>> {
  const r = await llamar(key, 'POST', '/customers/billing', { customer_id: clienteId });
  if (!r.ok) return fallo(r);
  const url = str(r.body.customer_portal_link);
  return url ? { ok: true, url } : { ok: false, status: 502, error: 'Creem no devolvió el link del portal.' };
}

// ─────────────────────────────────────────────────────────────────────────────
// El aviso (webhook): MaKo lo registra y se queda con el secreto — como Stripe
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Los eventos que le pedimos a Creem. La lista completa de la doc tiene 17; éstos son los del ciclo de una suscripción
 * más el checkout y los dos de plata que vuelve.
 *
 * ⚠️ `subscription.active` NO se usa para dar acceso: la propia doc dice «Use only for synchronization, we encourage
 * using `subscription.paid` for activating access». `subscription.paid` es el que «fires for the first payment and
 * every renewal», o sea el alta Y la renovación.
 */
export const EVENTOS_CREEM = [
  'checkout.completed',
  'subscription.paid',
  'subscription.canceled',
  'subscription.scheduled_cancel',
  'subscription.past_due',
  'subscription.unpaid',
  'subscription.expired',
  'subscription.trialing',
  'refund.created',
  'dispute.created',
] as const;

export type WebhookCreem = { id: string; url: string | null; secreto: string | null };

/**
 * Registra (o reusa) el endpoint de aviso de MaKo en la cuenta, y devuelve su id y su SECRETO.
 *
 * El secreto vuelve SÓLO al crear; para uno que ya existe se pide con `GET /v1/webhooks/{id}/secret`. Por eso esto
 * busca primero el que ya apunta a nuestra URL y le pide el secreto, en vez de crear otro: crear uno nuevo por cada
 * «guardar» dejaría la cuenta llena de endpoints y a MaKo con el secreto del último.
 *
 * El `id` (`wh_…`) es ADEMÁS el identificador de ruteo de la cuenta (ver `probarClaveCreem`): viaja en la URL del aviso
 * como `?w=<id>` y es lo que dice de qué negocio es cada evento.
 *
 * ⚠️ EL `?w=` SE ESCRIBE ACÁ, con un PATCH, porque el id no existe hasta crearlo (31/10/2026). Los comentarios decían que la URL
 * guardada lo llevaba y ningún código lo hacía: la ruta rechazaba con 401 TODOS los avisos, y Creem abandona a las 24 h. Ningún
 * pago habría entrado nunca. Si no se puede escribir se falla la conexión, como sin secreto. También repara una ya registrada.
 */
export async function asegurarWebhookCreem(key: string, url: string): Promise<R<WebhookCreem>> {
  const lista = await llamar(key, 'GET', '/webhooks?page_size=100');
  if (!lista.ok) return fallo(lista);
  const items = Array.isArray(lista.body.items) ? lista.body.items : [];
  // Nuestro endpoint es el que apunta a esta URL exacta (sin el query de ruteo, que lo agrega MaKo al registrarlo).
  const mio = items.map(obj).find((x) => {
    const u = str(x.url) ?? '';
    return u === url || u.split('?')[0] === url.split('?')[0];
  });
  // La URL de ESE endpoint, con su id para rutear. Sin esto el aviso llega sin `?w=` y se rechaza.
  const conRuteo = async (id: string, actual: string | null): Promise<R<{ url: string }>> => {
    const destino = `${url.split('?')[0]}?w=${encodeURIComponent(id)}`;
    if (actual === destino) return { ok: true, url: destino };
    const p = await llamar(key, 'PATCH', `/webhooks/${encodeURIComponent(id)}`, { url: destino });
    return p.ok ? { ok: true, url: destino } : fallo(p);
  };
  if (mio) {
    const id = str(mio.id);
    if (!id) return { ok: false, status: 502, error: 'Creem devolvió un aviso sin id.' };
    const s = await llamar(key, 'GET', `/webhooks/${encodeURIComponent(id)}/secret`);
    if (!s.ok) return fallo(s);
    const secreto = str(s.body.secret);
    if (!secreto) return { ok: false, status: 502, error: 'Creem no devolvió el secreto del aviso.' };
    const u = await conRuteo(id, str(mio.url));
    if (!u.ok) return fallo(u);
    return { ok: true, id, url: u.url, secreto };
  }
  const r = await llamar(key, 'POST', '/webhooks', { url, events: [...EVENTOS_CREEM] });
  if (!r.ok) return fallo(r);
  const id = str(r.body.id);
  const secreto = str(r.body.secret);
  if (!id) return { ok: false, status: 502, error: 'Creem no devolvió el id del aviso.' };
  // Sin secreto no se puede verificar NADA: es mejor fallar la conexión que dejar una cuenta conectada cuyos avisos
  // van a rebotar todos (el webhook es fail-closed a propósito).
  if (!secreto) return { ok: false, status: 502, error: 'Creem no devolvió el secreto del aviso. Sin él, los pagos no pueden entrar.' };
  const u = await conRuteo(id, str(r.body.url));
  if (!u.ok) return fallo(u);
  return { ok: true, id, url: u.url, secreto };
}

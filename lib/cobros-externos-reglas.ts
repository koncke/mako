// =============================================================================
// cobros-externos-reglas — la venta de un Payment Link PROPIO del negocio: si lo es, y qué cobro deja (27/10/2026, MAU-10)
// =============================================================================
// Mauricio vende el Sprint con un Payment Link armado en SU Stripe. El aviso llegaba y se ignoraba («no es un cobro de MaKo»):
// ni lead, ni venta, ni cuota. Ahora entra como un cobro EXTERNO ya pagado (`registrarVentaExterna`, lib/cobros.ts). El diseño y
// sus trampas: docs/diseno-venta-externa-stripe.md.
//
// ⚠️ NO PUEDE TOCAR EL COBRO DE MAKO: se llega sólo cuando `cobroDelAviso` no encontró fila, nunca en la plataforma (ahí nace la
// suscripción de MaKo), nunca con metadata de MaKo, y sólo desde un Payment Link (`plink_…`). Y cada negocio lo prende aparte
// (`INTERRUPTOR_VENTAS_EXTERNAS`, apagado por defecto).
//
// Puro (sin `server-only`): lo prueba tests/cobros-externos-reglas.test.ts.
// =============================================================================

import { deUnidadMinima } from './pasarela-moneda';
import { CUENTA_PRINCIPAL } from './cuentas-integracion';

/** La setting del negocio (app_settings) que lo prende: '1'. Apagado por defecto: lo prende MaKo, no el usuario. */
export const INTERRUPTOR_VENTAS_EXTERNAS = 'cobros.ventas_externas';
export const ventasExternasPrendidas = (v: string | null | undefined): boolean => (v ?? '').trim() === '1';

/** La marca de un cobro externo, sin migración: `creado_por` (text sin check). La lee SÓLO `esCobroExterno`. */
export const PREFIJO_EXTERNO = 'externo:stripe:';
export const esCobroExterno = (c: { creado_por?: string | null }): boolean => (c.creado_por ?? '').startsWith(PREFIJO_EXTERNO);

/** El motivo con el que se ignora una venta externa con el interruptor apagado (el webhook igual avisa la compra a Meta). */
export const MOTIVO_APAGADO = 'venta de un Payment Link propio: el registro de ventas externas está apagado en este negocio';

/** La línea fija del historial del lead cuando Meta recibió la compra: con ella, la compra no se vuelve a mandar. */
export const lineaCompraEnMeta = (eventId: string): string => `Meta recibió la compra (${eventId})`;

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const idDe = (v: unknown): string | null => str(v) ?? str(obj(v).id);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Lo que MaKo lee de una sesión de Checkout ajena (`GET /v1/checkout/sessions/:id?expand[]=line_items`). */
export type SesionExterna = {
  id: string;
  estado: string | null;
  pagoEstado: string | null;
  modo: 'real' | 'prueba';
  paymentLink: string | null;
  paymentIntent: string | null;
  subscription: string | null;
  invoice: string | null;
  /** Lo que de verdad pagó, en la moneda en que pagó. */
  monto: number | null;
  moneda: string | null;
  /** En dólares: el monto si pagó en USD, o el de origen si Stripe convirtió (`currency_conversion` desde USD). Si no, null. */
  montoUsd: number | null;
  email: string | null;
  telefono: string | null;
  nombre: string | null;
  metadata: Record<string, string>;
  /** El primer ítem: su nombre y su precio de LISTA (sin descuento: es con el que se reconoce el producto de MaKo). */
  item: { nombre: string; montoLista: number | null; monedaLista: string | null; recurrente: boolean } | null;
};

export function sesionExternaDe(cuerpo: unknown): SesionExterna {
  const b = obj(cuerpo);
  const moneda = str(b.currency)?.toUpperCase() ?? null;
  const total = num(b.amount_total);
  const monto = moneda && total != null ? deUnidadMinima(total, moneda) : null;
  const cc = obj(b.currency_conversion);
  const origen = str(cc.source_currency)?.toUpperCase() ?? null;
  const totalOrigen = num(cc.amount_total);
  const montoUsd = origen === 'USD' && totalOrigen != null ? deUnidadMinima(totalOrigen, 'USD') : moneda === 'USD' ? monto : null;
  const cd = obj(b.customer_details);
  const metadata: Record<string, string> = {};
  for (const [k, x] of Object.entries(obj(b.metadata))) if (typeof x === 'string') metadata[k] = x;
  const linea = obj((Array.isArray(obj(b.line_items).data) ? (obj(b.line_items).data as unknown[]) : [])[0]);
  const precio = obj(linea.price);
  const monedaLista = str(precio.currency)?.toUpperCase() ?? null;
  const unitario = num(precio.unit_amount);
  const nombreItem = str(linea.description);
  return {
    id: str(b.id) ?? '',
    estado: str(b.status),
    pagoEstado: str(b.payment_status),
    modo: b.livemode === true ? 'real' : 'prueba',
    paymentLink: idDe(b.payment_link),
    paymentIntent: idDe(b.payment_intent),
    subscription: idDe(b.subscription),
    invoice: idDe(b.invoice),
    monto,
    moneda,
    montoUsd: montoUsd != null && montoUsd > 0 ? montoUsd : null,
    email: str(cd.email)?.toLowerCase() ?? str(b.customer_email)?.toLowerCase() ?? null,
    telefono: str(cd.phone),
    nombre: str(cd.name),
    metadata,
    item: nombreItem
      ? { nombre: nombreItem, montoLista: monedaLista && unitario != null ? deUnidadMinima(unitario, monedaLista) : null, monedaLista, recurrente: Object.keys(obj(precio.recurring)).length > 0 }
      : null,
  };
}

/** ¿La metadata la escribió un checkout de MaKo? (lib/stripe-api.ts: `mako_cobro`, `mako_ws`, `mako_cobro_id`, `mako`). */
const metadataDeMako = (m: Record<string, string>): boolean => Object.keys(m).some((k) => k === 'mako' || k.startsWith('mako_'));

/**
 * ¿Esta sesión es una venta de un Payment Link propio que se registra? Las condiciones del diseño (§1), en orden: el apagado va
 * ÚLTIMO, así el webhook distingue «es una venta externa y está apagado» (sigue avisando la compra a Meta) de «no es una».
 */
export function esVentaExterna(p: { esPlataforma: boolean; prendido: boolean; s: SesionExterna; livemodeEvento: boolean | null | undefined }): { ok: true } | { ok: false; motivo: string } {
  if (p.esPlataforma) return { ok: false, motivo: 'en la cuenta de MaKo no se registran ventas externas' };
  if (metadataDeMako(p.s.metadata)) return { ok: false, motivo: 'la sesión es de un checkout de MaKo y no tiene su cobro' };
  if (!p.s.paymentLink) return { ok: false, motivo: 'no es un cobro de MaKo' };
  if (p.s.estado !== 'complete' || p.s.pagoEstado !== 'paid') return { ok: false, motivo: 'venta de un Payment Link propio: la sesión no está pagada' };
  if (p.livemodeEvento == null || (p.livemodeEvento ? 'real' : 'prueba') !== p.s.modo) return { ok: false, motivo: 'venta de un Payment Link propio: el modo del aviso no es el de la sesión' };
  if (!p.prendido) return { ok: false, motivo: MOTIVO_APAGADO };
  return { ok: true };
}

/** Lo que se INSERTA (sin `token`, `lead_id` ni `producto_id`: los pone `registrarVentaExterna`). */
export type FilaVentaExterna = {
  proveedor: 'stripe'; modo: 'real' | 'prueba'; tipo: 'unico' | 'suscripcion'; concepto: string; monto: number; moneda: string;
  monto_usd: number | null; email: string | null; nombre: string | null; estado: 'pagado'; pagado_at: string;
  proveedor_ref: string; proveedor_pago_id: string; proveedor_suscripcion_id: string | null; suscripcion_estado: 'activa' | null;
  creado_por: string; cuenta?: string; cuenta_ref: string | null;
};

/**
 * La fila del cobro externo, o por qué no se puede registrar. ⚠️ `cuenta` NO se escribe para la principal: `'principal'` viola
 * `cobros_cuenta_check` (0328) y el aviso se perdía con un 200. El pago es el `pi_` en un pago único y el `in_` en una
 * suscripción (la regla de `confirmarCheckout`, lib/cobros-eventos.ts): una suscripción sin factura no se registra (queda dicha).
 */
export function filaDeVentaExterna(
  s: SesionExterna, quien: { cuenta: string; ref: string | null }, pagadoAt: string,
): { ok: true; fila: FilaVentaExterna } | { ok: false; motivo: string } {
  if (s.monto == null || !(s.monto > 0) || !s.moneda || !/^[A-Z]{3}$/.test(s.moneda)) return { ok: false, motivo: 'venta de un Payment Link propio: sin monto o sin moneda' };
  if (!s.paymentLink || !s.id) return { ok: false, motivo: 'no es un cobro de MaKo' };
  const tipo = s.subscription ? 'suscripcion' : 'unico';
  const pago = tipo === 'suscripcion' ? s.invoice : s.paymentIntent;
  if (!pago) return { ok: false, motivo: tipo === 'suscripcion' ? 'venta de un Payment Link propio: la suscripción no trae factura' : 'venta de un Payment Link propio: la sesión no trae el pago' };
  return {
    ok: true,
    fila: {
      proveedor: 'stripe', modo: s.modo, tipo,
      concepto: (s.item?.nombre ?? 'Venta por link de pago').slice(0, 200),
      monto: s.monto, moneda: s.moneda, monto_usd: s.montoUsd,
      email: s.email ? s.email.slice(0, 320) : null, nombre: s.nombre ? s.nombre.slice(0, 200) : null,
      estado: 'pagado', pagado_at: pagadoAt,
      proveedor_ref: s.id, proveedor_pago_id: pago,
      proveedor_suscripcion_id: tipo === 'suscripcion' ? s.subscription : null, suscripcion_estado: tipo === 'suscripcion' ? 'activa' : null,
      creado_por: `${PREFIJO_EXTERNO}${s.paymentLink}`,
      ...(quien.cuenta !== CUENTA_PRINCIPAL ? { cuenta: quien.cuenta } : {}),
      cuenta_ref: quien.ref,
    },
  };
}

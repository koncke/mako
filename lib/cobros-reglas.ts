// =============================================================================
// cobros-reglas — las decisiones de la pasarela que se pueden probar sin base ni proveedor
// =============================================================================
// Puro y SIN `server-only`: lo ejecuta tests/cobros-reglas.test.ts. lib/cobros.ts (que habla con la
// base y con Stripe / Mercado Pago) sólo orquesta; lo que DECIDE vive acá.
//
// ⚠️ SIN `node:crypto` A PROPÓSITO: este módulo lo puede importar un componente 'use client', y un
// import de node lo arrastra al bundle del navegador (precedente: app/login/EntrarAlumno.tsx). El token
// al azar del cobro se genera en lib/cobros.ts, que es server-only.

import type { EstadoCobro, Pasarela, TipoCobro } from './cobros-tipos';
import { NOMBRE_PASARELA } from './cobros-tipos';
import { formatoMonto } from './pasarela-moneda';

/**
 * El valor en DÓLARES de un cobro, para los reportes y la cuota del CRM (`pagos.monto_usd`).
 * USD → el monto. Otra moneda → lo que declaró quien creó el link, o el precio en USD del producto
 * del catálogo. Si nadie lo dijo, null: NUNCA una tasa inventada (AGENTS.md «Un campo con una moneda
 * en el NOMBRE»; tests/moneda-meta.test.ts prohíbe TIPO_DE_CAMBIO_USD_MXN en los lectores).
 */
export function montoUsdDelCobro(p: { monto: number; moneda: string; montoUsdDeclarado?: number | null; productoMontoUsd?: number | null }): number | null {
  if (p.moneda.toUpperCase() === 'USD') return redondear(p.monto);
  // ⚠️ SÓLO LO DECLARADO (revisión del 11/10/2026). Tomar el precio del producto daba `monto_usd = 2000` a una
  // seña de ARS 50.000 sobre un programa de US$ 2.000, y la seña sumaba US$ 2.000 al cash. El precio del
  // producto se OFRECE en la pantalla como valor sugerido; lo confirma la persona.
  const declarado = Number(p.montoUsdDeclarado);
  if (Number.isFinite(declarado) && declarado > 0) return redondear(declarado);
  return null;
}

const redondear = (n: number): number => Math.round(n * 100) / 100;

/**
 * El valor en dólares de UNA cuota que confirmó la pasarela. La primera vale lo del cobro; una
 * renovación trae su propio monto (puede cambiar el precio), y en USD se toma ése. En otra moneda se
 * usa el valor en USD del cobro: es lo único declarado.
 */
export function montoUsdDeLaCuota(p: { montoCuota?: number | null; monedaCuota?: string | null; cobroMontoUsd: number | null }): number | null {
  const m = Number(p.montoCuota);
  if ((p.monedaCuota ?? '').toUpperCase() === 'USD' && Number.isFinite(m) && m > 0) return redondear(m);
  return p.cobroMontoUsd;
}

/**
 * ¿La suscripción del lead la cobra la pasarela? Un cobro de suscripción PAGADO y no cancelado. Es la condición con
 * que se niega cancelar a mano una suscripción (la ficha y la API) y cambiarle el tipo, la mensualidad o el plazo
 * desde el CRM (`escribirVenta`, lib/pagos.ts): el CRM diría una cosa mientras la tarjeta se sigue cobrando otra.
 */
export function laCobraLaPasarela(cobros: ReadonlyArray<{ tipo: string; estado: string; suscripcion_estado?: string | null }>): boolean {
  return cobros.some((c) => c.tipo === 'suscripcion' && c.estado === 'pagado' && c.suscripcion_estado !== 'cancelada');
}

/**
 * Desde qué estados un pago confirmado deja el cobro en `pagado`. `anulado` entra: si alguien pagó
 * un link que se anuló (el cierre del lado de la pasarela puede fallar, o el pago ya estaba en curso), la
 * plata ENTRÓ, y esconderla sería peor: entra CON el aviso de `avisoPagoPorLinkAnulado`. `reembolsado` no:
 * un «aprobado» que llega después de un reembolso es una reentrega vieja.
 */
export const ESTADOS_QUE_PASAN_A_PAGADO: readonly EstadoCobro[] = ['pendiente', 'fallido', 'anulado'];
export const pasaAPagado = (e: EstadoCobro): boolean => ESTADOS_QUE_PASAN_A_PAGADO.includes(e);

/**
 * ⚠️ UN PAGO POR UN LINK ANULADO (15/10/2026). Se anula un link porque la cuota se cobró por otro lado, o porque el
 * cobro cambió; si igual entra un pago por ahí, se registra (la plata entró) y esto queda en el cobro y en el
 * historial del lead. Si la cuota del link ya estaba cobrada, la plata entró DOS veces y se dice así: hasta este día
 * entraba como una cuota cobrada más y nadie se enteraba.
 */
export function avisoPagoPorLinkAnulado(cuotaYaCobrada: boolean): string {
  return cuotaYaCobrada
    ? 'Se pagó por un link ANULADO y su cuota ya estaba cobrada: la plata entró dos veces. Devuelve uno de los dos pagos.'
    : 'Se pagó por un link ANULADO: revisa que no lo hayas cobrado por otro lado.';
}

/** Por qué falló una devolución de Stripe (`failure_reason` de la Refund), en palabras. Lo que no se conoce no se inventa. */
const RAZON_DEVOLUCION_FALLIDA: Readonly<Record<string, string>> = {
  lost_or_stolen_card: 'la tarjeta está denunciada',
  expired_or_canceled_card: 'la tarjeta venció o se dio de baja',
  charge_for_pending_refund_disputed: 'el cliente abrió una disputa por ese cargo',
  insufficient_funds: 'no había saldo en la cuenta de Stripe',
  declined: 'el banco la rechazó',
  merchant_request: 'se canceló desde la cuenta de Stripe',
};

/**
 * ⚠️ UNA DEVOLUCIÓN DE STRIPE PUEDE FALLAR DESPUÉS (15/10/2026). Se crea `pending` o `succeeded` y días después pasa a
 * `failed`: Stripe devuelve la plata al saldo del negocio y el cargo vuelve a estar cobrado. MaKo la daba por hecha
 * para siempre. `sigueDevuelto`: el cargo sigue devuelto por OTRA devolución, y entonces no se revierte nada.
 */
/** ¿Este `motivo` es el de una devolución que falló (`textoDevolucionFallida`)? */
export const esDevolucionFallida = (motivo: string | null | undefined): boolean =>
  typeof motivo === 'string' && /^(?:La|Una) devolución falló en Stripe/.test(motivo);

export function textoDevolucionFallida(p: { razon: string | null; sigueDevuelto: boolean }): string {
  const por = p.razon && RAZON_DEVOLUCION_FALLIDA[p.razon] ? ` (${RAZON_DEVOLUCION_FALLIDA[p.razon]})` : '';
  return p.sigueDevuelto
    ? `Una devolución falló en Stripe${por}; el cargo sigue devuelto por otra.`
    : `La devolución falló en Stripe${por}: la plata sigue cobrada.`;
}

/** Lo que dice el cliente en una disputa de Stripe (`reason`), en palabras. Lo que no se conoce no se inventa. */
const RAZON_DISPUTA: Readonly<Record<string, string>> = {
  fraudulent: 'dice que no reconoce la compra',
  unrecognized: 'no reconoce el cargo',
  product_not_received: 'dice que no recibió lo que compró',
  product_unacceptable: 'dice que lo que recibió no era lo prometido',
  duplicate: 'dice que se le cobró dos veces',
  subscription_canceled: 'dice que había cancelado la suscripción',
  credit_not_processed: 'dice que no le hicieron una devolución prometida',
};

/**
 * ⚠️ UN CONTRACARGO SE CUENTA (15/10/2026): hasta este día quedaba sólo en una fila de `pasarela_eventos`. El texto va al
 * historial del lead y al motivo del cobro. La fase (lib/cobros-eventos.ts, FaseContracargo) dice qué pasó con la plata.
 */
/**
 * ¿Este `motivo` es uno de `textoContracargo`? La tab Pagos lo dibuja como AVISO y no en letra chica (16/10/2026). Se
 * reconoce por cómo empieza cada fase: si una frase de abajo cambia, tests/pagos-vistazo.test.ts las recorre todas.
 */
export const esTextoDeContracargo = (motivo: string | null | undefined): boolean =>
  typeof motivo === 'string' &&
  /^(?:El cliente disputó este cargo|(?:Stripe|Mercado Pago) (?:descontó|devolvió) la plata de la disputa|(?:Stripe|Mercado Pago) descontó la plata por la disputa|La disputa se |La consulta del banco|Contracargo en Mercado Pago)/.test(motivo);

export function textoContracargo(p: { pasarela: Pasarela; fase: 'abierto' | 'plata_salio' | 'plata_volvio' | 'cerrado' | 'mp'; estado?: string | null; razon?: string | null }): string {
  const nombre = NOMBRE_PASARELA[p.pasarela];
  const razon = p.razon && RAZON_DISPUTA[p.razon] ? ` (${RAZON_DISPUTA[p.razon]})` : '';
  switch (p.fase) {
    case 'abierto':
      return `El cliente disputó este cargo con su banco${razon}: ${nombre} abrió una disputa.`;
    case 'plata_salio':
      return `${nombre} descontó la plata por la disputa${razon}: el pago queda como no cobrado mientras se resuelve.`;
    case 'plata_volvio':
      return `${nombre} devolvió la plata de la disputa: el pago vuelve a estar cobrado.`;
    case 'cerrado':
      if (p.estado === 'won') return 'La disputa se ganó: la plata queda cobrada.';
      if (p.estado === 'lost') return 'La disputa se perdió: la plata no vuelve.';
      if (p.estado === 'warning_closed') return 'La consulta del banco se cerró sin disputa.';
      return `La disputa se cerró${p.estado ? ` (${p.estado})` : ''}.`;
    case 'mp':
      return p.estado === 'in_process'
        ? 'Contracargo en Mercado Pago: el cliente desconoció el pago con su banco y está en revisión. Revísalo en tu cuenta de Mercado Pago.'
        : `Contracargo en Mercado Pago${p.estado ? ` (${p.estado})` : ''}: revisa en tu cuenta de Mercado Pago cómo quedó la plata.`;
  }
}

/**
 * La parte del MRR que cobra la PASARELA (decidido el 15/10/2026, copia de Stripe: el MRR son las suscripciones activas):
 * las suscripciones activas de un lead que NO es «de suscripción» (uno que compró como pago único y después se
 * suscribió). Las de un lead de suscripción no se suman: ya las cuenta el lead, con su plazo (`getMrrActivo`,
 * lib/queries.ts), y serían dos veces. Una sin monto en USD no se inventa.
 */
export function mrrDeLaPasarela(
  cobros: ReadonlyArray<{ lead_id: number | string | null; monto_usd: number | string | null }>,
  leadsDeSuscripcion: ReadonlySet<number>,
): { mrr: number; activas: number } {
  let mrr = 0;
  let activas = 0;
  for (const c of cobros) {
    const monto = Number(c.monto_usd);
    if (c.lead_id == null || !(monto > 0) || leadsDeSuscripcion.has(Number(c.lead_id))) continue;
    mrr += monto;
    activas++;
  }
  return { mrr, activas };
}

/**
 * El fin del PLAZO de una suscripción (15/10/2026): `meses` meses después del arranque, a la misma hora, con el día capado
 * al último del mes (como factura Stripe una suscripción que arrancó un 31). Es el fin del período N: se cobran N
 * mensualidades y la N+1 no sale.
 */
export function finDelPlazo(inicioMs: number, meses: number): number {
  const d = new Date(inicioMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + meses;
  const ultimo = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return Date.UTC(y, m, Math.min(d.getUTCDate(), ultimo), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

/**
 * ¿Es la vuelta del cron de cobros que hace lo de UNA VEZ POR DÍA? El cron corre a los :17 y :47 de cada hora
 * (vercel.json): la de las 06:17 UTC es la única con hora 6 y minuto < 30.
 */
export const esLaVueltaDelDia = (ms: number): boolean => {
  const d = new Date(ms);
  return d.getUTCHours() === 6 && d.getUTCMinutes() < 30;
};

/**
 * «DARME DE BAJA» del plan de MaKo (15/10/2026). Hasta que Stripe la cierra al final del período, la suscripción sigue
 * `activa` (la columna tiene un CHECK con `activa`/`cancelada`), así que el pedido queda en el `motivo` del cobro con
 * este prefijo —el mismo recurso que la renovación fallida—. El CÓDIGO de baja es el comprobante que se le da a quien la
 * pide (la Resolución 316/2018 de Argentina pide uno, si aplica): uno por cobro, sin datos personales.
 */
export const PREFIJO_BAJA_PEDIDA = 'Baja pedida';
export const esBajaPedida = (motivo: string | null | undefined): boolean => typeof motivo === 'string' && motivo.startsWith(PREFIJO_BAJA_PEDIDA);
export const codigoDeBaja = (cobroId: number): string => `BAJA-${cobroId}`;
export function textoBajaPedida(p: { codigo: string; pedida: string; finAt: string | null }): string {
  const fin = p.finAt ? ` Deja de cobrarse el ${p.finAt.slice(0, 10)}.` : '';
  return `${PREFIJO_BAJA_PEDIDA} el ${p.pedida.slice(0, 10)} (código ${p.codigo}).${fin}`;
}

/** ¿Este pago confirmado es una RENOVACIÓN (otra factura de la misma suscripción) y no el primero? */
export function esRenovacion(c: { tipo: TipoCobro; proveedor_pago_id: string | null }, proveedorPagoId: string): boolean {
  return c.tipo === 'suscripcion' && !!c.proveedor_pago_id && c.proveedor_pago_id !== proveedorPagoId;
}

/**
 * Meses enteros transcurridos desde que arrancó la suscripción, mínimo 1. Cancelarla la pasa a
 * PLAZO FIJO con este número: así `getMrrActivo` (lib/queries.ts), que cuenta las de plazo fijo
 * mientras `fecha_cierre + meses >= hoy`, deja de sumarla sin una columna nueva.
 */
export function mesesTranscurridos(desdeIso: string | null | undefined, hastaIso: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(desdeIso ?? ''));
  const h = /^(\d{4})-(\d{2})-(\d{2})/.exec(hastaIso);
  if (!d || !h) return 1;
  let meses = (Number(h[1]) - Number(d[1])) * 12 + (Number(h[2]) - Number(d[2]));
  if (Number(h[3]) < Number(d[3])) meses -= 1;
  return Math.max(1, meses);
}

/** ¿La sesión de Stripe vence (o venció) dentro del margen? Sin fecha = hay que crear otra. */
export function urlPorVencer(venceAtIso: string | null | undefined, ahoraMs: number, margenMin = 5): boolean {
  if (!venceAtIso) return true;
  const t = Date.parse(venceAtIso);
  return !Number.isFinite(t) || t - ahoraMs < margenMin * 60_000;
}

/** Las claves de idempotencia, DETERMINÍSTICAS: la misma operación sobre el mismo cobro manda la misma. */
export const idemCobro = (cobroId: number, vuelta = 0): string => (vuelta ? `mako-cobro-${cobroId}-${vuelta}` : `mako-cobro-${cobroId}`);
/**
 * ⚠️ La clave del reembolso es la del cobro, así una confirmación repetida no devuelve dos veces. Pero después de una
 * devolución FALLIDA, la misma clave dentro de las 24 h le devolvería a MaKo la respuesta vieja SIN crear otra
 * devolución: el reintento lleva el `updated_at` del cobro que dejó la falla (`reintento`).
 */
export const idemReembolso = (cobroId: number, reintento?: string | null): string =>
  (reintento ? `mako-reembolso-${cobroId}-${reintento}` : `mako-reembolso-${cobroId}`);
export const idemBaja = (cobroId: number): string => `mako-baja-${cobroId}`;
export const idemAnular = (cobroId: number): string => `mako-anular-${cobroId}`;

export type ParametrosCobro = {
  pasarela?: Pasarela | null;
  conectadas: readonly Pasarela[];
  monto?: number | null;
  moneda?: string | null;
  productoMontoUsd?: number | null;
  monedaDeLaCuenta?: string | null;  // Mercado Pago: la del sitio de la cuenta
  tipo: TipoCobro;
  email?: string | null;
};

export type DecisionCobro =
  | { ok: true; pasarela: Pasarela; monto: number; moneda: string }
  | { ok: false; error: string; faltan?: string[] };

/**
 * Qué pasarela, qué monto y qué moneda. Las reglas:
 *   · sin pasarela elegida y UNA conectada → ésa; con dos → hay que elegir; con ninguna → conectar.
 *   · Stripe cobra en USD por defecto (el catálogo está en USD); Mercado Pago, en la moneda de su
 *     sitio — y ahí el monto tiene que venir EXPLÍCITO si no es USD: un precio en dólares no se
 *     convierte solo a pesos.
 *   · una suscripción de Mercado Pago necesita el email de quien paga (MP lo exige y lo valida).
 */
export function decidirCobro(p: ParametrosCobro): DecisionCobro {
  let pasarela = p.pasarela ?? null;
  if (!pasarela) {
    if (p.conectadas.length === 1) pasarela = p.conectadas[0];
    else if (p.conectadas.length === 0) return { ok: false, error: 'Conecta Stripe o Mercado Pago en Integraciones para cobrar.' };
    else return { ok: false, error: 'Elige con qué pasarela cobrar.', faltan: ['pasarela'] };
  }
  if (!p.conectadas.includes(pasarela)) return { ok: false, error: `${NOMBRE_PASARELA[pasarela]} no está conectado en Integraciones.` };

  const porDefecto = pasarela === 'stripe' ? 'USD' : (p.monedaDeLaCuenta ?? null);
  const moneda = (p.moneda ?? porDefecto ?? '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(moneda)) return { ok: false, error: 'Falta la moneda del cobro.', faltan: ['moneda'] };

  const explicito = Number(p.monto);
  let monto: number | null = Number.isFinite(explicito) && explicito > 0 ? explicito : null;
  if (monto == null && moneda === 'USD') {
    const m = Number(p.productoMontoUsd);
    if (Number.isFinite(m) && m > 0) monto = m;
  }
  if (monto == null) return { ok: false, error: moneda === 'USD' ? 'Falta el monto.' : `Falta el monto en ${moneda}.`, faltan: ['monto'] };
  // El tope es en DÓLARES (revisión del 11/10/2026: en ARS, COP o CLP una venta normal de US$ 2.000 pasa el millón).
  if (moneda === 'USD' && monto > 1_000_000) return { ok: false, error: 'El monto es demasiado alto.' };
  if (pasarela === 'mercadopago' && p.tipo === 'suscripcion' && !p.email) {
    return { ok: false, error: 'Para una suscripción de Mercado Pago hace falta el email de quien paga.', faltan: ['email'] };
  }
  return { ok: true, pasarela, monto: redondear(monto), moneda };
}

/** El texto del historial del lead cuando entra un pago. Dice la moneda real y si fue de prueba. */
export function textoPagoRegistrado(p: { concepto: string; monto: number; moneda: string; montoUsd: number | null; pasarela: Pasarela; prueba: boolean; renovacion: boolean }): string {
  const plata = formatoMonto(p.monto, p.moneda);
  const usd = p.moneda.toUpperCase() !== 'USD' && p.montoUsd != null ? ` (US$ ${p.montoUsd})` : '';
  const que = p.renovacion ? 'Renovación' : 'Pago';
  return `${que} de ${p.concepto}: ${plata}${usd} por ${NOMBRE_PASARELA[p.pasarela]}${p.prueba ? ' (prueba)' : ''}`;
}

/** Enmascara un email para una página pública: `martin@gmail.com` → `ma***@gmail.com`. */
export function emailEnmascarado(email: string | null | undefined): string | null {
  const e = String(email ?? '').trim();
  const at = e.indexOf('@');
  if (at < 1) return null;
  return `${e.slice(0, Math.min(2, at))}***${e.slice(at)}`;
}

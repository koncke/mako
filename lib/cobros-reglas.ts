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
  const declarado = Number(p.montoUsdDeclarado);
  if (Number.isFinite(declarado) && declarado > 0) return redondear(declarado);
  const delProducto = Number(p.productoMontoUsd);
  if (Number.isFinite(delProducto) && delProducto > 0) return redondear(delProducto);
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
 * Desde qué estados un pago confirmado deja el cobro en `pagado`. `anulado` entra: si alguien pagó
 * un link que se anuló (Mercado Pago no deja expirar una preferencia ya abierta), la plata ENTRÓ, y
 * esconderla sería peor. `reembolsado` no: un «aprobado» que llega después de un reembolso es una
 * reentrega vieja.
 */
export const ESTADOS_QUE_PASAN_A_PAGADO: readonly EstadoCobro[] = ['pendiente', 'fallido', 'anulado'];
export const pasaAPagado = (e: EstadoCobro): boolean => ESTADOS_QUE_PASAN_A_PAGADO.includes(e);

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
export const idemReembolso = (cobroId: number): string => `mako-reembolso-${cobroId}`;
export const idemBaja = (cobroId: number): string => `mako-baja-${cobroId}`;

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
  if (monto > 1_000_000) return { ok: false, error: 'El monto es demasiado alto.' };
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

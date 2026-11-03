// =============================================================================
// vender-plan-reglas — lo que se valida de una venta de un plan de MaKo, PURO
// =============================================================================
// Sin `server-only`, a propósito: lo usan lib/vender-plan.ts (la pantalla de Cobros y la API de MaKo, `vender_plan_mako`)
// y tests/api-mako-vender-plan.test.ts, que lo EJECUTA. Vivía adentro de lib/vender-plan.ts, que es server-only, y ningún
// test lo podía correr: la revisión adversarial del 23/10/2026 lo encontró sólo con tests que leían el fuente.
// =============================================================================

import { esCapaVendible } from './capas';
import { codigoRefLimpio } from './compra-plan-reglas';
import { esPasarela, type Pasarela, type TipoCobro } from './cobros-tipos';
import { normalizarMoneda } from './pasarela-moneda';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type VentaPlan = {
  /** Una capa VENDIBLE (lib/capas.ts, CAPAS_VENDIBLES). `superadmin` se rechaza. */
  capa: string;
  monto: number;
  /** null = la moneda de la cuenta de la pasarela (Mercado Pago cobra en la de su sitio). */
  moneda: string | null;
  /** El valor en dólares, cuando la moneda no es USD: sin él el cobro no entra al cash del CRM. */
  montoUsd?: number | null;
  tipo: TipoCobro;
  email: string;
  nombre: string;
  /** Sólo hace falta si hay DOS pasarelas conectadas; con una, se elige sola. */
  pasarela?: Pasarela | null;
  /** El código de MaKo Partners de quien lo trajo (29/10/2026): queda en el cobro y MaKo Partners lo acredita. */
  refCodigo?: string | null;
};

/** La venta ya saneada: lo que se valida antes de tocar nada. */
export type VentaValida = {
  capa: string; monto: number; moneda: string | null; montoUsd: number | null;
  tipo: TipoCobro; email: string; nombre: string; pasarela: Pasarela | null; refCodigo: string | null;
};

/**
 * Lo que se puede saber SIN leer nada: la capa (en positivo), el email (normalizado: el alta lo usa para crear al admin),
 * el nombre, el monto, la moneda y la pasarela. Lo que depende de la base o de la pasarela (en qué moneda cobra, cuánto
 * es en dólares) lo decide `previaDeLaVenta` (lib/vender-plan.ts).
 */
export function ventaValida(v: Partial<VentaPlan> | null | undefined): { ok: true; venta: VentaValida } | { ok: false; error: string } {
  const capa = String(v?.capa ?? '').trim();
  if (!esCapaVendible(capa)) return { ok: false, error: 'Ese plan no se vende.' };
  const email = String(v?.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Revisa el email: por ahí le llega el acceso.' };
  const nombre = String(v?.nombre ?? '').trim();
  if (nombre.length < 2) return { ok: false, error: 'Falta el nombre de quien paga.' };
  const monto = Number(v?.monto);
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: 'Falta el monto.' };
  const tipo: TipoCobro = v?.tipo === 'suscripcion' ? 'suscripcion' : 'unico';
  const moneda = v?.moneda == null ? null : normalizarMoneda(v.moneda);
  if (v?.moneda != null && !moneda) return { ok: false, error: 'Esa moneda no existe.' };
  const usd = Number(v?.montoUsd);
  const pasarela = esPasarela(v?.pasarela) ? v.pasarela : null;
  const crudo = String(v?.refCodigo ?? '').trim();
  const refCodigo = codigoRefLimpio(crudo);
  if (crudo && !refCodigo) return { ok: false, error: 'Ese código de partner no es válido (letras, números y guiones).' };
  return { ok: true, venta: { capa, monto, moneda, montoUsd: Number.isFinite(usd) && usd > 0 ? usd : null, tipo, email, nombre, pasarela, refCodigo } };
}

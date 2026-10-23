// =============================================================================
// «Vincular cobro» en Ganado: lo que la pantalla dice de un producto, de una cuenta y de un producto nuevo (22/10/2026)
// =============================================================================
// Martín (22/10/2026): «Si conectamos la integración de Stripe y Mercado Pago, deberíamos poder vincular a la etapa GANADO
// en los 3 puntos, poder elegir el producto, tal como lo hacemos en "Asignar evento"... que pueda tener de MP y de Stripe
// al mismo tiempo... Y que pueda crear o editar los productos desde allí mismo». El modelo y las acciones son de Cobros
// (lib/cobro-etapa.ts y app/crm/cobro-etapa-actions.ts); el ⋯ de la columna y el modal (CobroDeEtapaModal.tsx), de acá.
// Puro: lo prueba tests/crm-cobro-ganado.test.ts.
// =============================================================================

import { MAX_CUOTAS_PRODUCTO, type CuentaPago, type FotoCobroEtapa, type ProductoCobro, type ProductoCobroInput } from '@/lib/cobro-etapa';
import type { PrecioDeStripe } from '@/lib/stripe-catalogo-reglas';
import { formatoMonto } from '@/lib/pasarela-moneda';

export const NOMBRE_PROVEEDOR_PAGO: Record<CuentaPago['proveedor'], string> = { stripe: 'Stripe', mercadopago: 'Mercado Pago' };
export const MAX_NOMBRE_PRODUCTO = 80;

const usd = (n: number) => `USD ${n.toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;

/** «USD 497» · «USD 97 al mes · 12 meses» · «USD 1.500 en 3 cuotas» · sin monto, «Sin precio». */
export function precioDeProducto(p: Pick<ProductoCobro, 'tipo' | 'montoUsd' | 'suscripcionMeses' | 'cuotas'>): string {
  if (p.montoUsd == null || !(p.montoUsd > 0)) return 'Sin precio';
  if (p.tipo === 'suscripcion') return `${usd(p.montoUsd)} al mes${p.suscripcionMeses ? ` · ${p.suscripcionMeses} ${p.suscripcionMeses === 1 ? 'mes' : 'meses'}` : ''}`;
  return p.cuotas && p.cuotas > 1 ? `${usd(p.montoUsd)} en ${p.cuotas} cuotas` : usd(p.montoUsd);
}

/** «Stripe» si es la única de su proveedor; con varias, «Stripe · Cuenta USA». */
export function nombreDeCuenta(c: CuentaPago, todas: readonly CuentaPago[]): string {
  const base = NOMBRE_PROVEEDOR_PAGO[c.proveedor];
  const varias = todas.filter((x) => x.proveedor === c.proveedor).length > 1;
  return varias ? `${base} · ${c.nombre.trim() || (c.principal ? 'Principal' : c.id)}` : base;
}

/** Los productos del catálogo que todavía no están vinculados a esta etapa: los que «+ Producto» ofrece. */
export const productosParaVincular = (foto: FotoCobroEtapa): ProductoCobro[] =>
  foto.productos.filter((p) => p.activo && !foto.vinculos.some((v) => v.productoId === p.id));

/** Lo escrito en «Crear producto» / «Editar», listo para Cobros, o el porqué no (en una línea). */
export function productoDeLoEscrito(f: { nombre: string; tipo: 'unico' | 'suscripcion'; monto: string; meses: string; cuotas: string }):
  { ok: true; input: ProductoCobroInput } | { ok: false; error: string } {
  const nombre = f.nombre.trim().slice(0, MAX_NOMBRE_PRODUCTO);
  if (!nombre) return { ok: false, error: 'Ponle un nombre al producto.' };
  const monto = Number(f.monto.replace(',', '.'));
  if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: 'El precio tiene que ser un número mayor a 0.' };
  const entero = (s: string) => (s.trim() ? Math.floor(Number(s)) : null);
  const meses = f.tipo === 'suscripcion' ? entero(f.meses) : null;
  const cuotas = f.tipo === 'unico' ? entero(f.cuotas) : null;
  if (meses != null && !(meses >= 1 && meses <= 60)) return { ok: false, error: 'Los meses van de 1 a 60 (vacío: sin fin).' };
  if (cuotas != null && !(cuotas >= 1 && cuotas <= MAX_CUOTAS_PRODUCTO)) return { ok: false, error: `Un pago único va en 1 a ${MAX_CUOTAS_PRODUCTO} cuotas.` };
  return { ok: true, input: { nombre, tipo: f.tipo, montoUsd: Math.round(monto * 100) / 100, suscripcionMeses: meses, cuotas } };
}

// ── «+ Producto» con el catálogo de Stripe (23/10/2026) ─────────────────────────
// La llamada con Mauricio: su «Sprint 3 días» está en Stripe a US$270 y en MaKo sin precio, y el pop-up decía «Este producto
// no tiene precio». Cobros lee los precios de Stripe en vivo (lib/stripe-catalogo.ts); acá, qué ofrece la lista.

/** Una opción de «+ Producto»: un producto de MaKo, un precio de Stripe (con el de MaKo que es él, si hay) o uno apagado. */
export type OpcionDeCobro =
  | { tipo: 'mako'; producto: ProductoCobro }
  | { tipo: 'stripe'; precio: PrecioDeStripe; producto: ProductoCobro | null }
  | { tipo: 'no'; precio: PrecioDeStripe };

/** «USD 270 · pago único» · «USD 97 al mes»: en su moneda (sólo se traen los de dólares). */
export const precioDeStripeTexto = (p: Pick<PrecioDeStripe, 'monto' | 'moneda' | 'tipo'>): string =>
  `${formatoMonto(p.monto, p.moneda)}${p.tipo === 'suscripcion' ? ' al mes' : ' · pago único'}`;

/**
 * Lo que ofrece «+ Producto», en orden: cada producto de MaKo que todavía no cobra acá (si Stripe tiene su precio, va en
 * la MISMA fila con el precio de Stripe: es el caso de Mauricio); después los de Stripe que no están en MaKo; al final,
 * apagados, los que no se pueden traer (`noSe`, con su porqué). Lo que ya cobra en esta etapa no se ofrece.
 */
export function opcionesDeCobro(foto: FotoCobroEtapa, precios: readonly PrecioDeStripe[]): OpcionDeCobro[] {
  const aca = new Set(foto.vinculos.map((v) => v.productoId));
  const traibles = precios.filter((p) => !p.noSe && !(p.enMako != null && aca.has(p.enMako)));
  const out: OpcionDeCobro[] = [];
  for (const producto of productosParaVincular(foto)) {
    const suyos = traibles.filter((p) => p.enMako === producto.id);
    if (!suyos.length) out.push({ tipo: 'mako', producto });
    for (const precio of suyos) out.push({ tipo: 'stripe', precio, producto });
  }
  const enMako = new Set(out.flatMap((o) => (o.tipo === 'stripe' ? [o.precio.precio] : [])));
  for (const precio of traibles) {
    if (enMako.has(precio.precio)) continue;
    out.push({ tipo: 'stripe', precio, producto: precio.enMako != null ? foto.productos.find((x) => x.id === precio.enMako) ?? null : null });
  }
  for (const precio of precios) if (precio.noSe) out.push({ tipo: 'no', precio });
  return out;
}

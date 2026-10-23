// =============================================================================
// stripe-catalogo-reglas — los productos de Stripe en «Vincular cobro» (23/10/2026, llamada con Mauricio)
// =============================================================================
// Mauricio conectó su Stripe y fue a «Vincular cobro»: su producto de US$270 no aparecía, y el «Sprint 3 días» del
// catálogo de MaKo decía «no tiene precio». Medido en el ws1: la clave andaba; MaKo NUNCA leía el catálogo de Stripe.
// Ahora el pop-up lista los precios activos de cada cuenta de Stripe conectada, y elegir uno lo trae al catálogo de MaKo
// (con su precio, leído otra vez en Stripe del lado del servidor) y lo vincula.
//
// Lo que no se ve en el código y muerde:
//   · EL CATÁLOGO DE MAKO VA EN DÓLARES (`monto_usd`): un precio en otra moneda no se trae (se dice por qué, no se esconde).
//     La cuenta de Mauricio es de México con moneda por defecto MXN, y su precio es en USD: no se mira la de la cuenta.
//   · MAKO COBRA SUSCRIPCIONES POR MES (`crearCheckoutStripe`, `recurring: { interval: 'month' }`): un precio anual o cada
//     dos meses no se puede traer tal cual.
//   · UN PRECIO QUE ELIGE QUIEN PAGA (`custom_unit_amount`) o POR ESCALONES (`tiered`) no tiene un monto que copiar.
//   · EL MISMO NOMBRE ES EL MISMO PRODUCTO: «Sprint 3 días» de MaKo y «sprint 3 días» de Stripe son uno. Traerlo de nuevo
//     no duplica: le pone el precio de Stripe al de MaKo SÓLO SI NO TENÍA (el de Mauricio). Uno que ya cobra OTRA cosa
//     no se toca (revisión adversarial del 23/10/2026): un mismo producto de Stripe con dos precios (US$600 único y
//     US$100 por mes) pisaba el vínculo de Ganado y todo link nuevo; uno en cuotas cobraba la cuota de un precio que la
//     persona no vio. Se dice el conflicto y se cambia en MaKo a mano.
//
// Puro: lo importan lib/stripe-catalogo.ts, el pop-up (los tipos) y tests/stripe-catalogo.test.ts.
// =============================================================================

import type { ProductoCobro, ProductoCobroInput } from './cobro-etapa';
import { deUnidadMinima, formatoMonto } from './pasarela-moneda';

/** Un precio de Stripe como lo devuelve la API (`GET /v1/prices?expand[]=data.product`), sólo lo que se usa. */
export type PrecioStripeCrudo = {
  id?: unknown; active?: unknown; currency?: unknown; unit_amount?: unknown; type?: unknown; billing_scheme?: unknown;
  custom_unit_amount?: unknown; recurring?: unknown; product?: unknown;
};

/** Un precio de Stripe para elegir en «Vincular cobro». */
export type PrecioDeStripe = {
  /** La cuenta de Stripe donde está (el id de `CuentaPago`: 'stripe:principal', 'stripe:c2'). */
  cuenta: string;
  cuentaNombre: string;
  /** `price_…` */
  precio: string;
  /** El nombre del producto en Stripe. */
  nombre: string;
  /** En su moneda (270) y su moneda ('USD'). */
  monto: number;
  moneda: string;
  /** null = no está en dólares. */
  montoUsd: number | null;
  tipo: 'unico' | 'suscripcion';
  /** Por qué no se puede traer; null = se puede. */
  noSe: string | null;
  /** El producto del catálogo de MaKo que es éste (por el nombre), si hay. */
  enMako: number | null;
};

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** «Sprint 3 días», «sprint 3 dias» y «Sprint  3 días » son el mismo nombre. */
export function nombreComparable(n: string): string {
  return n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const UNIDAD: Record<string, [string, string]> = { day: ['día', 'días'], week: ['semana', 'semanas'], month: ['mes', 'meses'], year: ['año', 'años'] };

/**
 * Un precio crudo de Stripe → lo que se muestra para elegir. null = no se muestra (inactivo, sin producto, producto
 * archivado o borrado). Un precio que se muestra pero no se puede traer lleva su `noSe`.
 */
export function precioDeStripe(c: PrecioStripeCrudo, cuenta: { id: string; nombre: string }): Omit<PrecioDeStripe, 'enMako'> | null {
  const id = str(c.id);
  if (!id || !id.startsWith('price_') || c.active !== true) return null;
  const prod = obj(c.product);
  // Sin expandir, `product` es un id y no hay nombre: no se inventa uno.
  const nombre = str(prod.name);
  if (!nombre || prod.active !== true || prod.deleted === true) return null;
  const moneda = (str(c.currency) ?? '').toUpperCase();
  const minima = typeof c.unit_amount === 'number' && Number.isInteger(c.unit_amount) && c.unit_amount >= 0 ? c.unit_amount : null;
  // La misma conversión que los cobros (lib/pasarela-moneda.ts): monedas sin centavos y las que Stripe pide ×100.
  const monto = minima == null || !moneda ? 0 : deUnidadMinima(minima, moneda);
  const rec = c.recurring == null ? null : obj(c.recurring);
  const tipo: 'unico' | 'suscripcion' = rec ? 'suscripcion' : 'unico';
  let noSe: string | null = null;
  if (c.custom_unit_amount != null) noSe = 'El monto lo elige quien paga: no hay un precio que traer.';
  else if (c.billing_scheme === 'tiered') noSe = 'Es un precio por escalones: no hay un precio que traer.';
  // Con fracción de centavo Stripe manda `unit_amount: null` y el monto en `unit_amount_decimal`.
  else if (minima == null) noSe = 'El precio tiene fracciones de centavo: MaKo no lo puede cobrar igual.';
  else if (minima === 0) noSe = 'El precio es cero.';
  else if (moneda !== 'USD') noSe = `Está en ${moneda || 'otra moneda'}: el catálogo de MaKo va en dólares.`;
  else if (rec && (rec.interval !== 'month' || Number(rec.interval_count ?? 1) !== 1)) {
    const n = Number(rec.interval_count ?? 1);
    const [uno, varios] = UNIDAD[String(rec.interval)] ?? ['período', 'períodos'];
    noSe = `Se cobra cada ${n === 1 ? uno : `${n} ${varios}`}: MaKo cobra las suscripciones por mes.`;
  } else if (rec && rec.usage_type === 'metered') noSe = 'Se cobra por uso: no hay un precio fijo que traer.';
  return {
    cuenta: cuenta.id, cuentaNombre: cuenta.nombre, precio: id, nombre: nombre.slice(0, 120), monto, moneda,
    montoUsd: moneda === 'USD' && minima != null ? Math.round(minima) / 100 : null, tipo, noSe,
  };
}

const mismoPrecio = (x: ProductoCobro, p: Pick<PrecioDeStripe, 'montoUsd' | 'tipo'>): boolean =>
  x.tipo === p.tipo && x.montoUsd != null && p.montoUsd != null && Math.round(x.montoUsd * 100) === Math.round(p.montoUsd * 100);

/** «US$600 · pago único», «US$100 por mes»: lo que cobra un producto de MaKo, para decir un conflicto. */
const loQueCobra = (x: ProductoCobro): string =>
  x.montoUsd == null ? 'sin precio' : `${formatoMonto(x.montoUsd, 'USD')}${x.tipo === 'suscripcion' ? ' por mes' : ' · pago único'}`;

/**
 * El producto ACTIVO del catálogo de MaKo que es este precio de Stripe, por el nombre: el que ya cobra lo mismo, o si no
 * el que no tiene precio (el de Mauricio). Uno con el mismo nombre que cobra OTRA cosa es un `conflicto`: no se toca y
 * se dice por qué.
 */
export function productoDeMako(p: Pick<PrecioDeStripe, 'nombre' | 'montoUsd' | 'tipo'>, catalogo: readonly ProductoCobro[]): { id: number | null; conflicto: string | null } {
  const n = nombreComparable(p.nombre);
  const mismos = catalogo.filter((x) => x.activo && nombreComparable(x.nombre) === n);
  const igual = mismos.find((x) => mismoPrecio(x, p));
  if (igual) return { id: igual.id, conflicto: null };
  const sinPrecio = mismos.find((x) => x.montoUsd == null);
  if (sinPrecio) return { id: sinPrecio.id, conflicto: null };
  if (!mismos.length) return { id: null, conflicto: null };
  const cobran = mismos.map(loQueCobra).join(' y ');
  return { id: null, conflicto: `En MaKo «${mismos[0].nombre}» ya cobra ${cobran}: cámbialo ahí, o renombra uno de los dos.` };
}

/**
 * Qué hacer al traer un precio: crearlo, nada (ya cobra eso), o ponerle el precio al de MaKo que NO tenía (el nombre del
 * de MaKo se respeta: es como lo llama el negocio). A ése se le sacan las cuotas: el precio de Stripe se cobra entero, y
 * con cuotas viejas el link cobraría una parte que la persona no vio. Un producto que ya cobra otra cosa no llega acá
 * (`productoDeMako` lo devuelve como conflicto), y si llega, es un error: nunca se pisa.
 */
export function importacionDelPrecio(
  p: Pick<PrecioDeStripe, 'nombre' | 'montoUsd' | 'tipo'>,
  existente: ProductoCobro | null,
): { accion: 'crear' | 'precio' | 'igual'; input: ProductoCobroInput } | { error: string } {
  if (p.montoUsd == null) return { error: 'Ese precio no está en dólares: el catálogo de MaKo va en dólares.' };
  const entero = p.tipo === 'suscripcion' ? {} : { cuotas: null };
  if (!existente) return { accion: 'crear', input: { nombre: p.nombre, tipo: p.tipo, montoUsd: p.montoUsd, ...(p.tipo === 'suscripcion' ? { suscripcionMeses: null } : { cuotas: null }) } };
  if (mismoPrecio(existente, p)) return { accion: 'igual', input: { nombre: existente.nombre, tipo: p.tipo, montoUsd: p.montoUsd } };
  if (existente.montoUsd != null) return { error: `En MaKo «${existente.nombre}» ya cobra ${loQueCobra(existente)}: cámbialo ahí, o renombra uno de los dos.` };
  return { accion: 'precio', input: { nombre: existente.nombre, tipo: p.tipo, montoUsd: p.montoUsd, ...entero } };
}

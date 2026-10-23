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
//     no duplica: le pone el precio de Stripe al de MaKo (nunca duplicar).
//
// Puro: lo importan lib/stripe-catalogo.ts, el pop-up (los tipos) y tests/stripe-catalogo.test.ts.
// =============================================================================

import type { ProductoCobro, ProductoCobroInput } from './cobro-etapa';

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

/** Monedas sin centavos en Stripe (docs.stripe.com/currencies#zero-decimal): su `unit_amount` ya es la unidad. */
const SIN_DECIMALES = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);

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
  const monto = minima == null ? 0 : SIN_DECIMALES.has(moneda) ? minima : minima / 100;
  const rec = c.recurring == null ? null : obj(c.recurring);
  const tipo: 'unico' | 'suscripcion' = rec ? 'suscripcion' : 'unico';
  let noSe: string | null = null;
  if (c.custom_unit_amount != null) noSe = 'El monto lo elige quien paga: no hay un precio que traer.';
  else if (c.billing_scheme === 'tiered' || minima == null) noSe = 'Es un precio por escalones: no hay un precio que traer.';
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

/**
 * El producto ACTIVO del catálogo de MaKo que es este precio de Stripe, por el nombre. Entre varios con el mismo nombre:
 * el que ya cobra lo mismo, si no el que no tiene precio; si quedan varios con precios distintos, ninguno (no se adivina:
 * `ambiguo`).
 */
export function productoDeMako(p: Pick<PrecioDeStripe, 'nombre' | 'montoUsd' | 'tipo'>, catalogo: readonly ProductoCobro[]): { id: number | null; ambiguo: boolean } {
  const n = nombreComparable(p.nombre);
  const mismos = catalogo.filter((x) => x.activo && nombreComparable(x.nombre) === n);
  if (!mismos.length) return { id: null, ambiguo: false };
  const igual = mismos.find((x) => x.tipo === p.tipo && x.montoUsd != null && p.montoUsd != null && Math.round(x.montoUsd * 100) === Math.round(p.montoUsd * 100));
  if (igual) return { id: igual.id, ambiguo: false };
  const sinPrecio = mismos.find((x) => x.montoUsd == null);
  if (sinPrecio) return { id: sinPrecio.id, ambiguo: false };
  return mismos.length === 1 ? { id: mismos[0].id, ambiguo: false } : { id: null, ambiguo: true };
}

/**
 * Qué hacer al traer un precio: crearlo, ponerle el precio al de MaKo, o nada (ya cobra eso). El nombre del de MaKo se
 * respeta (es como lo llama el negocio); el precio y el tipo vienen de Stripe. Un pago único conserva sus cuotas de
 * MaKo (no se mandan: `patchDeEdicion` no las toca); a una suscripción se le sacan.
 */
export function importacionDelPrecio(
  p: Pick<PrecioDeStripe, 'nombre' | 'montoUsd' | 'tipo'>,
  existente: ProductoCobro | null,
): { accion: 'crear' | 'precio' | 'igual'; input: ProductoCobroInput } | { error: string } {
  if (p.montoUsd == null) return { error: 'Ese precio no está en dólares: el catálogo de MaKo va en dólares.' };
  if (!existente) return { accion: 'crear', input: { nombre: p.nombre, tipo: p.tipo, montoUsd: p.montoUsd, ...(p.tipo === 'suscripcion' ? { suscripcionMeses: null } : { cuotas: null }) } };
  const mismo = existente.tipo === p.tipo && existente.montoUsd != null && Math.round(existente.montoUsd * 100) === Math.round(p.montoUsd * 100);
  return { accion: mismo ? 'igual' : 'precio', input: { nombre: existente.nombre, tipo: p.tipo, montoUsd: p.montoUsd } };
}

// =============================================================================
// Admin › Products — los planes de MaKo como el catálogo de Polar, y los links de «Vender un plan» como sus Checkout Links
// =============================================================================
// Puro y SIN `server-only`: lo usan las vistas del navegador (ProductsPage, la ficha, la barra de Checkout Links) y
// tests/admin-polar-productos.test.ts, que EJECUTA estas funciones. La lectura de la base vive en productos-server.ts.
//
// De dónde sale cada cosa:
//   · Catalogue: los planes (lib/planes-mako.ts → `PlanMako`, leídos con `planesMako()` de lib/compra-plan.ts). El
//     «archivado» de Polar es `activo: false` de MaKo, con el mismo sentido: no se vende más, quien ya lo paga lo sigue pagando.
//   · Checkout Links: los cobros de la plataforma que creó «Vender un plan» (`venderPlan`, lib/vender-plan.ts): tienen
//     `alta_capa` y su `creado_por` es la persona que lo armó. Los de /planes (el checkout público) también tienen `alta_capa`,
//     pero su `creado_por` empieza con «planes:» (lib/compra-plan.ts): ésos NO son un link armado a mano y no van acá.
//
// ⚠️ UN LINK GUARDA LA CAPA, NO EL PLAN. `venderPlan` recibe la capa (`alta_capa`), así que «de qué plan es» se contesta sólo
//    cuando UN plan tiene esa capa. Hoy MaKo Pro y la Continuidad del Acelerador comparten `agencia`: un link de esa capa se
//    rotula con el nombre de la capa, nunca con el de un plan elegido a ciegas («si hay que desempatar, todavía estás
//    adivinando», AGENTS.md).
// =============================================================================

import type { PlanMako } from '@/lib/planes-mako'
import type { Cobro, EstadoAlta, EstadoCobro, Pasarela, TipoCobro } from '@/lib/cobros-tipos'
import { capaDef } from '@/lib/capas'
import { esDeVenderUnPlan } from './checkout-link'

// ─── Catalogue ──────────────────────────────────────────────────────────────

/** Un plan de MaKo, con lo que la lista y la ficha de Polar dibujan. */
export type ProductoMako = {
  id: string
  nombre: string
  capa: string
  /** El precio mensual, en dólares. */
  precioUsd: number
  /** El precio por año, si el plan lo tiene. */
  precioAnualUsd: number | null
  /** El precio por mes en la moneda de una cuenta de Mercado Pago (ARS, MXN…): sin él, ese plan no se cobra por ahí. */
  preciosLocales: Record<string, number>
  /** `false` = archivado: no se ofrece, quien ya lo paga lo sigue pagando. */
  activo: boolean
  /** El descuento que se le ofrece antes de darse de baja (lib/retencion-plan.ts): el único descuento atado a un plan. */
  descuento: { pct: number; meses: number } | null
}

export const productoDePlan = (p: PlanMako): ProductoMako => {
  const d = p.retencion?.descuento
  return {
    id: p.id,
    nombre: p.nombre,
    capa: p.capa,
    precioUsd: p.precioUsd,
    precioAnualUsd: typeof p.precioAnualUsd === 'number' && p.precioAnualUsd > 0 ? p.precioAnualUsd : null,
    preciosLocales: { ...p.preciosLocales },
    activo: p.activo,
    descuento: d && d.pct > 0 && d.meses > 0 ? { pct: d.pct, meses: d.meses } : null,
  }
}

export const MOSTRAR = ['all', 'active', 'archived'] as const
export type Mostrar = (typeof MOSTRAR)[number]
/**
 * Los órdenes de Polar que MaKo puede cumplir. «Newest/Oldest» (`created_at`) se sacó: un plan no tiene fecha de creación.
 */
export const ORDENES = ['name', '-name', 'price_amount', '-price_amount'] as const
export type Orden = (typeof ORDENES)[number]

export const leerMostrar = (v: unknown): Mostrar => ((MOSTRAR as readonly string[]).includes(String(v)) ? (v as Mostrar) : 'active')
export const leerOrden = (v: unknown): Orden => ((ORDENES as readonly string[]).includes(String(v)) ? (v as Orden) : 'name')

/** Sin mayúsculas ni tildes: «Esencial» se encuentra escribiendo «esen». */
const plano = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Lo que Polar le pide a su API (`query`, `is_archived`, `sorting`), hecho en memoria: son unos pocos planes. Y como Polar,
 * los archivados al final (`Number(a.is_archived) - Number(b.is_archived)`, ProductsPage).
 */
export function filtrarProductos(items: readonly ProductoMako[], f: { query?: string | null; show?: Mostrar; sorting?: Orden } = {}): ProductoMako[] {
  const q = plano(f.query ?? '')
  const show = f.show ?? 'active'
  const sorting = f.sorting ?? 'name'
  const desc = sorting.startsWith('-')
  const campo = desc ? sorting.slice(1) : sorting
  const filtrados = items.filter((p) => {
    if (show === 'active' && !p.activo) return false
    if (show === 'archived' && p.activo) return false
    return !q || plano(p.nombre).includes(q)
  })
  const ordenados = [...filtrados].sort((a, b) => {
    const c = campo === 'price_amount' ? a.precioUsd - b.precioUsd : a.nombre.localeCompare(b.nombre, 'es')
    return desc ? -c : c
  })
  return ordenados.sort((a, b) => Number(!a.activo) - Number(!b.activo))
}

// ─── Checkout Links ─────────────────────────────────────────────────────────

/** Lo que hace falta de un cobro para dibujarlo como un link. La URL ya armada (sólo mientras se puede pagar). */
export type CobroDeVenta = Pick<
  Cobro,
  'id' | 'nombre' | 'email' | 'alta_capa' | 'monto' | 'moneda' | 'monto_usd' | 'tipo' | 'proveedor' | 'estado' | 'created_at' | 'pagado_at' | 'creado_por' | 'alta_ws' | 'alta_estado'
> & { url: string | null; alta_ws_nombre: string | null }

/** Un link de «Vender un plan», con lo que la barra y la ficha de Checkout Links dibujan. */
export type LinkDeVenta = {
  id: number
  /** El «label» de Polar: el nombre de quien paga (o su email). */
  etiqueta: string
  nombre: string | null
  email: string | null
  capa: string
  /** El plan que vende: el nombre del plan si uno solo tiene esa capa; si no, el de la capa. */
  producto: string
  monto: number
  moneda: string
  montoUsd: number | null
  tipo: TipoCobro
  pasarela: Pasarela
  estado: EstadoCobro
  /** /pagar/<token>, sólo mientras se puede pagar (pendiente o rechazado). */
  url: string | null
  creado: string
  pagado: string | null
  /** La cuenta que se creó al pagarse. */
  cuenta: { ws: number; nombre: string | null } | null
  alta: EstadoAlta | null
}

/** ¿Lo armó una persona con «Vender un plan»? La regla es UNA y la usa también Sales › Checkouts (./checkout-link.ts). */
export { esDeVenderUnPlan } from './checkout-link'

/** El plan que vende un link de esa capa: el único plan con esa capa, o el nombre de la capa si hay más de uno (o ninguno). */
export function productoDeCapa(capa: string, productos: readonly Pick<ProductoMako, 'capa' | 'nombre'>[]): string {
  const deLaCapa = productos.filter((p) => p.capa === capa)
  return deLaCapa.length === 1 ? deLaCapa[0].nombre : capaDef(capa).nombre
}

export function linkDeVenta(c: CobroDeVenta, productos: readonly Pick<ProductoMako, 'capa' | 'nombre'>[]): LinkDeVenta {
  const capa = String(c.alta_capa ?? '')
  return {
    id: c.id,
    etiqueta: (c.nombre ?? '').trim() || (c.email ?? '').trim() || 'Sin nombre',
    nombre: c.nombre,
    email: c.email,
    capa,
    producto: productoDeCapa(capa, productos),
    monto: c.monto,
    moneda: c.moneda,
    montoUsd: c.monto_usd,
    tipo: c.tipo,
    pasarela: c.proveedor,
    estado: c.estado,
    url: c.estado === 'pendiente' || c.estado === 'fallido' ? c.url : null,
    creado: c.created_at,
    pagado: c.pagado_at,
    cuenta: c.alta_ws != null ? { ws: c.alta_ws, nombre: c.alta_ws_nombre } : null,
    alta: c.alta_estado,
  }
}

/** Los cobros que son links de «Vender un plan», ya convertidos. */
export const linksDeVenta = (cobros: readonly CobroDeVenta[], productos: readonly Pick<ProductoMako, 'capa' | 'nombre'>[]): LinkDeVenta[] =>
  cobros.filter(esDeVenderUnPlan).map((c) => linkDeVenta(c, productos))

export type OrdenLinks = 'label' | '-label'
export const leerOrdenLinks = (v: unknown): OrdenLinks => (v === '-label' ? '-label' : 'label')

/** El orden de la barra de Polar (`sorting: label | -label`). A igual etiqueta, el más nuevo primero. */
export function ordenarLinks(links: readonly LinkDeVenta[], sorting: OrdenLinks = 'label'): LinkDeVenta[] {
  const s = sorting === '-label' ? -1 : 1
  return [...links].sort((a, b) => s * a.etiqueta.localeCompare(b.etiqueta, 'es') || b.creado.localeCompare(a.creado))
}

/** `?productId=a,b` de Polar: los links de esos planes, por su CAPA (ver la cabecera: un link no sabe de qué plan es). */
export function filtrarLinksPorProducto(links: readonly LinkDeVenta[], productIds: readonly string[], productos: readonly Pick<ProductoMako, 'id' | 'capa'>[]): LinkDeVenta[] {
  if (productIds.length === 0) return [...links]
  const capas = new Set(productos.filter((p) => productIds.includes(p.id)).map((p) => p.capa))
  return links.filter((l) => capas.has(l.capa))
}

/** `?productId=` como lo arma Polar («a,b», o repetido). */
export const leerProductIds = (v: string | string[] | undefined | null): string[] =>
  (Array.isArray(v) ? v : String(v ?? '').split(',')).map((s) => s.trim()).filter(Boolean)

/** Lo que lee el server para Checkout Links (productos-server.ts → `leerCheckoutLinks`). */
export type DatosCheckoutLinks = {
  productos: ProductoMako[]
  links: LinkDeVenta[]
  /** Las pasarelas conectadas en la plataforma: sin ninguna no se puede armar un link. */
  pasarelas: Pasarela[]
  /** La moneda de la cuenta de Mercado Pago de MaKo (null = no conectada o no se pudo leer). */
  monedaMp: string | null
  /** Se llegó al tope de la lista: puede haber links más viejos que no se ven. */
  truncado: boolean
  /** Lo que no se pudo leer. */
  avisos: string[]
}

/** Cómo se lee el estado de un link, con el color del `Status` de Polar. */
export const ESTADO_LINK: Readonly<Record<EstadoCobro, { rotulo: string; color: 'green' | 'yellow' | 'red' | 'gray' | 'blue' }>> = {
  pendiente: { rotulo: 'Sin pagar', color: 'yellow' },
  fallido: { rotulo: 'Rechazado', color: 'red' },
  pagado: { rotulo: 'Pagado', color: 'green' },
  reembolsado: { rotulo: 'Devuelto', color: 'gray' },
  anulado: { rotulo: 'Anulado', color: 'gray' },
}

/** «Delete Checkout Link» de Polar = anular el link: sólo mientras no se pagó (lib/cobros.ts, `anularCobro`). */
export const sePuedeAnular = (l: Pick<LinkDeVenta, 'estado'>): boolean => l.estado === 'pendiente' || l.estado === 'fallido'

// ─── El formulario de «Vender un plan» ──────────────────────────────────────

/** Lo que Stripe cobra desde acá (Mercado Pago no elige: cobra en la moneda de su cuenta). Como la pantalla de antes. */
export const MONEDAS_STRIPE = ['USD', 'MXN', 'EUR'] as const

/**
 * El monto que se propone al elegir un plan: su precio en la moneda en que va a cobrar el link (USD por Stripe; la de la
 * cuenta de Mercado Pago, si el plan tiene precio en esa moneda). Sin precio en esa moneda, nada: nunca se inventa una tasa.
 */
export function montoSugerido(plan: Pick<ProductoMako, 'precioUsd' | 'preciosLocales'> | null | undefined, moneda: string | null): number | null {
  if (!plan) return null
  if (!moneda || moneda === 'USD') return moneda === 'USD' ? plan.precioUsd : null
  const local = plan.preciosLocales?.[moneda]
  return typeof local === 'number' && local > 0 ? local : null
}

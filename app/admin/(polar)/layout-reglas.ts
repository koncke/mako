// =============================================================================
// Las páginas de Admin que REDIRIGEN lo hacen en el layout, ANTES del loader (6/11/2026, punto 31)
// =============================================================================
// Admin tiene `loading.tsx` desde el punto 31 de docs/admin/revision-cerebro-6-11.md («se hace clic y no pasa nada»). Un
// loading.tsx es un Suspense que envuelve a TODAS las páginas de (polar), y un `redirect()` de una de ellas, en una carga del
// documento, va adentro del stream (200 + meta refresh, no 307): es la carrera que tiró «React error #310» en /general
// (ticket #7, AGENTS.md → «una página que REDIRIGE no lo lleva así»). El layout de (polar) queda AFUERA del loader: si
// redirige él, sale el 307 de siempre. Esta función dice, con la ruta y la query que pone el proxy (lib/pedido-actual.ts),
// qué haría cada página; el layout lo aplica SÓLO en la carga del documento (navegando, decide la página: lib/pedido-actual.ts
// → `esNavegacionDelCliente`). Las páginas conservan su redirect, por si se llega navegando.
//
// ⚠️ ES LA MISMA DECISIÓN DE CADA PÁGINA, COPIADA: si cambia una, cambian las dos. La lista de las páginas que redirigen está en
//    tests/redirige-antes-del-loader.test.ts (DECIDEN_POR_RUTA['app/admin/(polar)']), y una página nueva que redirige falla ese
//    test hasta que se suma acá. Ruta por ruta lo prueba tests/admin-polar-armazon.test.ts.
// ⚠️ LO QUE NO SE COPIA, A PROPÓSITO: en Metrics, una fecha de inicio VÁLIDA anterior al primer mes leído la corrige sólo la
//    página. Saberlo pide leer los ingresos de todos los negocios, y como Metrics deja el rango en la URL, cada recarga los
//    leería dos veces (el layout y la página) para un caso que la pantalla misma no produce (sus rangos arrancan en el primer
//    mes). Lo demás de Metrics sí: lo que se corrige seguro (`interval`, `product_id`, un fin o un inicio que no son fechas).
// =============================================================================

import { destinoDeTabViejo } from '@/app/admin/_polar/datos/resumen'
import { wsDeId } from '@/app/admin/_polar/datos/cliente'
import { tiposDeUrl } from '@/app/admin/_polar/datos/eventos'
import { esMes } from '@/app/admin/_polar/datos/costos'
import { fromISODate, toISODate } from '@/app/admin/_polar/web/utils/metrics'
import type { QueryDelPedido } from '@/lib/pedido-actual-reglas'

/** Lo que hace el layout en una carga. `conWs`: el destino pasa por `rutaConWs`, como en su página. */
export type RedireccionDeLaCarga =
  | { tipo: 'ir'; destino: string; reemplazar: boolean; conWs?: boolean }
  /** /admin/customers/<id>/events → Analytics › Events del negocio, si el negocio existe (si no, la página da 404). */
  | { tipo: 'eventos-del-negocio'; ws: number }
  /** /admin/sales/checkouts/<id> → su link de «Vender un plan», si no es un checkout y sí un link (hay que leer los cobros). */
  | { tipo: 'link-de-venta'; id: number }
  /** /admin/analytics/metrics con algo que corregir y una fecha de inicio: el destino pide el primer mes leído. */
  | { tipo: 'metricas' }

const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** La query como la arma una página que la preserva: cada valor, y los repetidos todos. */
function queryEntera(q: QueryDelPedido, sin?: string): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(q)) {
    if (k === sin || v === undefined) continue
    for (const x of Array.isArray(v) ? v : [v]) params.append(k, x)
  }
  return params.toString()
}

const esFecha = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(fromISODate(v).getTime())

/**
 * La corrección de Analytics › Metrics (la de su page.tsx). `primerDia` = el primer día leído (YYYY-MM-DD), o `null` si no se
 * leyó. Devuelve el destino, `null` si no hay nada que corregir, o `'leer'` si hay que corregir y el destino pide `primerDia`.
 * Sin `primerDia`, un inicio válido no se corrige acá (ver la cabecera: lo hace la página).
 */
export function correccionDeMetricas(q: QueryDelPedido, primerDia: string | null): string | null | 'leer' {
  const start = uno(q.start_date)
  const end = uno(q.end_date)
  const sobra = q.interval !== undefined || q.product_id !== undefined
  const malFin = end !== undefined && !esFecha(end)
  const inicioRoto = start !== undefined && !esFecha(start)
  if (primerDia == null) {
    if (!sobra && !malFin && !inicioRoto) return null
    if (start !== undefined) return 'leer'
  }
  const minDate = primerDia != null ? fromISODate(primerDia) : null
  const malInicio = start !== undefined && (inicioRoto || (minDate != null && fromISODate(start) < minDate))
  if (!sobra && !malInicio && !malFin) return null
  const params = new URLSearchParams()
  if (start !== undefined) params.set('start_date', malInicio && minDate ? toISODate(minDate) : start)
  if (end !== undefined && !malFin) params.set('end_date', end)
  const s = params.toString()
  return `/admin/analytics/metrics${s ? `?${s}` : ''}`
}

/** Qué hace el layout de Admin con este pedido, en una carga del documento. `null` = nada (la página dibuja). */
export function redireccionDeLaCarga(ruta: string | null, query: QueryDelPedido): RedireccionDeLaCarga | null {
  if (!ruta) return null
  // Overview (app/admin/(polar)/page.tsx): los links viejos `/admin?tab=…`.
  if (ruta === '/admin') {
    const destino = destinoDeTabViejo(query)
    return destino ? { tipo: 'ir', destino, reemplazar: false } : null
  }
  // Finance (finance/page.tsx): siempre a Income.
  if (ruta === '/admin/finance') return { tipo: 'ir', destino: '/admin/finance/income', reemplazar: false, conWs: true }
  // Analytics (analytics/page.tsx): siempre a Metrics, con la query.
  if (ruta === '/admin/analytics') {
    const q = queryEntera(query)
    return { tipo: 'ir', destino: `/admin/analytics/metrics${q ? `?${q}` : ''}`, reemplazar: true }
  }
  // Events (analytics/events/page.tsx): el `?tipo=` de las pantallas viejas pasa a `eventTypes`, desde siempre.
  if (ruta === '/admin/analytics/events') {
    if (query.tipo === undefined) return null
    const params = new URLSearchParams(queryEntera(query, 'tipo'))
    const tipos = tiposDeUrl(query.tipo)
    if (tipos && !params.has('eventTypes')) params.set('eventTypes', tipos.join(','))
    if (tipos && !params.has('range') && !params.has('startDate')) params.set('range', 'allTime')
    const q = params.toString()
    return { tipo: 'ir', destino: `/admin/analytics/events${q ? `?${q}` : ''}`, reemplazar: true }
  }
  // Costs (analytics/costs/page.tsx): un `?mes=` que no es un mes se saca.
  if (ruta === '/admin/analytics/costs') {
    const pedido = uno(query.mes)
    return pedido !== undefined && !esMes(pedido) ? { tipo: 'ir', destino: '/admin/analytics/costs', reemplazar: true } : null
  }
  // Metrics (analytics/metrics/page.tsx).
  if (ruta === '/admin/analytics/metrics') {
    const r = correccionDeMetricas(query, null)
    if (r === 'leer') return { tipo: 'metricas' }
    return r ? { tipo: 'ir', destino: r, reemplazar: true } : null
  }
  // La vieja Events de la ficha (customers/[id]/events/page.tsx).
  const eventos = /^\/admin\/customers\/([^/]+)\/events$/.exec(ruta)
  if (eventos) {
    const ws = wsDeId(eventos[1])
    return ws == null ? null : { tipo: 'eventos-del-negocio', ws }
  }
  // Un checkout que en realidad es un link de «Vender un plan» (sales/checkouts/[id]/page.tsx).
  const checkout = /^\/admin\/sales\/checkouts\/([1-9]\d{0,11})$/.exec(ruta)
  if (checkout) return { tipo: 'link-de-venta', id: Number(checkout[1]) }
  return null
}

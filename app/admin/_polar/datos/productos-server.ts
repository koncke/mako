// =============================================================================
// Admin › Products — la lectura de la base (los planes y los links de «Vender un plan»)
// =============================================================================
// Las cuentas viven en productos.ts (puro, testeado). Lo de acá cruza negocios: lo llama un page.tsx de /admin DESPUÉS de
// `exigirSuperAdmin()`. Los cobros son los del workspace de la PLATAFORMA (`wsSuperAdmin()`), nunca OWNER_WS (el 1 es un
// cliente) ni el de la cookie (el super admin puede estar mirando a otro con `?ws=`): la regla de app/admin/cobros/actions.ts.
//
// ⚠️ NO USA `cobrosDeMakoAction` (app/admin/cobros/actions.ts): su fila no trae `creado_por`, y sin él un link armado a mano y
//    uno del checkout público de /planes se ven iguales. Lee lo mismo (listarCobros con el tope de 200, las pasarelas y el
//    nombre de la cuenta que nació de cada alta) con las mismas funciones de lib/cobros.ts.

import 'server-only'
import { cache } from 'react'
import { planesMako, monedaDeMercadoPagoDeMako } from '@/lib/compra-plan'
import { linkDelCobro, listarCobros, pasarelasConectadas } from '@/lib/cobros'
import { getWorkspace, wsSuperAdmin } from '@/lib/workspace'
import type { Pasarela } from '@/lib/cobros-tipos'
import { linksDeVenta, productoDePlan, type CobroDeVenta, type DatosCheckoutLinks, type ProductoMako } from './productos'

export type { DatosCheckoutLinks }

/** El tope de `listarCobros`: llegar a él se DICE en pantalla. */
const TOPE = 200

const msg = (e: unknown, def: string): string => (e instanceof Error && e.message ? e.message : def)

/** Los planes de hoy. `planesMako()` no tira: sin base, los de siempre (lib/compra-plan.ts). */
export async function leerProductos(): Promise<ProductoMako[]> {
  return (await planesMako()).map(productoDePlan)
}


/**
 * Una lectura por pedido (`cache` de React): la llaman el layout de Checkout Links (la barra) y la página del link, en el
 * mismo render. Sin esto se leería dos veces la misma lista.
 */
export const leerCheckoutLinks = cache(async (): Promise<DatosCheckoutLinks> => {
  const avisos: string[] = []
  const ws = await wsSuperAdmin()
  const [productos, cobros, pasarelas, monedaMp] = await Promise.all([
    leerProductos(),
    // Si esto falla no hay lista: el error sube y la página dice «No pude leer los links».
    listarCobros(ws, { limite: TOPE }),
    pasarelasConectadas(ws).catch((e) => { avisos.push(`las pasarelas conectadas: ${msg(e, 'sin detalle')}`); return [] as Pasarela[] }),
    monedaDeMercadoPagoDeMako().catch((e) => { avisos.push(`la moneda de Mercado Pago: ${msg(e, 'sin detalle')}`); return null }),
  ])
  const ids = [...new Set(cobros.map((c) => c.alta_ws).filter((x): x is number => x != null))]
  const nombres = new Map<number, string>()
  await Promise.all(ids.map(async (id) => {
    const w = await getWorkspace(id).catch(() => null)
    if (w) nombres.set(id, w.nombre)
  }))
  const filas: CobroDeVenta[] = cobros.map((c) => ({
    id: c.id, nombre: c.nombre, email: c.email, alta_capa: c.alta_capa, monto: c.monto, moneda: c.moneda, monto_usd: c.monto_usd,
    tipo: c.tipo, proveedor: c.proveedor, estado: c.estado, created_at: c.created_at, pagado_at: c.pagado_at, creado_por: c.creado_por,
    alta_ws: c.alta_ws, alta_estado: c.alta_estado,
    url: c.estado === 'pendiente' || c.estado === 'fallido' ? linkDelCobro(c.token) : null,
    alta_ws_nombre: c.alta_ws != null ? nombres.get(c.alta_ws) ?? null : null,
  }))
  return { productos, links: linksDeVenta(filas, productos), pasarelas, monedaMp, truncado: cobros.length >= TOPE, avisos }
})

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/[id]/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: el detalle de un pedido. El id es `p-<pago>`, `c-<cobro>` o `r-<recibo>` (app/admin/_polar/datos/ventas.ts) y se valida
// con su forma antes de buscar; lo que no existe es un 404, como `getOrderById` de Polar.
// ⚠️ Un `p-<pago>` cuyo cobro se DEVOLVIÓ ya no está en Orders (su pago pasa a `pagado: false`): lleva a su `c-<cobro>`, que es el
// pedido devuelto (revisión del Cerebro del 6/11/2026, punto 3). `?hecho=` trae el resultado de la devolución (OrderRefundsSection).
// ⚠️ La suscripción del pedido se busca acá (punto 19): armar `l-<lead>` a ciegas daba 404 o abría la suscripción de otro lead.

import { notFound, redirect } from 'next/navigation'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { cobroDelPago, vistaOrders, vistaSuscripciones } from '@/app/admin/_polar/datos/ventas-server'
import { ES_ID_PEDIDO, hechoDeLaUrl, suscripcionDelPedido } from '@/app/admin/_polar/datos/ventas'
import { rutaConWs } from '@/lib/workspace'
import { Metadata } from 'next'
import SalesPage from './SalesPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Pedido',
  }
}

export default async function Page(props: { params: Promise<{ id: string }>; searchParams: Promise<{ hecho?: string | string[] }> }) {
  await exigirSuperAdmin()
  const { id } = await props.params
  if (!ES_ID_PEDIDO.test(id)) notFound()
  const vista = await vistaOrders()
  const busqueda = await props.searchParams
  const order = vista.pedidos.find((p) => p.id === id)
  if (!order) {
    if (id.startsWith('p-')) {
      const cobroId = await cobroDelPago(Number(id.slice(2)))
      if (cobroId != null && vista.pedidos.some((p) => p.id === `c-${cobroId}` && p.estado === 'refunded')) redirect(await rutaConWs(`/admin/sales/c-${cobroId}`))
    }
    notFound()
  }
  const cobro = order.cobroId != null ? vista.cobros.find((c) => c.id === order.cobroId) ?? null : null
  // Las suscripciones comparten los cobros leídos (un `cache` por pedido); si no se pueden leer, el enlace no se dibuja.
  const subs = await vistaSuscripciones().catch(() => ({ suscripciones: [] }))
  return (
    <SalesPage
      order={order}
      cobro={cobro}
      plataforma={vista.plataforma}
      avisos={vista.avisos}
      suscripcion={suscripcionDelPedido(order, subs.suscripciones)}
      hecho={hechoDeLaUrl(busqueda.hecho)}
    />
  )
}

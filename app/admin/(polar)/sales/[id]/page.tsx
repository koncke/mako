// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/[id]/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: el detalle de un pedido. El id es `p-<pago>`, `c-<cobro>` o `r-<recibo>` (app/admin/_polar/datos/ventas.ts) y se valida
// con su forma antes de buscar; lo que no existe es un 404, como `getOrderById` de Polar.

import { notFound } from 'next/navigation'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { vistaOrders } from '@/app/admin/_polar/datos/ventas-server'
import { ES_ID_PEDIDO } from '@/app/admin/_polar/datos/ventas'
import { Metadata } from 'next'
import SalesPage from './SalesPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Order',
  }
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await exigirSuperAdmin()
  const { id } = await props.params
  if (!ES_ID_PEDIDO.test(id)) notFound()
  const vista = await vistaOrders()
  const order = vista.pedidos.find((p) => p.id === id)
  if (!order) notFound()
  const cobro = order.cobroId != null ? vista.cobros.find((c) => c.id === order.cobroId) ?? null : null
  return <SalesPage order={order} cobro={cobro} plataforma={vista.plataforma} avisos={vista.avisos} />
}

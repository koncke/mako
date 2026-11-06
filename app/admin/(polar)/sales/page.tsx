// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Sales › Orders. Lo que Polar pide desde el navegador (`useOrders`, `useMetrics`) se lee acá y viaja armado: cada pago que
// entró con su recibo (app/admin/_polar/datos/ventas-server.ts). El permiso de Polar (`sales:read`, su layout) es acá
// `exigirSuperAdmin()`, antes de leer: cruza negocios.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { vistaOrders } from '@/app/admin/_polar/datos/ventas-server'
import { Metadata } from 'next'
import SalesPage from './SalesPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Orders',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const vista = await vistaOrders()
  return <SalesPage hoy={vista.hoy} pedidos={vista.pedidos} avisos={vista.avisos} libro={vista.libro} cargarPago={vista.cargarPago} />
}

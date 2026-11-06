// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/cost-drivers/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Customers › Cost Drivers. El gasto de IA de cada negocio en el mes en curso (lib/costos-ia.ts), sólo si se puede
// repartir por negocio. Sin el guard de `analytics:read`: entra sólo el super admin.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerClientes, leerCostos } from '@/app/admin/_polar/datos/clientes-server'
import { mesActual, vistaDeCostos } from '@/app/admin/_polar/datos/clientes'
import { Metadata } from 'next'
import { CostDriversPage } from './CostDriversPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Cost Drivers',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const periodo = mesActual(Date.now())
  const [clientes, costos] = await Promise.all([leerClientes(), leerCostos(periodo)])
  return <CostDriversPage {...vistaDeCostos(clientes, costos, periodo)} />
}

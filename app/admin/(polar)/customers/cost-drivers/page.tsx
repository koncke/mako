// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/cost-drivers/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Customers › Cost Drivers. El gasto de IA de cada negocio en el rango elegido (lib/costos-ia.ts), sólo si se puede
// repartir por negocio. El rango es el selector de Polar (Desde siempre, 12m, 3m, 30d, Hoy; decisión del Cerebro, 6/11/2026)
// y viaja en `?range=`, porque el gasto lo lee este server: una ventana exacta sobre `created_at` (`ventanaDeCostos`).
// Sin el guard de `analytics:read`: entra sólo el super admin.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerClientes, leerCostosEntre } from '@/app/admin/_polar/datos/clientes-server'
import { rangoDeParam, ventanaDeCostos, vistaDeCostos } from '@/app/admin/_polar/datos/clientes'
import { Metadata } from 'next'
import { CostDriversPage } from './CostDriversPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Cost Drivers',
  }
}

export default async function Page(props: { searchParams: Promise<{ range?: string | string[] }> }) {
  await exigirSuperAdmin()
  const range = rangoDeParam((await props.searchParams).range)
  const v = ventanaDeCostos(range, Date.now())
  const [clientes, costos] = await Promise.all([leerClientes(), leerCostosEntre(range, v.desde, v.hasta)])
  return <CostDriversPage {...vistaDeCostos(clientes, costos, range)} range={range} rotulo={v.rotulo} />
}

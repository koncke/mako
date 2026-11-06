// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/at-risk/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Customers › At Risk. Los negocios en riesgo los junta el server (`clientesEnRiesgo`, app/admin/_polar/datos/clientes.ts).

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerClientes, leerIngresos } from '@/app/admin/_polar/datos/clientes-server'
import { vistaDeAtRisk } from '@/app/admin/_polar/datos/clientes'
import { Metadata } from 'next'
import { AtRiskPage } from './AtRiskPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'At Risk Customers',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const [clientes, ingresos] = await Promise.all([leerClientes(), leerIngresos()])
  return <AtRiskPage {...vistaDeAtRisk(clientes, ingresos)} />
}

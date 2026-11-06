// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Customers › Overview. Lo que Polar pide con hooks desde el navegador (el crecimiento, los que más pagan, los en riesgo
// y el gasto por cliente) se lee acá y viaja armado (app/admin/_polar/datos/clientes.ts).

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerClientes, leerCostos, leerIngresos } from '@/app/admin/_polar/datos/clientes-server'
import { mesActual, vistaDeOverview } from '@/app/admin/_polar/datos/clientes'
import { CustomersOverview } from '@/app/admin/_polar/web/Customer/CustomersOverview'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { Alert } from '@/app/admin/_polar/orbit'
import { Users } from '@/app/admin/_polar/orbit/icons'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Customers',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const ahora = Date.now()
  const clientes = await leerClientes()

  if (!clientes.ok) {
    return (
      <div className="flex h-full w-full flex-col justify-center">
        <Alert variant="danger" title="No pude leer los negocios" description={clientes.error} />
      </div>
    )
  }

  if (clientes.datos.filas.length === 0) {
    return (
      <div className="flex h-full w-full flex-col justify-center">
        <EmptyState
          icon={<Users />}
          title="Todavía no hay negocios"
          description="Da de alta un negocio para empezar."
        />
      </div>
    )
  }

  const periodo = mesActual(ahora)
  const [ingresos, costos] = await Promise.all([leerIngresos(), leerCostos(periodo)])
  return <CustomersOverview {...vistaDeOverview(clientes, ingresos, costos, periodo, ahora)} />
}

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/disputes/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Sales › Disputes. Los contracargos que la pasarela le avisó a MaKo: quedan escritos en el motivo del cobro y en el recibo
// (lib/cobros.ts, `aplicarContracargo`); no hay una tabla de disputas. Sólo el super admin, antes de leer.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { vistaDisputas } from '@/app/admin/_polar/datos/ventas-server'
import { Metadata } from 'next'
import DisputesPage from './DisputesPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Disputes',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const vista = await vistaDisputas()
  return <DisputesPage disputas={vista.disputas} avisos={vista.avisos} />
}

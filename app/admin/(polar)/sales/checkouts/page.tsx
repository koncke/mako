// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/checkouts/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Sales › Checkouts. Los cobros de la pasarela que no se pagaron (los links abiertos, rechazados y anulados), leídos acá
// (`cobrosDeMakoAction`). Sólo el super admin, antes de leer.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { vistaCheckouts } from '@/app/admin/_polar/datos/ventas-server'
import { Metadata } from 'next'
import CheckoutsPage from './CheckoutsPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Checkouts',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const vista = await vistaCheckouts()
  return <CheckoutsPage checkouts={vista.checkouts} avisos={vista.avisos} />
}

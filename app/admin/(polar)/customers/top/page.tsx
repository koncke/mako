// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/top/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Customers › Top Customers. Los pagos con su dueño se leen acá (lib/admin-ingresos.ts) y el rango lo elige la página.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerIngresos } from '@/app/admin/_polar/datos/clientes-server'
import { vistaDeTop } from '@/app/admin/_polar/datos/clientes'
import { wsSuperAdmin } from '@/lib/workspace'
import { Metadata } from 'next'
import { TopCustomersPage } from './TopCustomersPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Top Customers',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  // La plataforma arma el link a la ficha del CRM de quien pagó sin cuenta de MaKo (`rutaDeQuienPaga`).
  const [ingresos, plataforma] = await Promise.all([leerIngresos(), wsSuperAdmin().catch(() => null)])
  return <TopCustomersPage {...vistaDeTop(ingresos, Date.now())} plataforma={plataforma} />
}

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/finance/(wide)/income/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Finance › Income (/admin/finance/income): el libro de lo que entró a MaKo. ⚠️ SÓLO EL SUPER ADMIN, en la primera
// línea y antes de leer. ⚠️ Polar arma la cabecera (el «Export») en el layout de la carpeta; acá el «Export» necesita las
// filas, que lee esta página, así que la cabecera va en la vista (IncomePage) y el layout no hace falta.

import type { Metadata } from 'next'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerIngresos } from '@/app/admin/_polar/datos/finanzas-server'
import IncomePage from './IncomePage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: `Finance - Income`,
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const datos = await leerIngresos()
  return <IncomePage datos={datos} />
}

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/subscriptions/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Sales › Subscriptions. Cada suscripción de un cliente de MaKo, viva o cortada, con su historia mes a mes (la misma cuenta
// que la ficha del lead), y las de la pasarela (app/admin/_polar/datos/ventas-server.ts). Sólo el super admin, antes de leer.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { vistaSuscripciones } from '@/app/admin/_polar/datos/ventas-server'
import { Metadata } from 'next'
import SubscriptionsPage from './SubscriptionsPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Subscriptions',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const vista = await vistaSuscripciones()
  return <SubscriptionsPage hoy={vista.hoy} suscripciones={vista.suscripciones} avisos={vista.avisos} />
}

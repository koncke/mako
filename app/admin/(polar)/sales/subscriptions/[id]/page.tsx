// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/subscriptions/[id]/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: el detalle de una suscripción. El id es `l-<lead>` (la del lead de suscripción) o `c-<cobro>` (la de la pasarela sin lead
// de suscripción); se valida con su forma antes de buscar. Lo que no existe es un 404.

import { notFound } from 'next/navigation'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { vistaSuscripciones } from '@/app/admin/_polar/datos/ventas-server'
import { Metadata } from 'next'
import SubscriptionsPage from './SubscriptionsPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Subscription',
  }
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await exigirSuperAdmin()
  const { id } = await props.params
  if (!/^[lc]-[1-9]\d{0,11}$/.test(id)) notFound()
  const vista = await vistaSuscripciones()
  const subscription = vista.suscripciones.find((s) => s.id === id)
  if (!subscription) notFound()
  return <SubscriptionsPage subscription={subscription} hoy={vista.hoy} plataforma={vista.plataforma} avisos={vista.avisos} />
}

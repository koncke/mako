// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/checkouts/[id]/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: el detalle de un link de pago sin pagar (un cobro de la pasarela). El id es el del cobro; lo que no existe (o ya se pagó:
// eso es un pedido) es un 404. Un link de «Vender un plan» no es un checkout: lleva a SU lugar, Products › Checkout Links.

import { notFound, redirect } from 'next/navigation'
import { rutaDeCheckoutLink } from '@/app/admin/_polar/datos/checkout-link'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { vistaCheckouts } from '@/app/admin/_polar/datos/ventas-server'
import { Metadata } from 'next'
import CheckoutsPage from './CheckoutsPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Link de pago',
  }
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await exigirSuperAdmin()
  const { id } = await props.params
  if (!/^[1-9]\d{0,11}$/.test(id)) notFound()
  const vista = await vistaCheckouts()
  const checkout = vista.checkouts.find((c) => c.id === Number(id))
  if (!checkout) {
    if (vista.linksDeVenta.includes(Number(id))) redirect(rutaDeCheckoutLink(Number(id)))
    notFound()
  }
  return <CheckoutsPage checkout={checkout} />
}

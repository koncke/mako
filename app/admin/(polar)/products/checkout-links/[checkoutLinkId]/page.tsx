// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/products/checkout-links/[checkoutLinkId]/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Un link de «Vender un plan» (/admin/products/checkout-links/<id del cobro>). ⚠️ SÓLO EL SUPER ADMIN, antes de leer. El id
// se valida antes de buscar, y un cobro que no es un link de «Vender un plan» (uno de /planes, uno de una ficha) es un 404:
// la lista es la de la barra, nunca un cobro cualquiera de la plataforma.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerCheckoutLinks } from '@/app/admin/_polar/datos/productos-server'
import CheckoutLinksPage from './CheckoutLinksPage'

export const dynamic = 'force-dynamic'

const ID = /^[1-9]\d{0,11}$/

async function linkDe(checkoutLinkId: string) {
  if (!ID.test(checkoutLinkId)) return null
  const datos = await leerCheckoutLinks().catch(() => null)
  const checkoutLink = datos?.links.find((l) => l.id === Number(checkoutLinkId))
  return datos && checkoutLink ? { datos, checkoutLink } : null
}

export async function generateMetadata(props: { params: Promise<{ checkoutLinkId: string }> }): Promise<Metadata> {
  await exigirSuperAdmin()
  const { checkoutLinkId } = await props.params
  const r = await linkDe(checkoutLinkId)
  return {
    title: r ? r.checkoutLink.etiqueta : 'Checkout Links',
  }
}

export default async function Page(props: { params: Promise<{ checkoutLinkId: string }> }) {
  await exigirSuperAdmin()
  const { checkoutLinkId } = await props.params
  const r = await linkDe(checkoutLinkId)
  if (!r) notFound()

  return <CheckoutLinksPage checkoutLink={r.checkoutLink} productos={r.datos.productos} pasarelas={r.datos.pasarelas} monedaMp={r.datos.monedaMp} />
}

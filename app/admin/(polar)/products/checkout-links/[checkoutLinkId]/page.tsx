// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/products/checkout-links/[checkoutLinkId]/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Un link de «Vender un plan» (/admin/products/checkout-links/<id del cobro>). ⚠️ SÓLO EL SUPER ADMIN, antes de leer. El id
// se valida antes de buscar, y un cobro que no es un link de «Vender un plan» (uno de /planes, uno de una ficha) es un 404:
// la lista es la de la barra, nunca un cobro cualquiera de la plataforma.
// ⚠️ SI LA LISTA NO SE PUDO LEER NO ES UN 404 (punto 23 de docs/admin/revision-cerebro-6-11.md): un 404 pelado dice «este link
//    no existe» cuando lo que pasó es que no se pudo preguntar. Se dibuja el mismo aviso de la barra (`TITULO_SIN_LINKS`),
//    con «Reportar a Soporte». Qué contesta cada caso lo decide `buscarLinkDeVenta` (productos.ts, con su test).

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerCheckoutLinks } from '@/app/admin/_polar/datos/productos-server'
import { buscarLinkDeVenta, TITULO_SIN_LINKS, type BusquedaDeLink } from '@/app/admin/_polar/datos/productos'
import { Alert } from '@/app/admin/_polar/orbit'
import CheckoutLinksPage from './CheckoutLinksPage'

export const dynamic = 'force-dynamic'

const ID = /^[1-9]\d{0,11}$/

async function linkDe(checkoutLinkId: string): Promise<BusquedaDeLink> {
  // Un id que no es un número no se lee: es un 404 sin ir a la base.
  if (!ID.test(checkoutLinkId)) return { estado: 'no-existe' }
  const lectura = await leerCheckoutLinks().catch((e: unknown) => ({ error: e instanceof Error && e.message ? e.message : 'Sin detalle.' }))
  return buscarLinkDeVenta(lectura, checkoutLinkId)
}

export async function generateMetadata(props: { params: Promise<{ checkoutLinkId: string }> }): Promise<Metadata> {
  await exigirSuperAdmin()
  const { checkoutLinkId } = await props.params
  const r = await linkDe(checkoutLinkId)
  return {
    title: r.estado === 'ok' ? r.link.etiqueta : 'Checkout Links',
  }
}

export default async function Page(props: { params: Promise<{ checkoutLinkId: string }> }) {
  await exigirSuperAdmin()
  const { checkoutLinkId } = await props.params
  const r = await linkDe(checkoutLinkId)
  if (r.estado === 'no-existe') notFound()
  if (r.estado === 'no-pude') {
    return (
      <div className="flex w-full flex-col py-4 md:py-8">
        <Alert variant="danger" title={TITULO_SIN_LINKS} description={r.error} />
      </div>
    )
  }

  return <CheckoutLinksPage checkoutLink={r.link} productos={r.datos.productos} pasarelas={r.datos.pasarelas} monedaMp={r.datos.monedaMp} />
}

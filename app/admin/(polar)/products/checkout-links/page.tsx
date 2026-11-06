// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/products/checkout-links/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El índice de Checkout Links: como en Polar, salta al primer link de la lista (con el mismo orden y el mismo filtro de la
// barra) y, si no hay ninguno, dice que no hay y ofrece armar uno. ⚠️ SÓLO EL SUPER ADMIN, antes de leer.

import type { Metadata } from 'next'
import { LinkOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button } from '@/app/admin/_polar/orbit'
import Link from '@/app/_ui/Link'
import { MasterDetailIndex } from '@/app/admin/_polar/web/CheckoutLinks/MasterDetailIndex'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerCheckoutLinks } from '@/app/admin/_polar/datos/productos-server'
import { filtrarLinksPorProducto, leerOrdenLinks, leerProductIds, ordenarLinks } from '@/app/admin/_polar/datos/productos'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Checkout Links',
  }
}

export default async function Page(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  await exigirSuperAdmin()
  const searchParams = await props.searchParams
  const datos = await leerCheckoutLinks().catch(() => null)
  // Si no se pudo leer, la barra ya lo dice: acá no hay a dónde saltar.
  if (!datos) return null

  const productIds = leerProductIds(searchParams.productId)
  const sorting = leerOrdenLinks(searchParams.sorting)
  const primero = ordenarLinks(filtrarLinksPorProducto(datos.links, productIds, datos.productos), sorting)[0]

  if (primero) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === 'string') qs.set(k, v)
      else if (Array.isArray(v)) v.forEach((x) => qs.append(k, x))
    }
    const queryString = qs.toString()
    return <MasterDetailIndex redirectTo={`/admin/products/checkout-links/${primero.id}${queryString ? `?${queryString}` : ''}`} />
  }

  // Otherwise show empty state
  return (
    <div className="flex h-full flex-col items-center justify-center pt-32">
      <div className="flex flex-col items-center justify-center gap-y-8">
        <LinkOutlined fontSize="large" />
        <div className="flex flex-col items-center justify-center gap-y-2">
          <h3 className="text-xl">No hay links de cobro</h3>
          <p className="dark:text-polar-500 text-gray-500">Arma el link de un plan para mandárselo a quien va a pagar.</p>
        </div>
        {/* MaKo: con el plan del filtro (el «Compartir» de un plan sin links), así el formulario lo trae elegido. Polar lo suelta. */}
        <Link href={`/admin/products/checkout-links?${productIds.length ? `productId=${encodeURIComponent(productIds.join(','))}&` : ''}create_checkout_link=true`}>
          <Button>Vender un plan</Button>
        </Link>
      </div>
    </div>
  )
}

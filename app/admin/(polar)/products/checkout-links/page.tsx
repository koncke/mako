// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/products/checkout-links/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El índice de Checkout Links: como en Polar, salta al primer link de la lista (con el mismo orden y el mismo filtro de la
// barra) y, si no hay ninguno, dice que no hay y ofrece armar uno. ⚠️ SÓLO EL SUPER ADMIN, antes de leer.
// ⚠️ El salto lo da el navegador (MasterDetailIndex, después de dibujarse), no un `redirect()` de esta página en el server:
//    el layout de Admin no lo repite (app/admin/(polar)/layout-reglas.ts).

import type { Metadata } from 'next'
import { LinkOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button } from '@/app/admin/_polar/orbit'
import Link from '@/app/_ui/Link'
import { MasterDetailIndex } from '@/app/admin/_polar/web/CheckoutLinks/MasterDetailIndex'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerCheckoutLinks } from '@/app/admin/_polar/datos/productos-server'
import { destinoDelIndiceDeLinks, leerProductIds } from '@/app/admin/_polar/datos/productos'

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
  // El salto al primer link (sin `create_checkout_link`: el formulario ya lo abrió la barra), en productos.ts con su test.
  const destino = destinoDelIndiceDeLinks(searchParams, datos)
  if (destino) return <MasterDetailIndex redirectTo={destino} />

  // Otherwise show empty state
  return (
    <div className="flex h-full flex-col items-center justify-center pt-32">
      <div className="flex flex-col items-center justify-center gap-y-8">
        <LinkOutlined fontSize="large" />
        <div className="flex flex-col items-center justify-center gap-y-2">
          <h3 className="text-xl">No hay links de cobro</h3>
          <p className="dark:text-polar-500 text-gray-500">Arma el link de un plan para mandárselo a quien va a pagar.</p>
        </div>
        {/* MaKo: con el plan del filtro («Vender» desde un plan sin links), así el formulario lo trae elegido. Polar lo suelta. */}
        <Link href={`/admin/products/checkout-links?${productIds.length ? `productId=${encodeURIComponent(productIds.join(','))}&` : ''}create_checkout_link=true`}>
          <Button>Vender un plan</Button>
        </Link>
      </div>
    </div>
  )
}

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/products/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Products › Catalogue (/admin/products): los planes de MaKo. El server los lee y la vista (ProductsPage) los
// filtra en memoria. ⚠️ SÓLO EL SUPER ADMIN, en la primera línea y antes de leer (app/admin/_polar/datos/guarda.ts).

import type { Metadata } from 'next'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerProductos } from '@/app/admin/_polar/datos/productos-server'
import ProductsPage from './ProductsPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Products',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const productos = await leerProductos()
  return <ProductsPage productos={productos} />
}

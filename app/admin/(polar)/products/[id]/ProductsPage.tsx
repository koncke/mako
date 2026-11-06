'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/products/[id]/ProductsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { ProductPage } from '@/app/admin/_polar/web/Products/ProductPage/ProductPage'
import type { ProductoMako } from '@/app/admin/_polar/datos/productos'

export default function Page({ product }: { product: ProductoMako }) {
  return <ProductPage product={product} />
}

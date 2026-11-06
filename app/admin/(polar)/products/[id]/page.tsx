// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/products/[id]/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Products › <plan> (/admin/products/<id>): la ficha de un plan de MaKo. ⚠️ SÓLO EL SUPER ADMIN, en la primera
// línea y antes de leer. El id es el del plan (`esencial`, `pro`…): se busca entre los planes de hoy y, si no está, 404.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerProductos } from '@/app/admin/_polar/datos/productos-server'
import ProductsPage from './ProductsPage'

export const dynamic = 'force-dynamic'

const ID_PLAN = /^[a-z0-9-]{1,32}$/

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  await exigirSuperAdmin()
  const { id } = await props.params
  const product = ID_PLAN.test(id) ? (await leerProductos()).find((p) => p.id === id) : undefined
  return {
    title: product?.nombre ?? 'Products',
  }
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  await exigirSuperAdmin()
  const { id } = await props.params
  if (!ID_PLAN.test(id)) notFound()
  const product = (await leerProductos()).find((p) => p.id === id)
  if (!product) notFound()

  return <ProductsPage product={product} />
}

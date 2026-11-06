'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/products/ProductsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Products › Catalogue: los PLANES de MaKo (lib/planes-mako.ts), con la lista, el buscador y los filtros de Polar.
// Lo que Polar le pide a su API (`useProducts` con query, is_archived y sorting) se hace en memoria (`filtrarProductos`,
// app/admin/_polar/datos/productos.ts): son unos pocos planes. Los filtros viven en la URL, como en Polar (con
// useSearchParams y el router de la casa en vez de `nuqs`).
//
// ⚠️ LO QUE SE SACÓ, porque MaKo no tiene con qué hacerlo (docs: el informe del porte, 6/11/2026):
//    · «New Product», la selección y la barra de «Archive / Unarchive» en lote: los planes se editan en el setting
//      `planes.mako` y no hay una acción para crearlos ni archivarlos desde una pantalla.
//    · Los órdenes «Newest / Oldest» (un plan no tiene fecha) y «Show 20/50/100» con la paginación (Polar los muestra con
//      más de 20 productos; MaKo vende tres).

import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { ProductListItem } from '@/app/admin/_polar/web/Products/ProductListItem'
import { HiveOutlined, SearchFilled as Search } from '@/app/admin/_polar/orbit/icons'
import { Input } from '@/app/admin/_polar/orbit'
import { List } from '@/app/admin/_polar/orbit'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/admin/_polar/orbit'
import { ShadowBoxOnMd } from '@/app/admin/_polar/atoms/ShadowBox'
import { useRouter } from '@/app/_ui/Link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { filtrarProductos, leerMostrar, leerOrden, type Mostrar, type Orden, type ProductoMako } from '@/app/admin/_polar/datos/productos'

export default function ClientPage({ productos }: { productos: ProductoMako[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const show = leerMostrar(searchParams.get('show'))
  const sorting = leerOrden(searchParams.get('sorting'))
  const queryUrl = searchParams.get('query') ?? ''
  const [query, setQuery] = useState(queryUrl)

  const setFilters = useCallback(
    (cambios: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(cambios)) {
        if (v) params.set(k, v)
        else params.delete(k)
      }
      const qs = params.toString()
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  // El buscador de Polar espera 500 ms antes de pedir (useDebouncedCallback).
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onQueryChange = (value: string) => {
    setQuery(value)
    if (espera.current) clearTimeout(espera.current)
    espera.current = setTimeout(() => setFilters({ query: value || null }), 500)
  }
  useEffect(() => () => {
    if (espera.current) clearTimeout(espera.current)
  }, [])

  const onShowChange = useCallback((value: string) => setFilters({ show: value === 'active' ? null : (value as Mostrar) }), [setFilters])
  const onSortingChange = useCallback((value: string) => setFilters({ sorting: value === 'name' ? null : (value as Orden) }), [setFilters])

  const items = useMemo(() => filtrarProductos(productos, { query: queryUrl, show, sorting }), [productos, queryUrl, show, sorting])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Input
              className="w-full md:max-w-64"
              preSlot={<Search fontSize="small" />}
              placeholder="Buscar planes"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            <Select value={show} onValueChange={onShowChange}>
              <SelectTrigger className="w-full md:max-w-fit">
                <SelectValue placeholder="Mostrar los archivados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="active">Activos</SelectItem>
                <SelectItem value="archived">Archivados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sorting} onValueChange={onSortingChange}>
              <SelectTrigger className="w-full md:max-w-fit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Nombre A-Z</SelectItem>
                <SelectItem value="-name">Nombre Z-A</SelectItem>
                <SelectItem value="price_amount">Precio: de menor a mayor</SelectItem>
                <SelectItem value="-price_amount">Precio: de mayor a menor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {items.length > 0 ? (
          <List size="small">
            {items.map((product) => (
              <ProductListItem key={product.id} product={product} />
            ))}
          </List>
        ) : (
          <ShadowBoxOnMd className="items-center justify-center gap-y-6 md:flex md:flex-col md:py-48">
            <HiveOutlined className="dark:text-polar-600 text-5xl text-gray-300" fontSize="large" />
            <div className="flex flex-col items-center gap-y-6">
              <div className="flex flex-col items-center gap-y-2">
                <h3 className="text-lg font-medium">No hay planes</h3>
                <p className="dark:text-polar-500 text-gray-500">
                  {productos.length > 0 ? 'Ningún plan coincide con lo que buscas.' : 'Todavía no hay planes cargados.'}
                </p>
              </div>
            </div>
          </ShadowBoxOnMd>
        )}
      </div>
    </DashboardBody>
  )
}

'use client'

// Admin › Products › Templates (18/11/2026): la lista, el buscador y los filtros del Catalogue de Polar (../ProductsPage.tsx,
// copiado de polarsource/polar, Apache-2.0; aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR), con las plantillas que
// los negocios compartieron. Los filtros viven en la URL, como allá (`?query=`, `?show=`, `?sorting=`), y se aplican en memoria
// (`filtrarPlantillas`, app/admin/_polar/datos/plantillas.ts, con su test).
// ⚠️ «No pude leer» es su propio aviso (con «Reportar a Soporte»), nunca la lista vacía; y si la lectura llegó a su tope, se dice.

import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { HiveOutlined, SearchFilled as Search } from '@/app/admin/_polar/orbit/icons'
import { Alert, Input, List } from '@/app/admin/_polar/orbit'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/admin/_polar/orbit'
import { ShadowBoxOnMd } from '@/app/admin/_polar/atoms/ShadowBox'
import { useRouter } from '@/app/_ui/Link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  filtrarPlantillas, leerMostrarPlantillas, leerOrdenPlantillas, type MostrarPlantillas, type OrdenPlantillas, type PlantillaModerada,
} from '@/app/admin/_polar/datos/plantillas'
import { PlantillaListItem } from './PlantillaListItem'

export default function PlantillasPage({ datos }: { datos: { plantillas: PlantillaModerada[]; recortado: boolean } | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const show = leerMostrarPlantillas(searchParams.get('show'))
  const sorting = leerOrdenPlantillas(searchParams.get('sorting'))
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

  const onShowChange = useCallback((value: string) => setFilters({ show: value === 'publicadas' ? null : (value as MostrarPlantillas) }), [setFilters])
  const onSortingChange = useCallback((value: string) => setFilters({ sorting: value === '-estrellas' ? null : (value as OrdenPlantillas) }), [setFilters])

  const todas = datos?.plantillas ?? []
  const items = useMemo(() => filtrarPlantillas(todas, { query: queryUrl, show, sorting }), [todas, queryUrl, show, sorting])

  return (
    <DashboardBody>
      <div className="flex flex-col gap-y-8">
        {!datos && <Alert variant="danger" title="No pude leer las plantillas" description="Recarga la página en un momento." />}
        {datos?.recortado && <Alert variant="warning" title="Se muestran las primeras" description="Hay más plantillas de las que entran en esta lista." />}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <Input
              className="w-full md:max-w-64"
              preSlot={<Search fontSize="small" />}
              placeholder="Buscar plantillas"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
            />
            <Select value={show} onValueChange={onShowChange}>
              <SelectTrigger className="w-full md:max-w-fit">
                <SelectValue placeholder="Mostrar las retiradas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="publicadas">En la galería</SelectItem>
                <SelectItem value="retiradas">Retiradas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sorting} onValueChange={onSortingChange}>
              <SelectTrigger className="w-full md:max-w-fit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-estrellas">Más estrellas</SelectItem>
                <SelectItem value="-usos">Más usadas</SelectItem>
                <SelectItem value="-publicada">Más recientes</SelectItem>
                <SelectItem value="titulo">Nombre A-Z</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {items.length > 0 ? (
          <List size="small">
            {items.map((p) => (
              <PlantillaListItem key={p.id} plantilla={p} />
            ))}
          </List>
        ) : datos ? (
          <ShadowBoxOnMd className="items-center justify-center gap-y-6 md:flex md:flex-col md:py-48">
            <HiveOutlined className="dark:text-polar-600 text-5xl text-gray-300" fontSize="large" />
            <div className="flex flex-col items-center gap-y-6">
              <div className="flex flex-col items-center gap-y-2">
                <h3 className="text-lg font-medium">No hay plantillas</h3>
                <p className="dark:text-polar-500 text-gray-500">
                  {todas.length > 0 ? 'Ninguna plantilla coincide con lo que buscas.' : 'Todavía ningún negocio compartió una plantilla.'}
                </p>
              </div>
            </div>
          </ShadowBoxOnMd>
        ) : null}
      </div>
    </DashboardBody>
  )
}

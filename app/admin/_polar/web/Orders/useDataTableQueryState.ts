'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/hooks/useDataTableQueryState.ts. Aviso: lib/avisos/LICENSE-POLAR
// y lib/avisos/NOTICE-POLAR.
//
// MaKo: sin `nuqs`. La página, el tamaño y el orden viven en la URL (`page`, `limit`, `sorting`, como en Polar) con
// useSearchParams para leer y `cambiarQuery` (web/Customer/useClientSidePagination.ts) para escribir, y `useQueryParams` hace lo
// mismo para los filtros de cada página: un solo cambio de la URL por vez, así la página vuelve a la 1 en el mismo paso que el
// filtro.
// ⚠️ SIN IR AL SERVER (punto 32 de docs/admin/revision-cerebro-6-11.md): todas las filas de Sales ya están en el navegador
//    (cada page.tsx las lee enteras y no mira la query), así que un filtro, un orden o una página nueva es cambiar la URL con
//    `history.replaceState` (el `shallow` de nuqs que usa Polar). Con `router.replace`, cada clic volvía a leer TODO del server
//    y la pantalla parecía no responder hasta que volvía. Un page.tsx de Sales que empiece a leer la query tiene que volver a
//    pedir el server (`router.refresh()`), o deja de filtrar.

import { useSearchParams } from 'next/navigation'
import { functionalUpdate, type OnChangeFn, type PaginationState, type SortingState } from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'
import { cambiarQuery } from '@/app/admin/_polar/web/Customer/useClientSidePagination'

/** Los parámetros de la URL y un `set` que cambia varios a la vez (null saca uno). */
export function useQueryParams(): [URLSearchParams, (cambios: Record<string, string | null>) => void] {
  const sp = useSearchParams()
  const params = useMemo(() => new URLSearchParams(sp?.toString() ?? ''), [sp])
  // `cambiarQuery` parte de la URL de la barra y toca sólo estos parámetros (null o '' los saca).
  const set = useCallback((cambios: Record<string, string | null>) => cambiarQuery(cambios), [])
  return [params, set]
}

const aParam = (s: SortingState) => s.map((x) => `${x.desc ? '-' : ''}${x.id}`).join(',')
const deParam = (p: string): SortingState =>
  p.split(',').filter(Boolean).map((x) => (x.startsWith('-') ? { id: x.slice(1), desc: true } : { id: x, desc: false }))

export const useDataTableQueryState = ({
  defaultSorting = [],
  defaultPageSize = 20,
}: { defaultSorting?: SortingState; defaultPageSize?: number } = {}) => {
  const [params, set] = useQueryParams()
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1)
  const limit = Math.max(1, Number.parseInt(params.get('limit') ?? String(defaultPageSize), 10) || defaultPageSize)
  const sortingParam = params.get('sorting') ?? aParam(defaultSorting)

  const pagination = useMemo<PaginationState>(() => ({ pageIndex: page - 1, pageSize: limit }), [page, limit])
  const sorting = useMemo<SortingState>(() => deParam(sortingParam), [sortingParam])

  const setPagination = useCallback<OnChangeFn<PaginationState>>(
    (updater) => {
      const u = functionalUpdate(updater, pagination)
      set({ page: u.pageIndex > 0 ? String(u.pageIndex + 1) : null, limit: u.pageSize !== defaultPageSize ? String(u.pageSize) : null })
    },
    [pagination, set, defaultPageSize],
  )
  const setSorting = useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const u = functionalUpdate(updater, sorting)
      set({ sorting: aParam(u) || null, page: null })
    },
    [sorting, set],
  )
  const resetPage = useCallback(() => set({ page: null }), [set])

  return { pagination, setPagination, sorting, setSorting, resetPage, params, setParams: set }
}

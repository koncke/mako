'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/hooks/useDataTableQueryState.ts. Aviso: lib/avisos/LICENSE-POLAR
// y lib/avisos/NOTICE-POLAR.
//
// MaKo: sin `nuqs`. La página, el tamaño y el orden viven en la URL (`page`, `limit`, `sorting`, como en Polar) con
// useSearchParams + `useRouter` de app/_ui/Link (preserva el `?ws=`, que acá no hay), y `useQueryParams` hace lo mismo para los
// filtros de cada página: un solo `replace` por cambio, así la página vuelve a la 1 en el mismo paso que el filtro.

import { usePathname, useSearchParams } from 'next/navigation'
import { functionalUpdate, type OnChangeFn, type PaginationState, type SortingState } from '@tanstack/react-table'
import { useCallback, useMemo } from 'react'
import { useRouter } from '@/app/_ui/Link'

/** Los parámetros de la URL y un `set` que cambia varios a la vez (null saca uno). */
export function useQueryParams(): [URLSearchParams, (cambios: Record<string, string | null>) => void] {
  const sp = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const params = useMemo(() => new URLSearchParams(sp?.toString() ?? ''), [sp])
  const set = useCallback(
    (cambios: Record<string, string | null>) => {
      const q = new URLSearchParams(sp?.toString() ?? '')
      for (const [k, v] of Object.entries(cambios)) {
        if (v == null || v === '') q.delete(k)
        else q.set(k, v)
      }
      const s = q.toString()
      router.replace(`${pathname ?? ''}${s ? `?${s}` : ''}`, { scroll: false })
    },
    [sp, pathname, router],
  )
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

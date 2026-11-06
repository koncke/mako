'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/hooks/useClientSidePagination.ts (y la parte de paginación
// de hooks/useDataTableQueryState.ts). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: la página y el tamaño van en la URL (`?page=&limit=`) como en Polar, sin `nuqs`: useSearchParams para leer y
// `cambiarQuery` para escribir. Vive en Customer/ porque en esta área lo usan Top Customers, At Risk y Cost Drivers.

import type { DataTablePaginationState } from '@/app/admin/_polar/orbit'
import { functionalUpdate, type OnChangeFn } from '@tanstack/react-table'
import { useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'

/**
 * Cambia parámetros de la URL SIN ir al server (el `shallow` de nuqs, que es lo que usa Polar): Next sincroniza
 * `window.history.replaceState` con useSearchParams. Con `router.replace` cada tecla del buscador volvía a leer la página.
 * Se parte de la URL de la barra y se toca sólo la query. `null` saca el parámetro.
 */
export function cambiarQuery(cambios: Record<string, string | number | null>) {
  const url = new URL(window.location.href)
  for (const [k, v] of Object.entries(cambios)) {
    if (v == null || v === '') url.searchParams.delete(k)
    else url.searchParams.set(k, String(v))
  }
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
}

const entero = (v: string | null, def: number) => {
  const n = Number.parseInt(v ?? '', 10)
  return Number.isFinite(n) ? n : def
}

/**
 * Client-side pagination over a fully fetched list, for endpoints that return
 * a bounded ranking rather than paginated results. Pagination state is bound
 * to the URL query string; malformed or out-of-range URL values are clamped to
 * the valid range. Call `resetPage` when a filter owned by the page (e.g. the
 * chart range) changes.
 */
export const useClientSidePagination = <T>(
  items: T[],
  defaultPageSize = 20,
) => {
  const searchParams = useSearchParams()

  const rawPagination = {
    pageIndex: entero(searchParams.get('page'), 1) - 1,
    pageSize: entero(searchParams.get('limit'), defaultPageSize),
  }

  const pageSize = Math.max(1, rawPagination.pageSize)
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))
  const pageIndex = Math.min(
    Math.max(0, rawPagination.pageIndex),
    pageCount - 1,
  )

  const pagination = useMemo(
    () => ({ pageIndex, pageSize }),
    [pageIndex, pageSize],
  )

  const setPagination = useCallback<OnChangeFn<DataTablePaginationState>>(
    (updater) => {
      const updated = functionalUpdate(updater, pagination)
      cambiarQuery({ page: updated.pageIndex + 1, limit: updated.pageSize })
    },
    [pagination],
  )

  const resetPage = useCallback(() => cambiarQuery({ page: 1 }), [])

  const pageItems = useMemo(
    () => items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize),
    [items, pageIndex, pageSize],
  )

  return {
    pageItems,
    pagination,
    setPagination,
    resetPage,
    rowCount: items.length,
    pageCount,
  }
}

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Search/types.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: lo que Polar trae de `GET /v1/search` (productos, clientes, pedidos, suscripciones) son acá los negocios y las
// personas del índice que lee el server (app/admin/_polar/datos/busqueda-tipos.ts).

import type { ResultadoNegocio, ResultadoPersona } from '@/app/admin/_polar/datos/busqueda-tipos'

type SearchResultItem =
  | (ResultadoNegocio & { type: 'customer'; id: string })
  | (Omit<ResultadoPersona, 'id'> & { type: 'member'; id: string })

export interface SearchResultPage {
  id: string
  type: 'page'
  title: string
  url: string
  icon?: React.ReactNode
}

export type SearchResult = SearchResultItem | SearchResultPage

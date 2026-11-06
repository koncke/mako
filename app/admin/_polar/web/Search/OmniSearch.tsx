'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Search/OmniSearch.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la búsqueda ⌘K de Admin. Lo que Polar pide a `GET /v1/search` (con su espera de 400 ms y su «cargando») acá se busca
// en memoria sobre el índice que lee el server (app/admin/_polar/datos/busqueda.ts): los NEGOCIOS llevan a
// Customers › <negocio> y las PERSONAS a Customers › <negocio> › Members, donde se gestionan. Las secciones («Ir a») salen
// de la barra de Admin, como en Polar. Sin «quick actions»: la única de Polar es «Create Product» (/products/new), que
// Admin no tiene.
// ⚠️ SI EL ÍNDICE NO SE PUDO LEER, SE DICE (punto 23 de docs/admin/revision-cerebro-6-11.md): arriba de la lista va el aviso
//    «No pude leer los negocios» (con «Reportar a Soporte»), y nunca «No hay resultados», que se lee como que el negocio no
//    existe. Las secciones («Ir a») se siguen encontrando: salen de la barra, no del índice.

import {
  useGeneralRoutes,
  useOrganizationRoutes,
} from '@/app/admin/_polar/web/Dashboard/navigation'
import { useSettingsRoutes } from '@/app/admin/_polar/web/Dashboard/navigationSettings'
import {
  buscar,
  hrefDeNegocio,
  hrefDePersona,
  TITULO_SIN_INDICE,
  type IndiceBusqueda,
} from '@/app/admin/_polar/datos/busqueda-tipos'
import { Alert } from '@/app/admin/_polar/orbit'
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/app/admin/_polar/ui/command'
import { Dialog as Dialog } from 'radix-ui'
import { portalPl } from '@/app/admin/_polar/portal'
import { useRouter } from '@/app/_ui/Link'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Result } from './components/Result'
import { SearchResult, SearchResultPage } from './types'

/** El aviso de un índice que no se pudo leer. Sin error, nada. */
export const AvisoDelIndice = ({ indice }: { indice: Pick<IndiceBusqueda, 'error'> }) =>
  indice.error ? (
    <div className="px-3 pb-2">
      <Alert variant="danger" title={TITULO_SIN_INDICE} description={indice.error} />
    </div>
  ) : null

/** Lo que dice la lista sin nada que mostrar: con el índice caído no hay «no hay resultados» (eso lo dice el aviso). */
export const textoSinResultados = (query: string, indice: Pick<IndiceBusqueda, 'error'>): string | null =>
  indice.error ? null : `No hay resultados para «${query.trim()}»`

interface OmniSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  indice: IndiceBusqueda
}

export const OmniSearch = ({
  open,
  onOpenChange,
  indice,
}: OmniSearchProps) => {
  const router = useRouter()
  const [query, setQuery] = useState('')

  const generalRoutes = useGeneralRoutes()
  const orgRoutes = useOrganizationRoutes()
  const settingsRoutes = useSettingsRoutes()
  const allRoutes = useMemo(
    () => [
      ...generalRoutes,
      ...orgRoutes.map((route) =>
        route.id === 'settings' ? { ...route, subs: settingsRoutes } : route,
      ),
    ],
    [generalRoutes, orgRoutes, settingsRoutes],
  )

  const pageResults = useMemo(() => {
    if (!query.trim()) return []

    const searchLower = query.toLowerCase()
    const pages: SearchResultPage[] = []

    allRoutes.forEach((route) => {
      if (route.title.toLowerCase().includes(searchLower)) {
        pages.push({
          id: route.id,
          type: 'page',
          title: route.title,
          url: route.link,
          icon: route.icon,
        })
      }

      route.subs?.forEach((sub) => {
        if (sub.title.toLowerCase().includes(searchLower)) {
          pages.push({
            id: `${route.id}-${sub.title}`,
            type: 'page',
            title: `${route.title} → ${sub.title}`,
            url: sub.link,
            icon: sub.icon || route.icon,
          })
        }
      })
    })

    return pages.slice(0, 5)
  }, [query, allRoutes])

  const results = useMemo<SearchResult[]>(() => {
    const encontrados = buscar(indice, query)
    return [
      ...encontrados.negocios.map((n) => ({ ...n, type: 'customer' as const, id: `ws-${n.ws}` })),
      ...encontrados.personas.map((p) => ({ ...p, type: 'member' as const, id: `u-${p.id}` })),
    ]
  }, [indice, query])

  const combinedResults = useMemo(() => {
    return [...pageResults, ...results]
  }, [pageResults, results])

  const handleSelect = (result: SearchResult) => {
    let path = ''

    switch (result.type) {
      case 'page':
        path = result.url
        break
      case 'customer':
        path = hrefDeNegocio(result.ws)
        break
      case 'member':
        path = result.ws != null ? hrefDePersona(result.ws) : ''
        break
    }

    if (path) {
      router.push(path)
      onOpenChange(false)
      setQuery('')
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'page':
        return 'Ir a'
      case 'customer':
        return 'Customers'
      case 'member':
        return 'Members'
      default:
        return type
    }
  }

  const groupedResults: Record<string, SearchResult[]> = useMemo(
    () =>
      combinedResults.reduce<Record<string, SearchResult[]>>(
        (acc, result) => {
          if (!acc[result.type]) {
            acc[result.type] = []
          }
          acc[result.type].push(result)
          return acc
        },
        {},
      ),
    [combinedResults],
  )

  const renderResult = (result: SearchResult) => {
    switch (result.type) {
      case 'page':
        return <Result icon={result.icon} title={result.title} />
      case 'customer':
        return <Result title={result.nombre} description={result.detalle} />
      case 'member':
        return (
          <Result
            title={result.nombre || result.email}
            description={[result.nombre ? result.email : null, result.negocio].filter(Boolean).join(' • ') || undefined}
          />
        )
    }
  }

  const cleanState = !query.trim()

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={portalPl()}>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4 dark:bg-polar-950 dark:border-polar-800/80 fixed top-[15%] left-[50%] z-50 w-full max-w-2xl translate-x-[-50%] overflow-hidden rounded-xl border border-gray-200/80 bg-white p-0 shadow-2xl ring-1 ring-black/5 dark:ring-white/5">
          <Dialog.DialogTitle className="sr-only">Buscar</Dialog.DialogTitle>
          <Command
            className="[&_[cmdk-group-heading]]:text-xxs dark:[&_[cmdk-group-heading]]:text-polar-500! rounded-xl border-none [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-gray-500! [&_[cmdk-group-heading]]:uppercase dark:[&_[cmdk-group-heading]]:text-white [&_[cmdk-group]]:px-3 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
            shouldFilter={false}
          >
            <div className="flex grow items-center px-4">
              <CommandInput
                placeholder="Busca negocios, personas o secciones…"
                value={query}
                onValueChange={setQuery}
                wrapperClassName="border-none grow"
                className="dark:placeholder:text-polar-500 flex w-full grow border-0 text-base placeholder:text-gray-400 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>

            {indice.error && (
              <div className="dark:border-polar-700 border-t border-gray-200 pt-3">
                <AvisoDelIndice indice={indice} />
              </div>
            )}

            <CommandList
              className={twMerge(
                'dark:border-polar-700 max-h-[420px] overflow-y-auto border-t border-gray-200 px-0 pt-2 pb-3',
                cleanState ? 'hidden' : '',
              )}
            >
              {combinedResults.length === 0 ? (
                textoSinResultados(query, indice) && (
                  <div className="dark:text-polar-500 py-12 text-center text-sm text-gray-500">
                    {textoSinResultados(query, indice)}
                  </div>
                )
              ) : (
                <>
                  {Object.entries(groupedResults).map(
                    ([type, typeResults], index) => {
                      const isLastGroup =
                        index === Object.entries(groupedResults).length - 1
                      return (
                        <CommandGroup
                          key={type}
                          heading={getTypeLabel(type)}
                          className={twMerge(
                            'p-0',
                            isLastGroup ? 'mb-0' : 'mb-2',
                          )}
                        >
                          {typeResults.map((result, resultIndex) => {
                            const key = `${result.type}-${result.id}`
                            const isFirst = index === 0 && resultIndex === 0
                            const isLastItem =
                              isLastGroup &&
                              resultIndex === typeResults.length - 1
                            return (
                              <CommandItem
                                key={key}
                                value={key}
                                onSelect={() => handleSelect(result)}
                                className={twMerge(
                                  'group dark:data-[selected=true]:bg-polar-800 cursor-pointer rounded-xl px-3 py-3 text-gray-700 data-[selected=true]:bg-gray-50 data-[selected=true]:text-inherit dark:text-white',
                                  isFirst ? 'scroll-mt-12' : '',
                                  isLastItem
                                    ? 'mb-3 scroll-mb-12'
                                    : resultIndex < typeResults.length - 1
                                      ? 'mb-1'
                                      : '',
                                )}
                              >
                                {renderResult(result)}
                              </CommandItem>
                            )
                          })}
                        </CommandGroup>
                      )
                    },
                  )}
                </>
              )}
            </CommandList>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

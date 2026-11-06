'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/events/EventsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// LA VISTA de Admin › Analytics › Events, PURA (todo por props: se captura con datos de ejemplo). La misma pantalla de
// Polar: la barra de filtros a la izquierda, el histograma, la búsqueda, la lista que se carga de a 100 al bajar y el detalle
// a la derecha, con el estado entero en la URL. Lo que cambia:
//   · los eventos llegan del server ya leídos (`datos/eventos-server.ts`) y se filtran en memoria (`datos/eventos.ts`);
//   · la URL se escribe con `history.pushState`/`replaceState` (lo que hacía `nuqs`): Next sincroniza `useSearchParams`
//     sin volver a pedir la página, así que cambiar un filtro no relee nada. Un cambio que toca varias claves va en UNA
//     entrada del historial (nuqs las juntaba igual);
//   · se dibuja recién montada en el navegador (hasta ahí, el esqueleto de Polar): «los últimos 3 meses» se cuenta con la
//     hora de quien mira, y en el server la lista y las horas saldrían en otra zona;
//   · lo que un lector dejó afuera por su tope se dice arriba de la lista cuando el rango llega hasta ahí (`cortes`), y lo
//     que no se pudo leer, arriba de todo (`avisos`).
// Se sacaron los filtros de origen, costo, IA y metadatos (EventsSidebar.tsx dice por qué).

import { EventDetailPanel } from '@/app/admin/_polar/web/Events/EventDetailPanel'
import { EventLog } from '@/app/admin/_polar/web/Events/EventLog'
import { EventLogHeader } from '@/app/admin/_polar/web/Events/EventLogRow'
import { EventLogSkeleton } from '@/app/admin/_polar/web/Events/EventLogSkeleton'
import { EventSearch } from '@/app/admin/_polar/web/Events/EventSearch'
import { EventsHistogram } from '@/app/admin/_polar/web/Events/EventsHistogram'
import {
  formatEventCount,
  formatTimeRange,
  isHourlyRange,
  TimeRange,
} from '@/app/admin/_polar/web/Events/EventsHistogramControls'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  DateRangeInterval,
  dateRangeIntervals,
} from '@/app/admin/_polar/web/Metrics/DateRangePicker'
import {
  conteoPorTipo,
  cortesVisibles,
  filtrarEventos,
  textoDeCorte,
  type Orden,
  type VistaEventos,
} from '@/app/admin/_polar/datos/eventos'
import { Alert, Spinner, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { Search } from '@/app/admin/_polar/orbit/icons'
import { min, startOfDay } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EventsSidebar } from './EventsSidebar'
import { DEFAULT_RANGE, recentRangeIntervals } from './rangePresets'

const PAGE_SIZE = 100

type Cambios = Record<string, string | null>

/** Escribe claves de la URL sin pedirle la página al server (como `nuqs` en modo «shallow»). */
const escribirUrl = (cambios: Cambios, history: 'push' | 'replace' = 'push') => {
  const params = new URLSearchParams(window.location.search)
  for (const [k, v] of Object.entries(cambios)) {
    if (v == null || v === '') params.delete(k)
    else params.set(k, v)
  }
  const q = params.toString()
  const url = `${window.location.pathname}${q ? `?${q}` : ''}`
  if (history === 'push') window.history.pushState(null, '', url)
  else window.history.replaceState(null, '', url)
}

const fechaDe = (v: string | null): Date | null => {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}
const listaDe = (v: string | null): string[] | null => {
  const l = (v ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  return l.length ? l : null
}
const numerosDe = (v: string | null): number[] | null => {
  const l = (listaDe(v) ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0)
  return l.length ? l : null
}

const useDebounce = <T,>(value: T, ms: number): T => {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

const useInViewport = <T extends HTMLElement = HTMLElement>() => {
  const observer = useRef<IntersectionObserver | null>(null)
  const [inViewport, setInViewport] = useState(false)
  const ref = useCallback((node: T | null) => {
    if (typeof IntersectionObserver === 'undefined') return
    observer.current?.disconnect()
    if (!node) {
      setInViewport(false)
      return
    }
    observer.current = new IntersectionObserver((entries) =>
      setInViewport(entries.some((entry) => entry.isIntersecting)),
    )
    observer.current.observe(node)
  }, [])
  return { ref, inViewport }
}

const useMontado = () => {
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  return montado
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })

const ClientPage = ({ vista }: { vista: VistaEventos }) => {
  const montado = useMontado()
  const searchParams = useSearchParams()

  const sorting: Orden = searchParams.get('sorting') === 'timestamp' ? 'timestamp' : '-timestamp'
  const query = searchParams.get('query')
  const selectedEventTypes = listaDe(searchParams.get('eventTypes'))
  const range = searchParams.get('range')
  const customStartDate = fechaDe(searchParams.get('startDate'))
  const customEndDate = fechaDe(searchParams.get('endDate'))
  const selectionStart = fechaDe(searchParams.get('selectionStart'))
  const selectionEnd = fechaDe(searchParams.get('selectionEnd'))
  const selectedCustomerIds = numerosDe(searchParams.get('customerIds'))
  const selectedEventId = searchParams.get('event')

  const seleccion = (selection: TimeRange | null): Cambios => ({
    selectionStart: selection?.from.toISOString() ?? null,
    selectionEnd: selection?.to.toISOString() ?? null,
  })
  const setSelection = (selection: TimeRange | null) => escribirUrl(seleccion(selection))

  const earliest = useMemo(
    () => startOfDay(min([new Date(vista.earliest), new Date()])),
    [vista.earliest],
  )
  const [rangeAnchor, setRangeAnchor] = useState(() => new Date())
  const rangeIntervals = recentRangeIntervals(rangeAnchor)
  const standardIntervals = dateRangeIntervals(earliest)
  const isCustomRange = customStartDate !== null && customEndDate !== null
  const selectedRange = isCustomRange ? null : (range ?? DEFAULT_RANGE)
  const preset =
    [...rangeIntervals, ...standardIntervals].find(
      (interval) => interval.slug === selectedRange,
    ) ?? rangeIntervals[0]
  const startDate = isCustomRange ? customStartDate : preset.value[0]
  const endDate = isCustomRange ? customEndDate : preset.value[1]
  const selection =
    selectionStart !== null && selectionEnd !== null
      ? { from: selectionStart, to: selectionEnd }
      : null
  const isDefaultTimeRange =
    range === null && !isCustomRange && selection === null
  const listStartDate = selection?.from ?? startDate
  const listEndDate = selection?.to ?? endDate

  const stepToEvent = (id: string) =>
    escribirUrl({ event: id }, selectedEventId === null ? 'push' : 'replace')
  const setSelectedEventId = (id: string | null) => escribirUrl({ event: id })

  const debouncedQuery = useDebounce(query, 500)
  const searchQuery =
    debouncedQuery && debouncedQuery.length >= 3 ? debouncedQuery : null

  // Las claves de los filtros en valores simples: con ellas se recalculan la lista, el histograma y los conteos.
  const tiposClave = searchParams.get('eventTypes')
  const negociosClave = searchParams.get('customerIds')
  const listaDesde = listStartDate.getTime()
  const listaHasta = listEndDate.getTime()
  const rangoDesde = startDate.getTime()
  const rangoHasta = endDate.getTime()

  const lista = useMemo(
    () =>
      filtrarEventos(vista.eventos, {
        desde: new Date(listaDesde),
        hasta: new Date(listaHasta),
        nombres: listaDe(tiposClave),
        negocios: numerosDe(negociosClave),
        query: searchQuery,
        orden: sorting,
      }),
    [vista.eventos, listaDesde, listaHasta, tiposClave, negociosClave, searchQuery, sorting],
  )
  const histograma = useMemo(
    () =>
      filtrarEventos(vista.eventos, {
        desde: new Date(rangoDesde),
        hasta: new Date(rangoHasta),
        nombres: listaDe(tiposClave),
        negocios: numerosDe(negociosClave),
        query: searchQuery,
      }),
    [vista.eventos, rangoDesde, rangoHasta, tiposClave, negociosClave, searchQuery],
  )
  const eventTypes = useMemo(
    () =>
      conteoPorTipo(vista.eventos, {
        desde: new Date(listaDesde),
        hasta: new Date(listaHasta),
        negocios: numerosDe(negociosClave),
        query: searchQuery,
      }),
    [vista.eventos, listaDesde, listaHasta, negociosClave, searchQuery],
  )
  const todosLosTipos = useMemo(
    () => conteoPorTipo(vista.eventos, { desde: new Date(0), hasta: new Date(8.64e15) }),
    [vista.eventos],
  )
  const cortes = cortesVisibles(vista.cortes, listStartDate)

  const [limite, setLimite] = useState(PAGE_SIZE)
  const filtrosClave = searchParams.toString().replace(/(^|&)event=[^&]*/, '')
  const [filtrosVistos, setFiltrosVistos] = useState(filtrosClave)
  if (filtrosClave !== filtrosVistos) {
    setFiltrosVistos(filtrosClave)
    setLimite(PAGE_SIZE)
  }
  const selectedIndexInList = lista.findIndex((e) => e.id === selectedEventId)
  const items = lista.slice(0, Math.max(limite, selectedIndexInList + 1))
  const hasNextPage = items.length < lista.length

  const { ref: loadMoreRef, inViewport } = useInViewport<HTMLDivElement>()
  useEffect(() => {
    if (inViewport && hasNextPage) setLimite((l) => l + PAGE_SIZE)
  }, [inViewport, hasNextPage, items.length])

  const toggleEventType = (name: string) => {
    const prev = selectedEventTypes ?? []
    const next = prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    escribirUrl({ eventTypes: next.length ? next.join(',') : null })
  }

  const onDateRangeChange = (
    dateRange: { from: Date; to: Date },
    interval?: DateRangeInterval,
  ) => {
    if (interval) {
      escribirUrl({
        ...seleccion(null),
        range: interval.slug === DEFAULT_RANGE ? null : interval.slug,
        startDate: null,
        endDate: null,
      })
      setRangeAnchor(new Date())
      return
    }
    escribirUrl({
      ...seleccion(null),
      range: null,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
    })
  }

  const resetDateRange = () => {
    escribirUrl({ range: null, startDate: null, endDate: null })
    setRangeAnchor(new Date())
  }

  const onZoom = (dateRange: TimeRange, nextSelection: TimeRange | null) => {
    escribirUrl({
      range: null,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      ...seleccion(nextSelection),
    })
  }

  const hasActiveFilters =
    sorting !== '-timestamp' ||
    [
      query,
      selectedEventTypes,
      range,
      customStartDate,
      customEndDate,
      selectionStart,
      selectionEnd,
      selectedCustomerIds,
    ].some((value) => value !== null)

  const resetFilters = () => {
    escribirUrl({
      sorting: null,
      query: null,
      eventTypes: null,
      range: null,
      startDate: null,
      endDate: null,
      ...seleccion(null),
      customerIds: null,
    })
    setRangeAnchor(new Date())
  }

  const totalCount = lista.length
  const selectedIndex = items.findIndex((e) => e.id === selectedEventId)
  const previousEvent = selectedIndex > 0 ? items[selectedIndex - 1] : null
  const nextEvent = selectedIndex >= 0 ? (lista[selectedIndex + 1] ?? null) : null
  const selectedEvent = selectedEventId
    ? (vista.eventos.find((e) => e.id === selectedEventId) ?? null)
    : null

  return (
    <DashboardBody
      title={
        <Box
          flexGrow={1}
          alignItems="baseline"
          justifyContent="between"
          gap="s"
        >
          <Text as="h1" variant="heading-xxs">
            Events
          </Text>
          {montado && (
            <Text variant="heading-xxs" color="muted" tabularNums>
              {formatEventCount(totalCount)}
            </Text>
          )}
        </Box>
      }
      wrapperClassName="gap-6 pt-4 md:pt-6"
      className="min-h-0 flex-1 md:pb-0"
      contextViewPlacement="left"
      contextViewTitle="Filtros"
      contextViewClassName="w-full lg:max-w-[300px] xl:max-w-[300px] h-full overflow-y-hidden"
      contextView={
        <EventsSidebar
          earliest={earliest}
          dateRange={{ from: startDate, to: endDate }}
          rangeIntervals={rangeIntervals}
          selectedRange={selectedRange}
          onDateRangeChange={onDateRangeChange}
          sorting={sorting}
          onSortingChange={(value) =>
            escribirUrl({ sorting: value === '-timestamp' ? null : value })
          }
          eventTypes={eventTypes}
          selectedEventTypes={selectedEventTypes ?? []}
          onToggleEventType={toggleEventType}
          negocios={vista.negocios}
          selectedCustomerIds={selectedCustomerIds}
          onSelectCustomerIds={(ids) =>
            escribirUrl({ customerIds: ids && ids.length ? ids.join(',') : null })
          }
          hasActiveFilters={hasActiveFilters}
          onReset={resetFilters}
        />
      }
      detailView={
        selectedEventId && montado ? (
          <EventDetailPanel
            key={selectedEventId}
            event={selectedEvent}
            onPrevious={
              previousEvent ? () => stepToEvent(previousEvent.id) : undefined
            }
            onNext={nextEvent ? () => stepToEvent(nextEvent.id) : undefined}
            onClose={() => setSelectedEventId(null)}
          />
        ) : undefined
      }
      wide
    >
      <Box flexDirection="column" gap="xl" flexGrow={1} minHeight={0}>
        {vista.avisos.length > 0 && (
          <Alert
            variant="warning"
            soporte
            title="No pude leer todo: pueden faltar eventos"
            description={vista.avisos.join(' · ')}
          />
        )}
        {montado ? (
          <EventsHistogram
            events={histograma}
            startDate={startDate}
            endDate={endDate}
            selection={selection}
            onSelectionChange={setSelection}
            onZoom={onZoom}
            earliest={earliest}
            latest={rangeAnchor}
          />
        ) : (
          <Box height={116} flexShrink={0} />
        )}
        <Box alignItems="start" gap="s">
          <div className="min-w-0 flex-1">
            <EventSearch
              eventTypes={todosLosTipos}
              negocios={vista.negocios}
              query={query}
              onQueryChange={(value) => {
                escribirUrl({ query: value }, 'replace')
              }}
              selectedEventTypes={selectedEventTypes ?? []}
              onEventTypesChange={(names) => {
                escribirUrl({ eventTypes: names && names.length > 0 ? names.join(',') : null })
              }}
              selectedCustomerIds={selectedCustomerIds ?? []}
              onCustomerIdsChange={(ids) => {
                escribirUrl({ customerIds: ids && ids.length > 0 ? ids.join(',') : null })
              }}
              timeRangeLabel={
                isDefaultTimeRange || !montado
                  ? null
                  : formatTimeRange(
                      selection ?? { from: startDate, to: endDate },
                      isHourlyRange(startDate, endDate),
                    )
              }
              onClearTimeRange={
                selection ? () => setSelection(null) : resetDateRange
              }
              timeRanges={[...rangeIntervals, ...standardIntervals]}
              onTimeRangeChange={(interval) =>
                onDateRangeChange(
                  { from: interval.value[0], to: interval.value[1] },
                  interval,
                )
              }
            />
          </div>
        </Box>
        {montado && cortes.length > 0 && (
          <Alert
            variant="info"
            title="Este período llega más atrás de lo que se leyó"
            description={cortes.map((c) => textoDeCorte(c, fechaCorta)).join(' ')}
          />
        )}
        {montado && items.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title="No hay eventos"
            description="Prueba con un período más largo o quita filtros."
          />
        ) : (
          <Box flexDirection="column" flexGrow={1} minHeight={0}>
            <EventLogHeader />
            <Box
              flexDirection="column"
              flexGrow={1}
              minHeight={0}
              overflowY={{ base: 'visible', md: 'auto' }}
              paddingBottom={{ md: 'xl' }}
            >
              {!montado ? (
                <EventLogSkeleton />
              ) : (
                <EventLog
                  events={items}
                  selectedEventId={selectedEventId}
                  onSelect={setSelectedEventId}
                  onStep={stepToEvent}
                  onClose={() => setSelectedEventId(null)}
                />
              )}
              <div ref={loadMoreRef} />
              {montado && hasNextPage && (
                <Box justifyContent="center" paddingVertical="l">
                  <Spinner />
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </DashboardBody>
  )
}

export default ClientPage

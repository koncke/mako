'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Events/EventRow.tsx, con Events.tsx y
// EventSourceBadge.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: vive al lado de la ficha del negocio (Admin › Analytics › Events porta su propia lista, components/Events/EventLog*).
// El renglón de Polar: la flecha, el nombre, la fuente y la fecha; abierto, lo que trae el evento (su EventCard) y «View Event».
// Se sacaron lo que MaKo no tiene: los eventos hijos (MaKo no anida eventos), el costo de cada evento y la cara del cliente
// (todos son de ESTE negocio). Lo que se ve al abrirlo son los pares de `detalle` (app/admin/_polar/datos/cliente.ts). «View
// Event» lleva a la página del hecho cuando tiene una en Admin (un pago, a Sales).

import type { EventoNegocio, FuenteEvento } from '@/app/admin/_polar/datos/cliente'
import {
  KeyboardArrowDownOutlined,
  KeyboardArrowRightOutlined,
} from '@/app/admin/_polar/orbit/icons'
import { Button } from '@/app/admin/_polar/orbit'
import Link from '@/app/_ui/Link'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

const getEventSourceStyle = (source: FuenteEvento) => {
  switch (source) {
    case 'system':
      return 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950 dark:text-indigo-500'
    case 'user':
      return 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-500'
    default:
      return ''
  }
}

export const ROTULO_FUENTE: Record<FuenteEvento, string> = { system: 'Sistema', user: 'Negocio' }

export const EventSourceBadge = ({ source }: { source: FuenteEvento }) => {
  return (
    <div
      className={twMerge(
        'text-xxs! rounded-sm px-2 py-1 font-mono',
        getEventSourceStyle(source),
      )}
    >
      {ROTULO_FUENTE[source]}
    </div>
  )
}

export const EventRow = ({
  event,
  expanded = false,
}: {
  event: EventoNegocio
  expanded?: boolean
}) => {
  const [isExpanded, setIsExpanded] = useState(expanded)

  const formattedTimestamp = useMemo(() => {
    const fecha = new Date(event.timestamp.length === 10 ? `${event.timestamp}T12:00:00` : event.timestamp)
    return fecha.toLocaleDateString(
      'es-AR',
      isExpanded && event.timestamp.length > 10
        ? {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
          }
        : {
            month: 'short',
            day: '2-digit',
            year: 'numeric',
          },
    )
  }, [event, isExpanded])

  return (
    <div
      className={twMerge(
        'group flex cursor-pointer flex-col',
        isExpanded && 'mb-4',
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div
        className={twMerge(
          'dark:bg-polar-800 dark:border-polar-700 dark:group-hover:bg-polar-700 flex flex-col rounded-xl border border-gray-200 bg-white font-mono text-sm transition-colors duration-150 group-hover:bg-gray-50',
          isExpanded &&
            'dark:border-polar-700 dark:group-hover:border-polar-600 border-b-2 border-gray-100',
        )}
      >
        <div className="flex flex-row items-start justify-between gap-x-2 p-3 select-none sm:items-center">
          <div className="flex min-w-0 flex-row items-start gap-x-2 sm:items-center sm:gap-x-4">
            <div className="dark:bg-polar-700 dark:hover:bg-polar-600 flex shrink-0 flex-row items-center justify-center rounded-sm border border-gray-200 bg-gray-100 p-1 transition-colors duration-150 hover:bg-gray-200 dark:border-white/5">
              {isExpanded ? (
                <KeyboardArrowDownOutlined fontSize="inherit" />
              ) : (
                <KeyboardArrowRightOutlined fontSize="inherit" />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-y-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
              <div className="flex min-w-0 flex-row items-center gap-x-2 sm:contents">
                <span className={twMerge('truncate text-xs', event.negativo && 'text-red-500')}>{event.label}</span>
                <EventSourceBadge source={event.source} />
              </div>
              <div className="flex flex-row flex-wrap items-center gap-x-2 gap-y-1 sm:contents">
                <span className="dark:text-polar-500 text-xs whitespace-nowrap text-gray-500">
                  {formattedTimestamp}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-row items-center gap-x-2 sm:gap-x-6">
            {isExpanded ? (
              event.href ? (
                <Link
                  href={event.href}
                  className="flex flex-col"
                  onClick={(e) => {
                    e.stopPropagation()
                  }}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    wrapperClassNames="gap-x-1"
                    className="text-xxs h-6 rounded-sm px-2 font-mono"
                  >
                    <span className="text-xxs font-mono">Ver</span>
                  </Button>
                </Link>
              ) : null
            ) : event.resumen ? (
              <span className="dark:text-polar-500 hidden truncate text-xs text-gray-500 sm:inline">
                {event.resumen}
              </span>
            ) : null}
          </div>
        </div>
        {isExpanded && event.detalle.length > 0 ? (
          <div className="dark:border-polar-700 flex flex-col gap-y-1 border-t border-gray-100 px-3 py-3 font-sans">
            {event.detalle.map(([rotulo, valor]) => (
              <div key={rotulo} className="flex flex-row items-baseline justify-between gap-x-4 text-xs">
                <span className="dark:text-polar-500 text-gray-500">{rotulo}</span>
                <span className="min-w-0 truncate text-right">{valor}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const Events = ({ events }: { events: EventoNegocio[] }) => {
  return (
    <div className="flex flex-col gap-y-3">
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
    </div>
  )
}

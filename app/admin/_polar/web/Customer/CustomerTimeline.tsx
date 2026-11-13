'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerTimeline.tsx, con lo que dibuja
// de components/Timeline/Timeline.tsx, Timeline/TimelineItem.tsx y Shared/ContextCard.tsx. Aviso: lib/avisos/LICENSE-POLAR y
// lib/avisos/NOTICE-POLAR.
//
// MaKo: los eventos son los de Admin › Analytics › Events filtrados por el negocio (app/admin/_polar/datos/eventos.ts
// `timelineDelNegocio`, como Polar, que los pide a /v1/events con `customer_id`), los arma el server y llegan por props. La
// importancia, el resumen y lo malo de cada uno son los de los renderers de Polar (components/Timeline/renderers.tsx), y el
// pliegue de lo de importancia baja es el suyo (`segmentosDeTimeline`). Un evento sin página propia en Admin no es un link
// (Polar cae al detalle del evento: el «Ver todos» lleva ahí). Las fechas, en español.

import {
  LIMITE_TIMELINE,
  segmentosDeTimeline,
  type EventoDeTimeline,
  type NombreEvento,
} from '@/app/admin/_polar/datos/eventos'
import {
  AllInclusiveOutlined,
  BoltOutlined,
  ChevronRightOutlined,
  ErrorOutlined,
  PersonOutlineOutlined,
  ShoppingBagOutlined,
  Support,
} from '@/app/admin/_polar/orbit/icons'
import { SegmentedControl, Text, Tooltip, TooltipContent, TooltipTrigger } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import ShadowBox from '@/app/admin/_polar/atoms/ShadowBox'
import Link from '@/app/_ui/Link'
import { Fragment, PropsWithChildren, ReactNode, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type SourceFilter = 'system' | 'all'

const ContextCard = ({ children }: PropsWithChildren) => (
  <ShadowBox className="dark:border-polar-800 flex flex-col gap-4 border-gray-200 bg-white p-6 md:shadow-xs lg:rounded-2xl">
    {children}
  </ShadowBox>
)

// Los íconos de categoría de Polar (`CATEGORY_ICONS`: order, subscription, customer) y el de un user event (el rayo).
const ICONOS: Record<NombreEvento, ReactNode> = {
  pago: <ShoppingBagOutlined fontSize="inherit" />,
  devolucion: <ShoppingBagOutlined fontSize="inherit" />,
  suscripcion: <AllInclusiveOutlined fontSize="inherit" />,
  alta: <PersonOutlineOutlined fontSize="inherit" />,
  error: <ErrorOutlined fontSize="inherit" />,
  reporte: <Support fontSize="inherit" />,
  mako: <BoltOutlined fontSize="inherit" />,
  lectura: <BoltOutlined fontSize="inherit" />,
  agente: <BoltOutlined fontSize="inherit" />,
  linea: <BoltOutlined fontSize="inherit" />,
}

export const iconoDeEvento = (e: Pick<EventoDeTimeline, 'nombre'>): ReactNode => ICONOS[e.nombre]

/** «hace 3 h», «ayer». Un evento que sólo tiene su DÍA (un pago) se cuenta en días: no se le inventa una hora. */
export const formatRelativeTime = (timestamp: string, soloDia = false): string => {
  const date = new Date(timestamp)
  if (soloDia) {
    const hoy = new Date()
    const dia = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
    const dias = Math.round((dia(hoy) - Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())) / 86_400_000)
    if (dias <= 0) return 'hoy'
    if (dias === 1) return 'ayer'
    if (dias < 7) return `hace ${dias} d`
    return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (minutes < 1) return 'ahora'
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days} d`
  return date.toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })
}

const fechaLarga = (timestamp: string, soloDia = false) =>
  soloDia
    ? new Date(timestamp).toLocaleDateString('es-AR', { dateStyle: 'medium', timeZone: 'UTC' })
    : new Date(timestamp).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'medium' })

const TimelineItem = ({ evento }: { evento: EventoDeTimeline }) => {
  const contenido = (
    <Box
      alignItems="center"
      columnGap="m"
      paddingVertical="s"
      paddingHorizontal="m"
      borderRadius="s"
      backgroundColor={{ hover: 'background-card' }}
      transitionProperty="colors"
      transitionDuration="fast"
    >
      <Box
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
        width={32}
        height={32}
        borderRadius="full"
        backgroundColor={evento.negativo ? 'background-danger' : 'background-card'}
        color="text-primary"
      >
        <span
          className={twMerge(
            'flex items-center justify-center text-sm',
            evento.negativo && 'text-red-500',
          )}
        >
          {iconoDeEvento(evento)}
        </span>
      </Box>
      <Box flexDirection="column" flexGrow={1} minWidth={0}>
        <Box alignItems="baseline" justifyContent="between" columnGap="m">
          <Text variant="title" truncate>
            {evento.label}
          </Text>
          <Tooltip>
            <TooltipTrigger>
              <Text variant="caption" color="muted" wrap="nowrap">
                {formatRelativeTime(evento.timestamp, evento.soloDia)}
              </Text>
            </TooltipTrigger>
            <TooltipContent side="top" align="end">
              {fechaLarga(evento.timestamp, evento.soloDia)}
            </TooltipContent>
          </Tooltip>
        </Box>
        {evento.resumen ? (
          <Text variant="caption" color="muted" truncate>
            {evento.resumen}
          </Text>
        ) : null}
      </Box>
    </Box>
  )
  return evento.href ? (
    <Link href={evento.href} className="block">
      {contenido}
    </Link>
  ) : (
    <div className="block">{contenido}</div>
  )
}

const TimelineFold = ({
  count,
  expanded,
  onToggle,
}: {
  count: number
  expanded: boolean
  onToggle: () => void
}) => (
  <Box
    alignItems="center"
    columnGap="m"
    paddingVertical="s"
    paddingHorizontal="m"
    borderRadius="s"
    backgroundColor={{ hover: 'background-card' }}
    transitionProperty="colors"
    transitionDuration="fast"
    cursor={{ hover: 'pointer' }}
    onClick={onToggle}
    aria-expanded={expanded}
  >
    <span className="flex h-5 w-8 shrink-0 items-center justify-center">
      <ChevronRightOutlined
        className={twMerge(
          'dark:text-polar-500 size-3.5 text-gray-500 transition-transform',
          expanded && 'rotate-90',
        )}
        fontSize="inherit"
      />
    </span>
    <Text color="muted">
      {expanded
        ? 'Ocultar los eventos plegados'
        : `${count} ${count === 1 ? 'evento plegado' : 'eventos plegados'}`}
    </Text>
  </Box>
)

const Timeline = ({
  eventos,
  viewAllHref,
  emptyMessage,
}: {
  eventos: EventoDeTimeline[]
  viewAllHref?: string
  emptyMessage: string
}) => {
  const [expandedFolds, setExpandedFolds] = useState<Set<string>>(new Set())
  const segments = useMemo(() => segmentosDeTimeline(eventos), [eventos])

  const toggleFold = (foldId: string) => {
    setExpandedFolds((current) => {
      const next = new Set(current)
      if (next.has(foldId)) next.delete(foldId)
      else next.add(foldId)
      return next
    })
  }

  if (segments.length === 0) {
    return (
      <Box
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        flex={1}
        padding="2xl"
        borderRadius="s"
        backgroundColor="background-card"
        rowGap="s"
        textAlign="center"
      >
        <Text variant="body" as="h3">
          Todavía no hay eventos
        </Text>
        <Text color="muted">{emptyMessage}</Text>
      </Box>
    )
  }

  return (
    <div className="-mx-3">
      <Box flexDirection="column" rowGap="xs">
        {segments.map((segment) => {
          if (segment.type === 'event') {
            return <TimelineItem key={segment.evento.id} evento={segment.evento} />
          }
          const foldId = segment.eventos[0].id
          const expanded = expandedFolds.has(foldId)
          return (
            <Fragment key={foldId}>
              <TimelineFold
                count={segment.eventos.length}
                expanded={expanded}
                onToggle={() => toggleFold(foldId)}
              />
              {expanded && (
                <>
                  {segment.eventos.map((e) => (
                    <TimelineItem key={e.id} evento={e} />
                  ))}
                  <Box
                    borderBottomWidth={1}
                    borderStyle="solid"
                    borderColor="border-primary"
                    marginVertical="xs"
                  />
                </>
              )}
            </Fragment>
          )
        })}
        {viewAllHref && (
          <Link href={viewAllHref} className="block">
            <Box
              justifyContent="center"
              paddingVertical="s"
              paddingHorizontal="m"
              borderRadius="s"
              backgroundColor={{ hover: 'background-card' }}
              transitionProperty="colors"
              transitionDuration="fast"
            >
              <Text variant="caption" color="muted">
                Ver todos los eventos
              </Text>
            </Box>
          </Link>
        )}
      </Box>
    </div>
  )
}

interface CustomerTimelineProps {
  /** Los últimos eventos del negocio, el más nuevo primero (`timelineDelNegocio`). */
  eventos: EventoDeTimeline[]
  /** Analytics › Events filtrado por el negocio (`rutaDeEventosDelNegocio`, el `buildCustomerEventsPath` de Polar). */
  viewAllHref: string
}

export const CustomerTimeline = ({ eventos, viewAllHref }: CustomerTimelineProps) => {
  const [source, setSource] = useState<SourceFilter>('system')
  const visibles = useMemo(
    () =>
      eventos
        .filter((e) => source === 'all' || e.source === 'system')
        .slice(0, LIMITE_TIMELINE),
    [eventos, source],
  )

  return (
    <ContextCard>
      <div className="flex flex-row items-center justify-between gap-2">
        <h3 className="text-lg">Timeline</h3>
        <SegmentedControl<SourceFilter>
          size="sm"
          options={[
            { value: 'system', label: 'Sistema' },
            { value: 'all', label: 'Todos' },
          ]}
          value={source}
          onChange={setSource}
        />
      </div>
      <div className="-mx-3 flex max-h-96 flex-col overflow-y-auto px-3">
        <Timeline
          eventos={visibles}
          viewAllHref={viewAllHref}
          emptyMessage="Lo que pase en este negocio va a aparecer aquí."
        />
      </div>
    </ContextCard>
  )
}

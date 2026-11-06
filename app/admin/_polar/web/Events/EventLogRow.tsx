// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Events/EventLogRow.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: las columnas de Polar son Time · Event · Customer · Tokens · Cost. Acá: Hora · Evento · Negocio · Monto. «Tokens»
// se sacó (ningún evento de MaKo los trae); «Cost» es «Monto», la plata del evento (un pago). El «+N» de los hijos de un
// evento es el «×N» de un error que pasó varias veces. Un pago sólo tiene su día: no se le dibuja una hora.

import type { EventoAdmin } from '@/app/admin/_polar/datos/eventos'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { twMerge } from 'tailwind-merge'
import { EventTimestamp } from './EventTimestamp'

export const formatEventTimestamp = (timestamp: string, soloDia = false) =>
  new Date(timestamp).toLocaleString('es-AR', {
    month: 'short',
    day: '2-digit',
    ...(soloDia
      ? { year: 'numeric' as const, timeZone: 'UTC' }
      : {
          hour: '2-digit' as const,
          minute: '2-digit' as const,
          second: '2-digit' as const,
          hour12: false,
        }),
  })

/** Los negocios del evento, como se leen en una celda: el primero y «+N» si hay más. */
export const eventCustomerLabel = (event: EventoAdmin) =>
  event.negocios.length
    ? `${event.negocios[0].nombre}${event.negocios.length > 1 ? ` +${event.negocios.length - 1}` : ''}`
    : event.persona

export const eventCost = (event: EventoAdmin) =>
  event.monto != null ? formatCurrency('accounting')(event.monto, 'usd') : null

const Veces = ({ event }: { event: EventoAdmin }) =>
  event.veces != null && event.veces > 1 ? (
    <Text color="muted" tabularNums>
      ×{event.veces}
    </Text>
  ) : null

export const EventLogRow = ({
  event,
  selected,
  onSelect,
}: {
  event: EventoAdmin
  selected: boolean
  onSelect: () => void
}) => {
  const customer = eventCustomerLabel(event)
  const cost = eventCost(event)
  const time = (
    <time suppressHydrationWarning dateTime={event.timestamp}>
      {formatEventTimestamp(event.timestamp, event.soloDia)}
    </time>
  )

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      data-event-id={event.id}
      className={twMerge(
        'w-full cursor-pointer text-left',
        selected
          ? 'dark:bg-polar-800 bg-gray-100'
          : 'dark:hover:bg-polar-800/50 hover:bg-gray-50',
      )}
    >
      <Box
        display={{ base: 'flex', md: 'none' }}
        flexDirection="column"
        gap="xs"
        paddingHorizontal="m"
        paddingVertical="s"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Box alignItems="center" justifyContent="between" gap="m">
          <Box alignItems="center" gap="s" minWidth={0}>
            <Text truncate color={event.falla && event.nombre === 'mako' ? 'danger' : undefined}>
              {event.label}
            </Text>
            <Veces event={event} />
          </Box>
          {cost && (
            <Box flexShrink={0}>
              <Text color="muted" tabularNums>
                {cost}
              </Text>
            </Box>
          )}
        </Box>
        <Box alignItems="center" gap="s" minWidth={0}>
          <Box flexShrink={0}>
            <Text variant="caption" color="muted" tabularNums>
              {time}
            </Text>
          </Box>
          {customer && (
            <Text variant="caption" color="muted" truncate>
              · {customer}
            </Text>
          )}
        </Box>
      </Box>
      <Box
        display={{ base: 'none', md: 'flex' }}
        alignItems="center"
        gap="l"
        paddingHorizontal="m"
        paddingVertical="s"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Box width={128} flexShrink={0}>
          <EventTimestamp timestamp={event.timestamp} soloDia={event.soloDia} focusable={false}>
            <Text color="muted" tabularNums truncate>
              {time}
            </Text>
          </EventTimestamp>
        </Box>
        <Box
          flexGrow={2}
          flexBasis={0}
          minWidth={120}
          alignItems="center"
          gap="s"
        >
          <Text truncate color={event.falla && event.nombre === 'mako' ? 'danger' : undefined}>
            {event.label}
          </Text>
          <Veces event={event} />
        </Box>
        <Box flexGrow={1} flexBasis={0} minWidth={0}>
          <Text color="muted" truncate>
            {customer ?? '—'}
          </Text>
        </Box>
        <Box width={96} flexShrink={0} justifyContent="end">
          <Text color="muted" tabularNums>
            {cost ?? ''}
          </Text>
        </Box>
      </Box>
    </button>
  )
}

export const EventLogHeader = () => (
  <Box
    display={{ base: 'none', md: 'flex' }}
    gap="l"
    paddingHorizontal="m"
    paddingVertical="s"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    <Box width={128} flexShrink={0}>
      <Text color="muted">Hora</Text>
    </Box>
    <Box flexGrow={2} flexBasis={0} minWidth={120}>
      <Text color="muted">Evento</Text>
    </Box>
    <Box flexGrow={1} flexBasis={0} minWidth={0}>
      <Text color="muted">Negocio</Text>
    </Box>
    <Box width={96} flexShrink={0} justifyContent="end">
      <Text color="muted">Monto</Text>
    </Box>
  </Box>
)

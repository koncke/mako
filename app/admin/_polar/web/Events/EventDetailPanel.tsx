'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Events/EventDetailPanel.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el mismo panel (la barra con anterior / siguiente / cerrar, los campos de arriba y las secciones), con lo que cada
// tipo de evento de MaKo trae (`campos`, `secciones`). Polar pide el evento, su padre, sus hijos y una muestra de costos a su
// API; acá el evento llega entero con la lista. Se sacaron «Source» y «External ID» (MaKo no los tiene), «Cost», «LLM»,
// «Parent» y «Children» (ningún evento de MaKo tiene costo propio ni jerarquía), y el «Metadata» en JSON: lo que un evento de
// MaKo sabe va en «Detalles», con su nombre. El negocio lleva a su ficha (`/admin/customers/<ws>`), y un campo con `href` a su
// página (el «Order» de Polar, `ResourceLink`: el pedido de un pago, en Sales).

import type { CampoEvento, EventoAdmin, SeccionEvento } from '@/app/admin/_polar/datos/eventos'
import { TIPOS_EVENTO } from '@/app/admin/_polar/datos/eventos'
import { Button, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ChevronDown, ChevronUp, X } from '@/app/admin/_polar/orbit/icons'
import Link from '@/app/_ui/Link'
import { ReactNode } from 'react'
import { CopyButton } from './CopyButton'
import { Field } from './EventDetailField'
import { formatEventTimestamp } from './EventLogRow'
import { EventTimestamp } from './EventTimestamp'

const IconButton = ({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}) => (
  <Button
    size="icon"
    variant="ghost"
    className="h-7 w-7"
    aria-label={label}
    title={label}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </Button>
)

const Section = ({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) => (
  <Box
    flexDirection="column"
    gap="s"
    paddingHorizontal="l"
    paddingVertical="m"
    borderTopWidth={1}
    borderStyle="solid"
    borderColor="border-secondary"
  >
    <Box alignItems="center" justifyContent="between" minHeight={24}>
      <Text>{title}</Text>
      {action}
    </Box>
    {children}
  </Box>
)

const ValorCampo = ({ campo }: { campo: CampoEvento }) =>
  campo.href ? (
    <Link href={campo.href} className="min-w-0 truncate text-sm hover:opacity-60">
      {campo.valor}
    </Link>
  ) : campo.fecha ? (
    <EventTimestamp timestamp={campo.valor}>
      <Text tabularNums>
        <time suppressHydrationWarning dateTime={campo.valor}>
          {formatEventTimestamp(campo.valor)}
        </time>
      </Text>
    </EventTimestamp>
  ) : (
    <Text truncate monospace={campo.mono}>
      {campo.valor}
    </Text>
  )

const Bloque = ({ seccion }: { seccion: SeccionEvento }) => {
  const texto = seccion.lineas.join('\n')
  return (
    <Section
      title={seccion.titulo}
      action={<CopyButton value={texto} label={`Copiar ${seccion.titulo.toLowerCase()}`} />}
    >
      {seccion.mono ? (
        <div className="dark:bg-polar-800 overflow-x-auto rounded-lg bg-gray-50 p-3 font-mono text-xs leading-5 whitespace-pre">
          {texto}
        </div>
      ) : (
        <Box flexDirection="column" gap="s">
          {seccion.lineas.map((linea, i) => (
            <Text key={i} color="muted">
              {linea}
            </Text>
          ))}
        </Box>
      )}
    </Section>
  )
}

const EventDetails = ({ event }: { event: EventoAdmin }) => {
  return (
    <>
      <Box flexDirection="column" paddingHorizontal="l" paddingVertical="m">
        <Field label="ID" copyValue={event.id}>
          <Text truncate monospace>
            {event.id}
          </Text>
        </Field>
        <Field label={event.soloDia ? 'Día' : 'Hora'}>
          <EventTimestamp timestamp={event.timestamp} soloDia={event.soloDia}>
            <Text tabularNums>
              <time suppressHydrationWarning dateTime={event.timestamp}>
                {formatEventTimestamp(event.timestamp, event.soloDia)}
              </time>
            </Text>
          </EventTimestamp>
        </Field>
        <Field label="Tipo">
          <Text truncate>{TIPOS_EVENTO[event.nombre].label}</Text>
        </Field>
        {event.negocios.length > 0 && (
          <Field label={event.negocios.length > 1 ? 'Negocios' : 'Negocio'}>
            <Box flexWrap="wrap" columnGap="s">
              {event.negocios.map((n, i) => (
                <Link
                  key={n.ws}
                  href={`/admin/customers/${n.ws}`}
                  className="min-w-0 truncate text-sm hover:opacity-60"
                >
                  {n.nombre}
                  {i < event.negocios.length - 1 ? ',' : ''}
                </Link>
              ))}
            </Box>
          </Field>
        )}
        {event.persona && event.negocios.length > 0 && (
          <Field label="Persona">
            <Text truncate>{event.persona}</Text>
          </Field>
        )}
      </Box>

      {event.campos.length > 0 && (
        <Section title="Detalles">
          <Box flexDirection="column">
            {event.campos.map((campo) => (
              <Field
                key={campo.label}
                label={campo.label}
                copyValue={campo.copiar ? campo.valor : undefined}
              >
                <ValorCampo campo={campo} />
              </Field>
            ))}
          </Box>
        </Section>
      )}

      {event.secciones.map((seccion) => (
        <Bloque key={seccion.titulo} seccion={seccion} />
      ))}
    </>
  )
}

export const EventDetailPanel = ({
  event,
  onPrevious,
  onNext,
  onClose,
}: {
  /** null = el `?event=` de la URL no está entre los eventos leídos. */
  event: EventoAdmin | null
  onPrevious?: () => void
  onNext?: () => void
  onClose: () => void
}) => {
  return (
    <div className="dark:bg-polar-900 dark:border-polar-800 fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white lg:static lg:z-auto lg:w-[400px] lg:shrink-0 lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-xs">
      <Box
        alignItems="center"
        justifyContent="between"
        gap="s"
        paddingLeft="l"
        paddingRight="m"
        paddingVertical="m"
      >
        <Box minWidth={0}>
          {event && (
            <Text variant="body" truncate>
              {event.label}
            </Text>
          )}
        </Box>
        <Box alignItems="center" flexShrink={0}>
          <IconButton
            label="Evento anterior"
            onClick={onPrevious}
            disabled={!onPrevious}
          >
            <ChevronUp className="h-4 w-4" />
          </IconButton>
          <IconButton label="Evento siguiente" onClick={onNext} disabled={!onNext}>
            <ChevronDown className="h-4 w-4" />
          </IconButton>
          <IconButton label="Cerrar" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </Box>
      </Box>
      {!event && (
        <Box paddingHorizontal="l" paddingVertical="m">
          <Text color="muted">No encontré ese evento entre los que se leyeron.</Text>
        </Box>
      )}
      {event && <EventDetails event={event} />}
    </div>
  )
}

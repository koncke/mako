'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Events/EventTypeFilter.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los tipos son los cinco de MaKo (`TIPOS_EVENTO`) y llegan ya ordenados por cantidad (`conteoPorTipo`): sin el orden
// por `source` de Polar (user/system), que acá no existe.

import { TIPOS_EVENTO, esNombreEvento, type TipoConConteo } from '@/app/admin/_polar/datos/eventos'
import { Checkbox, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useState } from 'react'

const VISIBLE_COUNT = 8

const compactNumber = new Intl.NumberFormat('es-AR', {
  notation: 'compact',
})

type EventTypeRow = Pick<TipoConConteo, 'name' | 'label' | 'occurrences'>

export const EventTypeFilter = ({
  eventTypes,
  selected,
  onToggle,
}: {
  eventTypes: TipoConConteo[]
  selected: string[]
  onToggle: (name: string) => void
}) => {
  const [expanded, setExpanded] = useState(false)

  const selectedSet = new Set(selected)
  const known = new Set<string>(eventTypes.map((eventType) => eventType.name))
  // Keep selected types listed even when no events match, so they can be unticked.
  const rows: EventTypeRow[] = [
    ...eventTypes,
    ...selected
      .filter((name) => !known.has(name) && esNombreEvento(name))
      .map((name) => ({
        name: name as TipoConConteo['name'],
        label: esNombreEvento(name) ? TIPOS_EVENTO[name].label : name,
        occurrences: 0,
      })),
  ]

  const visible = expanded ? rows : rows.slice(0, VISIBLE_COUNT)
  const hiddenCount = rows.length - visible.length

  if (rows.length === 0) {
    return <Text color="muted">No hay eventos con estos filtros</Text>
  }

  return (
    <Box flexDirection="column" gap="s">
      <Box as="ul" flexDirection="column">
        {visible.map((eventType) => (
          <Box as="li" key={eventType.name}>
            <Box
              as="label"
              display="flex"
              alignItems="center"
              gap="s"
              paddingVertical="xs"
              width="100%"
              cursor="pointer"
            >
              <Checkbox
                checked={selectedSet.has(eventType.name)}
                onCheckedChange={() => onToggle(eventType.name)}
              />
              <Box flexGrow={1} minWidth={0}>
                <Text
                  color={selectedSet.has(eventType.name) ? 'default' : 'muted'}
                  truncate
                >
                  {eventType.label}
                </Text>
              </Box>
              <Text color="muted" tabularNums>
                {compactNumber.format(eventType.occurrences)}
              </Text>
            </Box>
          </Box>
        ))}
      </Box>
      {(hiddenCount > 0 || expanded) && (
        <button
          type="button"
          className="cursor-pointer self-start"
          onClick={() => setExpanded(!expanded)}
        >
          <Text color="muted">
            {expanded ? 'Ver menos' : `Ver ${hiddenCount} más`}
          </Text>
        </button>
      )}
    </Box>
  )
}

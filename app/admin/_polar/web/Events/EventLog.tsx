'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Events/EventLog.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: igual que Polar (las flechas recorren la lista, Escape cierra el detalle), con los eventos de MaKo.

import type { EventoAdmin } from '@/app/admin/_polar/datos/eventos'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useEffect } from 'react'
import { EventLogRow } from './EventLogRow'

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

export const EventLog = ({
  events,
  selectedEventId,
  onSelect,
  onStep,
  onClose,
}: {
  events: EventoAdmin[]
  selectedEventId: string | null
  onSelect: (id: string) => void
  onStep: (id: string) => void
  onClose: () => void
}) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape' && selectedEventId) {
        onClose()
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const index = events.findIndex((event) => event.id === selectedEventId)
      const next =
        e.key === 'ArrowDown'
          ? events[index + 1]
          : index > 0
            ? events[index - 1]
            : undefined
      if (!next) return
      e.preventDefault()
      onStep(next.id)
      document
        .querySelector(`[data-event-id="${CSS.escape(next.id)}"]`)
        ?.scrollIntoView({ block: 'nearest' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [events, selectedEventId, onStep, onClose])

  const isSelectedLoaded = events.some((event) => event.id === selectedEventId)
  useEffect(() => {
    if (!isSelectedLoaded) return
    document
      .querySelector(`[data-event-id="${CSS.escape(selectedEventId ?? '')}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [selectedEventId, isSelectedLoaded])

  return (
    <Box flexDirection="column">
      {events.map((event) => (
        <EventLogRow
          key={event.id}
          event={event}
          selected={event.id === selectedEventId}
          onSelect={() => onSelect(event.id)}
        />
      ))}
    </Box>
  )
}

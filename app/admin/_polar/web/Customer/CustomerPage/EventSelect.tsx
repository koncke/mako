'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Events/EventSelect.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los nombres de eventos los arma el server con lo que hay en el negocio (`nombresDeEventos`) y llegan por props; Polar los
// pide a /v1/events/names. Agrupados por fuente, como en Polar.

import type { FuenteEvento } from '@/app/admin/_polar/datos/cliente'
import { Button } from '@/app/admin/_polar/orbit/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/app/admin/_polar/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/admin/_polar/ui/popover'
import { Check, ChevronsUpDown } from '@/app/admin/_polar/orbit/icons'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type EventName = { name: string; label: string; source: FuenteEvento }

const EVENT_SOURCE_LABELS: Record<FuenteEvento, string> = {
  system: 'Del sistema',
  user: 'Del negocio',
}

const EventsCommandGroup = ({
  source,
  eventNames,
  value,
  onSelectEvent,
  onSelectAll,
}: {
  source: FuenteEvento
  eventNames: EventName[]
  value: string[]
  onSelectEvent: (name: string) => void
  onSelectAll: (names: string[]) => void
}) => {
  const names = useMemo(() => eventNames.map(({ name }) => name), [eventNames])
  const selectedNames = new Set(value)
  const areAllSelected =
    names.length > 0 && names.every((name) => selectedNames.has(name))

  if (eventNames.length === 0) {
    return null
  }

  return (
    <CommandGroup>
      <CommandItem
        className="flex flex-row items-center justify-between py-2 text-black dark:text-white"
        value={source}
        onSelect={() => onSelectAll(names)}
      >
        <span className="font-medium">{EVENT_SOURCE_LABELS[source]}</span>
        <span className="text-xs opacity-70">
          {areAllSelected ? 'Quitar todos' : `Elegir los ${names.length}`}
        </span>
      </CommandItem>
      {eventNames.map((eventName) => (
        <CommandItem
          className="flex flex-row items-center justify-between text-black dark:text-white"
          key={eventName.name}
          value={eventName.name}
          onSelect={() => onSelectEvent(eventName.name)}
        >
          {eventName.label}
          <Check
            className={twMerge(
              'ml-auto h-4 w-4',
              selectedNames.has(eventName.name) ? 'opacity-100' : 'opacity-0',
            )}
          />
        </CommandItem>
      ))}
    </CommandGroup>
  )
}

interface EventSelectProps {
  eventNames: EventName[]
  value: string[]
  onChange: (value: string[]) => void
  emptyLabel?: string
  className?: string
}

const EventSelect: React.FC<EventSelectProps> = ({
  eventNames,
  value,
  onChange,
  emptyLabel,
  className,
}) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const groupedEventNames = useMemo<
    Record<FuenteEvento, EventName[]>
  >(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return eventNames.reduce<
      Record<FuenteEvento, EventName[]>
    >(
      (acc, eventName) => {
        if (
          normalizedQuery &&
          !eventName.name.toLowerCase().includes(normalizedQuery) &&
          !eventName.label.toLowerCase().includes(normalizedQuery)
        ) {
          return acc
        }
        acc[eventName.source].push(eventName)
        return acc
      },
      { system: [], user: [] },
    )
  }, [eventNames, query])

  const hasResults =
    groupedEventNames.system.length > 0 || groupedEventNames.user.length > 0

  const buttonLabel = useMemo(() => {
    if (value.length === 0) {
      return emptyLabel || 'Todos los eventos'
    }
    if (value.length === 1) {
      const selected = eventNames.find(({ name }) => name === value[0])
      return selected?.label ?? value[0]
    }
    return `${value.length} eventos`
  }, [value, emptyLabel, eventNames])

  const onSelectEvent = useCallback(
    (name: string) => {
      if (value.includes(name)) {
        onChange(value.filter((selected) => selected !== name))
      } else {
        onChange([...value, name])
      }
    },
    [onChange, value],
  )

  const onSelectAll = useCallback(
    (names: string[]) => {
      const selectedNames = new Set(value)
      const allSelected = names.every((name) => selectedNames.has(name))
      if (allSelected) {
        const groupNames = new Set(names)
        onChange(value.filter((selected) => !groupNames.has(selected)))
      } else {
        onChange([
          ...value,
          ...names.filter((name) => !selectedNames.has(name)),
        ])
      }
    },
    [onChange, value],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={twMerge(
            'dark:bg-polar-800 dark:hover:bg-polar-700 dark:hover:border-polar-700 dark:border-polar-700 flex w-full flex-row justify-between gap-x-2 rounded-lg border border-gray-200 bg-white px-3 font-normal shadow-xs transition-colors hover:bg-gray-50 hover:text-black dark:hover:text-white',
            className,
          )}
        >
          <span className="overflow-hidden text-ellipsis whitespace-nowrap">
            {buttonLabel}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) rounded-xl p-0"
      >
        <Command shouldFilter={false} className="rounded-xl">
          <CommandInput
            className="h-9 border-0 focus:ring-0 focus:outline-0"
            placeholder="Buscar eventos…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {hasResults ? (
              <>
                <EventsCommandGroup
                  source="system"
                  eventNames={groupedEventNames.system}
                  value={value}
                  onSelectEvent={onSelectEvent}
                  onSelectAll={onSelectAll}
                />
                {groupedEventNames.system.length > 0 &&
                  groupedEventNames.user.length > 0 && <CommandSeparator />}
                <EventsCommandGroup
                  source="user"
                  eventNames={groupedEventNames.user}
                  value={value}
                  onSelectEvent={onSelectEvent}
                  onSelectAll={onSelectAll}
                />
              </>
            ) : (
              <CommandEmpty>No hay eventos con ese nombre</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default EventSelect

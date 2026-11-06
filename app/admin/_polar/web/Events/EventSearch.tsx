'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Events/EventSearch.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la misma caja (texto libre, fichas de filtro, sugerencias con las flechas y Enter, Backspace edita la última ficha)
// con las palabras en español: `tipo:`, `negocio:` y `fecha:`. Las sugerencias salen de lo que la pantalla ya tiene (los
// tipos con su cantidad y los negocios de los eventos), no de la API. Se sacaron `source:` y los metadatos (los eventos de
// MaKo no tienen origen user/system ni metadatos libres) y abrir un evento pegando su UUID (los ids de MaKo no lo son).

import type { NegocioEvento, TipoConConteo } from '@/app/admin/_polar/datos/eventos'
import { TIPOS_EVENTO, esNombreEvento, normalizar } from '@/app/admin/_polar/datos/eventos'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { Search, X } from '@/app/admin/_polar/orbit/icons'
import { DateRangeInterval } from '@/app/admin/_polar/web/Metrics/DateRangePicker'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type ChipKind = 'time' | 'event' | 'customer'

interface Chip {
  kind: ChipKind
  value: string
  token: string
  edit: string
  remove?: () => void
}

interface Suggestion {
  section: 'Sugerencias' | 'Filtros'
  kind?: ChipKind
  token: string
  hint?: string
  apply: () => void
}

const FILTER_PREFIXES = [
  { token: 'tipo:', hint: 'Tipo de evento' },
  { token: 'negocio:', hint: 'Nombre del negocio' },
  { token: 'fecha:', hint: 'Rango de fechas' },
]

const TOKEN_PATTERN = /^([a-z]+(?:\.[^:\s]+)?):(.*)$/i
const inputToQuery = (input: string) => {
  const trimmed = input.trim()
  return TOKEN_PATTERN.test(trimmed) ? null : input || null
}

const Token = ({
  children,
  colon = false,
  onEdit,
  onRemove,
}: {
  children: string
  colon?: boolean
  onEdit?: () => void
  onRemove?: () => void
}) => {
  const separator = children.indexOf(':')
  const field = separator >= 0 ? children.slice(0, separator) : children
  const value = separator >= 0 ? children.slice(separator + 1) : ''

  const label = (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      gap="xs"
      paddingLeft="m"
      paddingRight={onRemove ? 'xs' : 'm'}
      paddingVertical="xs"
      minWidth={0}
    >
      {colon ? (
        <Text as="span" truncate>
          <Text as="span" color="muted">
            {field}
            {separator >= 0 ? ':' : ''}
          </Text>
          {value}
        </Text>
      ) : (
        <>
          <Text as="span" color="muted">
            {field}
          </Text>
          {value && (
            <Text as="span" truncate>
              {value}
            </Text>
          )}
        </>
      )}
    </Box>
  )

  return (
    <span
      className={twMerge(
        'dark:bg-polar-900 inline-flex min-w-0 items-center rounded-full bg-gray-100 transition-colors',
        onEdit && 'dark:hover:bg-polar-700 hover:bg-gray-200',
      )}
    >
      {onEdit ? (
        <button
          type="button"
          className="flex min-w-0 cursor-pointer items-center rounded-full text-left"
          aria-label={`Editar ${children}`}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          {label}
        </button>
      ) : (
        label
      )}
      {onRemove && (
        <button
          type="button"
          className="dark:text-polar-500 dark:hover:text-polar-200 flex cursor-pointer items-center pr-2 text-gray-400 hover:text-gray-700"
          aria-label={`Quitar ${children}`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  )
}

export const EventSearch = ({
  eventTypes,
  negocios,
  query,
  onQueryChange,
  selectedEventTypes,
  onEventTypesChange,
  selectedCustomerIds,
  onCustomerIdsChange,
  timeRangeLabel,
  onClearTimeRange,
  timeRanges,
  onTimeRangeChange,
}: {
  eventTypes: TipoConConteo[]
  negocios: readonly NegocioEvento[]
  query: string | null
  onQueryChange: (query: string | null) => void
  selectedEventTypes: string[]
  onEventTypesChange: (names: string[] | null) => void
  selectedCustomerIds: number[]
  onCustomerIdsChange: (ids: number[] | null) => void
  timeRangeLabel: string | null
  onClearTimeRange?: () => void
  timeRanges: DateRangeInterval[]
  onTimeRangeChange: (interval: DateRangeInterval) => void
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState(query ?? '')
  const [syncedQuery, setSyncedQuery] = useState(query)
  if (query !== syncedQuery) {
    setSyncedQuery(query)
    if (query !== inputToQuery(input)) {
      setInput(query ?? '')
    }
  }
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const [editing, setEditing] = useState<Chip | null>(null)
  const editingValue = (kind: ChipKind) =>
    editing?.kind === kind ? editing.value : null
  const eventTypesBase = selectedEventTypes.filter(
    (name) => name !== editingValue('event'),
  )
  const customerIdsBase = selectedCustomerIds.filter(
    (id) => String(id) !== editingValue('customer'),
  )

  const match = TOKEN_PATTERN.exec(input.trim())
  const rawField = match?.[1] ?? null
  const field = rawField?.toLowerCase() ?? null
  const value = normalizar(match?.[2].trim() ?? '')

  const customers = negocios
    .filter((n) => field !== 'negocio' || normalizar(n.nombre).includes(value))
    .slice(0, 8)
  const nombreDeNegocio = (ws: number) =>
    negocios.find((n) => n.ws === ws)?.nombre ?? `Negocio ${ws}`
  const labelDeTipo = (name: string) =>
    esNombreEvento(name) ? TIPOS_EVENTO[name].label : name

  const commit = (next: string) => {
    setInput(next)
    setHighlighted(-1)
    onQueryChange(null)
  }

  const addEventType = (name: string) => {
    onEventTypesChange(
      eventTypesBase.includes(name)
        ? eventTypesBase
        : [...eventTypesBase, name],
    )
    commit('')
  }

  const eventSuggestions = (filter: string, limit: number): Suggestion[] =>
    eventTypes
      .filter(
        (eventType) =>
          !eventTypesBase.includes(eventType.name) &&
          (eventType.name.includes(filter) ||
            normalizar(eventType.label).includes(filter)),
      )
      .toSorted((a, b) => b.occurrences - a.occurrences)
      .slice(0, limit)
      .map((eventType) => ({
        section: 'Sugerencias',
        kind: 'event',
        token: `tipo:${eventType.label}`,
        hint: eventType.occurrences.toLocaleString('es-AR'),
        apply: () => addEventType(eventType.name),
      }))

  const suggestions: Suggestion[] = (() => {
    if (field === 'tipo') return eventSuggestions(value, 8)
    if (field === 'negocio') {
      return customers
        .filter((customer) => !customerIdsBase.includes(customer.ws))
        .map((customer) => ({
          section: 'Sugerencias',
          kind: 'customer',
          token: `negocio:${customer.nombre}`,
          apply: () => {
            onCustomerIdsChange([...customerIdsBase, customer.ws])
            commit('')
          },
        }))
    }
    if (field === 'fecha') {
      return timeRanges
        .filter((interval) => normalizar(interval.label).includes(value))
        .map((interval) => ({
          section: 'Sugerencias',
          kind: 'time',
          token: `fecha:${interval.label}`,
          apply: () => {
            onTimeRangeChange(interval)
            commit('')
          },
        }))
    }
    const text = normalizar(input.trim())
    return [
      ...eventSuggestions(text, text ? 5 : 3),
      ...FILTER_PREFIXES.filter((prefix) => prefix.token.startsWith(text)).map(
        (prefix): Suggestion => ({
          section: 'Filtros',
          token: prefix.token,
          hint: prefix.hint,
          apply: () => commit(prefix.token),
        }),
      ),
    ]
  })()

  const chips: Chip[] = [
    ...(timeRangeLabel
      ? [
          {
            kind: 'time',
            value: timeRangeLabel,
            token: `fecha:${timeRangeLabel}`,
            edit: 'fecha:',
            remove: onClearTimeRange,
          } satisfies Chip,
        ]
      : []),
    ...selectedEventTypes.map(
      (name): Chip => ({
        kind: 'event',
        value: name,
        token: `tipo:${labelDeTipo(name)}`,
        edit: `tipo:${labelDeTipo(name)}`,
        remove: () =>
          onEventTypesChange(selectedEventTypes.filter((n) => n !== name)),
      }),
    ),
    ...selectedCustomerIds.map((id): Chip => {
      const label = nombreDeNegocio(id)
      return {
        kind: 'customer',
        value: String(id),
        token: `negocio:${label}`,
        edit: `negocio:${label}`,
        remove: () =>
          onCustomerIdsChange(selectedCustomerIds.filter((c) => c !== id)),
      }
    }),
  ]
  const visibleChips = chips.filter(
    (chip) => chip.kind !== editing?.kind || chip.value !== editing.value,
  )

  const startEditing = (chip: Chip) => {
    setEditing(chip)
    setInput(chip.edit)
    setHighlighted(-1)
    setOpen(true)
    onQueryChange(null)
    inputRef.current?.focus()
  }

  const stopEditing = () => {
    if (!editing) return
    setEditing(null)
    setInput('')
    onQueryChange(null)
  }

  const runSuggestion = (suggestion: Suggestion) => {
    if (editing && suggestion.kind && suggestion.kind !== editing.kind) {
      editing.remove?.()
    }
    suggestion.apply()
    if (suggestion.kind) setEditing(null)
  }

  const onChange = (next: string) => {
    if (editing && next === '') {
      editing.remove?.()
      setEditing(null)
    }
    setInput(next)
    setHighlighted(-1)
    setOpen(true)
    onQueryChange(inputToQuery(next))
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setOpen(true)
      const step = e.key === 'ArrowDown' ? 1 : -1
      setHighlighted((index) =>
        index < 0
          ? step > 0
            ? 0
            : suggestions.length - 1
          : (index + step + suggestions.length) %
            Math.max(suggestions.length, 1),
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const trimmed = input.trim()
      const isFilter = TOKEN_PATTERN.test(trimmed)
      const suggestion =
        suggestions[highlighted] ?? (isFilter ? suggestions[0] : undefined)
      if (open && suggestion) {
        runSuggestion(suggestion)
      } else {
        inputRef.current?.blur()
      }
    } else if (e.key === ' ' && editing) {
      e.preventDefault()
      const suggestion = suggestions[highlighted] ?? suggestions[0]
      if (suggestion?.kind) runSuggestion(suggestion)
      else stopEditing()
    } else if (e.key === 'Escape') {
      inputRef.current?.blur()
    } else if (e.key === 'Backspace' && input === '' && !editing) {
      const last = visibleChips.at(-1)
      if (last) {
        e.preventDefault()
        startEditing(last)
      }
    }
  }

  return (
    <div className="relative">
      <div
        className="dark:border-polar-700 dark:bg-polar-800 flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1 shadow-xs focus-within:border-blue-300 focus-within:ring-[3px] focus-within:ring-blue-100 dark:focus-within:border-blue-600 dark:focus-within:ring-blue-700/40"
        onClick={() => inputRef.current?.focus()}
      >
        <Search className="dark:text-polar-400 mr-1 h-4 w-4 shrink-0 text-gray-500" />
        {visibleChips.map((chip) => (
          <Token
            key={chip.token}
            onEdit={() => startEditing(chip)}
            onRemove={chip.remove}
          >
            {chip.token}
          </Token>
        ))}
        <input
          ref={inputRef}
          value={input}
          placeholder={
            visibleChips.length > 0 ? '' : 'Busca eventos o filtra…'
          }
          className="dark:placeholder:text-polar-500 min-w-24 flex-1 border-0 bg-transparent p-0 py-1 text-sm shadow-none ring-0 outline-none placeholder:text-gray-400 focus:ring-0 focus:outline-none dark:text-white"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            stopEditing()
          }}
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="dark:bg-polar-900 dark:border-polar-700 absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
          <Box
            flexDirection="column"
            paddingVertical="s"
            onMouseLeave={() => setHighlighted(-1)}
          >
            {suggestions.map((suggestion, index) => (
              <Box key={suggestion.token} flexDirection="column">
                {suggestion.section !== suggestions[index - 1]?.section && (
                  <Box paddingHorizontal="m" paddingVertical="xs">
                    <Text variant="caption" color="muted">
                      {suggestion.section}
                    </Text>
                  </Box>
                )}
                <button
                  type="button"
                  className={twMerge(
                    'w-full cursor-pointer text-left',
                    index === highlighted && 'dark:bg-polar-800 bg-gray-100',
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => runSuggestion(suggestion)}
                >
                  <Box
                    alignItems="center"
                    justifyContent="between"
                    gap="l"
                    paddingHorizontal="m"
                    paddingVertical="xs"
                  >
                    <Token colon>{suggestion.token}</Token>
                    {suggestion.hint && (
                      <Text variant="caption" color="muted" truncate>
                        {suggestion.hint}
                      </Text>
                    )}
                  </Box>
                </button>
              </Box>
            ))}
          </Box>
        </div>
      )}
    </div>
  )
}

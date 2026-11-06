'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Events/EventTimestamp.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: en español, y un evento que sólo tiene su DÍA (un pago) no muestra horas ni el «hace N minutos».

import {
  Grid,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ReactNode, useEffect, useState } from 'react'

const UNITS = [
  { label: ['día', 'días'], seconds: 86_400 },
  { label: ['hora', 'horas'], seconds: 3_600 },
  { label: ['minuto', 'minutos'], seconds: 60 },
  { label: ['segundo', 'segundos'], seconds: 1 },
] as const

const plural = (count: number, label: readonly [string, string]) =>
  `${count} ${count === 1 ? label[0] : label[1]}`

const formatRelative = (date: Date, now: number) => {
  const diff = Math.round((now - date.getTime()) / 1000)
  const elapsed = Math.abs(diff)
  const index = UNITS.findIndex((unit) => elapsed >= unit.seconds)
  if (index < 0) return 'recién'
  const major = UNITS[index]
  const majorCount = Math.floor(elapsed / major.seconds)
  const parts = [plural(majorCount, major.label)]
  const minor = UNITS[index + 1]
  if (minor) {
    const minorCount = Math.floor(
      (elapsed - majorCount * major.seconds) / minor.seconds,
    )
    if (minorCount > 0) parts.push(plural(minorCount, minor.label))
  }
  const text = parts.join(' y ')
  return diff >= 0 ? `hace ${text}` : `en ${text}`
}

const formatDate = (date: Date, timeZone?: string) =>
  date.toLocaleDateString('es-AR', { dateStyle: 'long', timeZone })

const formatTime = (date: Date, timeZone?: string) =>
  date.toLocaleTimeString('es-AR', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZone,
  })

const offsetLabel = (date: Date) =>
  new Intl.DateTimeFormat('es-AR', { timeZoneName: 'shortOffset' })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value ?? 'Tu hora'

const useNow = () => {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])
  return now
}

const ZoneRow = ({
  label,
  date,
  timeZone,
}: {
  label: string
  date: Date
  timeZone?: string
}) => (
  <>
    <Text variant="caption" color="muted" monospace>
      {label}
    </Text>
    <Text>{formatDate(date, timeZone)}</Text>
    <Box justifyContent="end">
      <Text color="muted" tabularNums>
        {formatTime(date, timeZone)}
      </Text>
    </Box>
  </>
)

const TimestampDetails = ({ date, soloDia }: { date: Date; soloDia?: boolean }) => {
  const now = useNow()
  const local = offsetLabel(date)
  const isUtc = date.getTimezoneOffset() === 0

  if (soloDia) {
    return (
      <Box flexDirection="column" gap="m" padding="xs">
        <Text>{formatDate(date, 'UTC')}</Text>
        <Text color="muted">Se registró el día, sin la hora.</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" gap="m" padding="xs">
      <Text color="muted">{formatRelative(date, now)}</Text>
      <Grid
        templateColumns="auto 1fr auto"
        columnGap="m"
        rowGap="s"
        alignItems="center"
      >
        <ZoneRow label="UTC" date={date} timeZone="UTC" />
        {!isUtc && <ZoneRow label={local} date={date} />}
      </Grid>
    </Box>
  )
}

export const EventTimestamp = ({
  timestamp,
  soloDia,
  focusable = true,
  children,
}: {
  timestamp: string
  soloDia?: boolean
  focusable?: boolean
  children: ReactNode
}) => (
  <Tooltip delayDuration={300}>
    <TooltipTrigger asChild>
      <span
        className="inline-flex max-w-full min-w-0"
        tabIndex={focusable ? 0 : undefined}
      >
        {children}
      </span>
    </TooltipTrigger>
    <TooltipContent side="left" align="center" className="p-3">
      <TimestampDetails date={new Date(timestamp)} soloDia={soloDia} />
    </TooltipContent>
  </Tooltip>
)

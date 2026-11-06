// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Subscriptions/SubscriptionStatus.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la fecha de la pastilla es la del corte (o el fin del plazo fijo, si está por terminar), como `ends_at` de Polar. Sin pausa:
// MaKo no pausa suscripciones.

import type { SuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import { Pill } from '@/app/admin/_polar/orbit'
import { CircleX, Clock } from '@/app/admin/_polar/orbit/icons'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { getSubscriptionStatusBorderColor, subscriptionStatusDisplayNames } from './utils'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
/** «5 nov» o «5 nov 2025» (un YYYY-MM sale «nov 2026»). */
export const fechaCorta = (iso: string, hoy?: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  const mes = MESES[m - 1] ?? ''
  const anio = !hoy || hoy.slice(0, 4) !== String(y) ? ` ${y}` : ''
  return d ? `${d} ${mes}${anio}` : `${mes} ${y}`
}

const StatusLabel = ({
  color,
  dt,
  eventLabel,
  icon,
  children,
}: {
  color: string
  dt?: string | null
  eventLabel?: string
  icon?: React.ReactNode
  children: React.ReactNode
}) => {
  return (
    <div className={`flex flex-row items-center gap-x-2`}>
      <span className={twMerge('h-2 w-2 rounded-full border-2', color)} />
      <span>{children}</span>
      {dt && (
        <Pill color="gray">
          {icon}
          <span>{eventLabel ? `${eventLabel} el ${fechaCorta(dt)}` : fechaCorta(dt)}</span>
        </Pill>
      )}
    </div>
  )
}

export const SubscriptionStatus = ({ subscription }: { subscription: SuscripcionVenta }) => {
  const { estado, termino, terminaEl } = subscription
  const isEnding = estado !== 'canceled' && terminaEl !== null
  const color = useMemo(() => getSubscriptionStatusBorderColor(estado, isEnding), [estado, isEnding])
  const { eventDate, eventLabel } = useMemo<{ eventDate: string | null; eventLabel?: string }>(() => {
    if (estado === 'canceled') return { eventDate: termino, eventLabel: 'Terminó' }
    if (isEnding) return { eventDate: terminaEl, eventLabel: 'Termina' }
    return { eventDate: null }
  }, [estado, termino, terminaEl, isEnding])
  const icon = useMemo(() => {
    if (estado === 'canceled') return <CircleX className="size-3" />
    if (eventDate) return <Clock className="size-3" />
    return null
  }, [estado, eventDate])
  return (
    <StatusLabel color={color} dt={eventDate} eventLabel={eventLabel} icon={icon}>
      {subscriptionStatusDisplayNames[estado]}
    </StatusLabel>
  )
}

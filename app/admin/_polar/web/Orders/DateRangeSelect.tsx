'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/SalesFilters.tsx
// (su `<DateRangePicker className="w-full shrink-0 sm:w-52 [&>button:last-child]:text-left" … />`). Aviso: lib/avisos/LICENSE-POLAR
// y lib/avisos/NOTICE-POLAR.
//
// MaKo: el DateRangePicker de Polar tal cual (web/Metrics/DateRangePicker.tsx): a la izquierda el calendario para un rango a
// mano, a la derecha el intervalo elegido o el rango («Este mes», «1 – 6 nov 2026»). Lo único propio: Sales cuenta en DÍAS del
// negocio (YYYY-MM-DD, `hoy` en su zona: app/admin/_polar/datos/ventas.ts), así que los intervalos llegan con su rango ya
// calculado (`intervalosConRango`) y lo elegido vuelve como `FechaElegida`, no como un `Date` del navegador.
// (6/11/2026: antes era un Select con el ícono y el texto adentro de un mismo span, y el `[&>span]:line-clamp-1` del trigger lo
// partía en dos renglones: se veía «📅…» y nunca el rango.)

import { format } from 'date-fns'
import { useMemo } from 'react'
import DateRangePicker, { type DateRangeInterval } from '@/app/admin/_polar/web/Metrics/DateRangePicker'
import { esIntervalo, intervalosConRango, rangoDeFecha, type FechaElegida } from '@/app/admin/_polar/datos/ventas'
import { twMerge } from 'tailwind-merge'

/** «YYYY-MM-DD» → la medianoche de ese día en el navegador (lo que pide el calendario de Polar). */
const diaLocal = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const DateRangeSelect = ({
  value,
  hoy,
  desde,
  onChange,
  className,
}: {
  value: FechaElegida
  /** Hoy, en la zona del negocio (YYYY-MM-DD). */
  hoy: string
  /** El primer día con datos: arranca «Desde siempre» y es el piso del calendario. */
  desde: string
  onChange: (v: FechaElegida) => void
  className?: string
}) => {
  const intervals = useMemo<DateRangeInterval[]>(
    () => intervalosConRango(hoy, desde).map((i) => ({ slug: i.slug, label: i.label, value: [diaLocal(i.desde), diaLocal(i.hasta)] })),
    [hoy, desde],
  )
  const rango = rangoDeFecha(value, hoy) ?? { desde, hasta: hoy }
  const date = { from: diaLocal(rango.desde), to: diaLocal(rango.hasta) }

  return (
    <DateRangePicker
      className={twMerge('w-full shrink-0 sm:w-52 [&>button:last-child]:text-left', className)}
      date={date}
      intervals={intervals}
      selectedInterval={'intervalo' in value ? value.intervalo : undefined}
      minDate={diaLocal(desde)}
      onDateChange={(v, interval) =>
        onChange(
          interval && esIntervalo(interval.slug)
            ? { intervalo: interval.slug }
            : { desde: format(v.from, 'yyyy-MM-dd'), hasta: format(v.to, 'yyyy-MM-dd') },
        )
      }
    />
  )
}

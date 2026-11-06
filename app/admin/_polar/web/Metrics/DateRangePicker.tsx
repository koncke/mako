'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Metrics/DateRangePicker.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: Polar saca «All Time» de la fecha de creación de la organización (su contexto); acá la pasa quien lo usa
// (`earliest`), porque cada pantalla sabe desde cuándo tiene datos. Y quien mide por mes (Analytics › Metrics) pasa sólo
// los rangos que un mes puede contestar (`intervals`): «Hoy» sobre un dato mensual mostraría el mes entero como si fuera hoy.
// Los rótulos, traducidos.

import {
  endOfDay,
  endOfMonth,
  endOfToday,
  endOfWeek,
  endOfYear,
  endOfYesterday,
  format,
  startOfDay,
  startOfMonth,
  startOfToday,
  startOfWeek,
  startOfYear,
  startOfYesterday,
  subMonths,
  subYears,
} from 'date-fns'
import * as React from 'react'

import { CalendarMonthOutlined } from '@/app/admin/_polar/orbit/icons'
import FormattedInterval from '@/app/admin/_polar/atoms/FormattedInterval'
import { Calendar } from '@/app/admin/_polar/ui/calendar'
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@/app/admin/_polar/ui/popover'
import { twMerge } from 'tailwind-merge'

export const dateRangeIntervals = (earliest: Date | string): DateRangeInterval[] => [
  {
    slug: 'today',
    label: 'Hoy',
    value: [startOfToday(), endOfToday()],
  },
  {
    slug: 'yesterday',
    label: 'Ayer',
    value: [startOfYesterday(), endOfYesterday()],
  },
  {
    slug: 'thisWeek',
    label: 'Esta semana',
    value: [startOfWeek(new Date()), endOfWeek(new Date())],
  },
  {
    slug: 'thisMonth',
    label: 'Este mes',
    value: [startOfMonth(new Date()), endOfMonth(new Date())],
  },
  {
    slug: 'lastMonth',
    label: 'El mes pasado',
    value: [
      startOfMonth(subMonths(new Date(), 1)),
      endOfMonth(subMonths(new Date(), 1)),
    ],
  },
  {
    slug: 'last3Months',
    label: 'Últimos 3 meses',
    value: [subMonths(startOfToday(), 3), endOfToday()],
  },
  {
    slug: 'thisYear',
    label: 'Este año',
    value: [startOfYear(new Date()), endOfYear(new Date())],
  },
  {
    slug: 'lastYear',
    label: 'El año pasado',
    value: [
      startOfYear(subYears(new Date(), 1)),
      endOfYear(subYears(new Date(), 1)),
    ],
  },
  {
    slug: 'allTime',
    label: 'Desde siempre',
    value: [startOfDay(new Date(earliest)), endOfToday()],
  },
]

export const dateRangeToMatchingInterval = (
  date: DateRange,
  intervals: DateRangeInterval[],
) => {
  // Compare dates by their date-only representation (ignoring time)
  // to handle cases where times differ after roundtripping through query params
  const fromDate = format(date.from, 'yyyy-MM-dd')
  const toDate = format(date.to, 'yyyy-MM-dd')

  return intervals.find((interval) => {
    const intervalFromDate = format(interval.value[0], 'yyyy-MM-dd')
    const intervalToDate = format(interval.value[1], 'yyyy-MM-dd')
    return fromDate === intervalFromDate && toDate === intervalToDate
  })
}

export type DateRange = {
  from: Date
  to: Date
}

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined
  /** MaKo: desde cuándo hay datos («Desde siempre»). Sin esto, el rango arranca en `minDate` o hoy. */
  earliest?: Date | string
  /** MaKo: los rangos que se ofrecen, si no son los de siempre (`dateRangeIntervals`). */
  intervals?: DateRangeInterval[]
  onDateChange: (v: DateRange, interval?: DateRangeInterval) => void
  minDate?: Date
  additionalIntervals?: DateRangeInterval[]
  selectedInterval?: DateRangeIntervalSlug | null
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  className,
  date,
  onDateChange,
  minDate,
  earliest,
  intervals,
  additionalIntervals,
  selectedInterval,
}) => {
  const base = intervals ?? dateRangeIntervals(earliest ?? minDate ?? new Date())
  const interval =
    selectedInterval !== undefined
      ? [...(additionalIntervals ?? []), ...base].find(
          (int) => int.slug === selectedInterval,
        )
      : date
        ? dateRangeToMatchingInterval(date, [
            ...(additionalIntervals ?? []),
            ...base,
          ])
        : undefined

  return (
    <div
      className={twMerge(
        'dark:border-polar-700 dark:bg-polar-800 dark:divide-polar-700 flex h-10 w-52 flex-row divide-x divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xs',
        className,
      )}
    >
      <Popover>
        <PopoverTrigger className="dark:hover:bg-polar-700 flex cursor-pointer items-center justify-center px-4 py-3 transition-colors duration-150 hover:bg-gray-100">
          <CalendarMonthOutlined fontSize="inherit" />
        </PopoverTrigger>
        <PopoverContent>
          <Calendar
            autoFocus
            mode="range"
            defaultMonth={date?.to}
            selected={date}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(v) => {
              onDateChange({
                from: startOfDay(v?.from ?? new Date()),
                to: endOfDay(v?.to ?? new Date()),
              })
            }}
          />
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger className="dark:hover:bg-polar-700 flex-1 cursor-pointer truncate px-4 text-sm transition-colors duration-150 hover:bg-gray-100">
          {interval ? (
            interval.label
          ) : date?.from ? (
            date.to ? (
              <FormattedInterval
                startDatetime={date.from}
                endDatetime={date.to}
              />
            ) : (
              format(date.from, 'LLL dd, yy')
            )
          ) : (
            <span>Elige una fecha</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="p-2">
          <DateRangeIntervals
            interval={interval}
            intervals={base}
            additionalIntervals={additionalIntervals}
            onIntervalChange={(int) => {
              onDateChange(
                {
                  from: int.value[0],
                  to: int.value[1],
                },
                int,
              )
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  )
}

export type DateRangeIntervalSlug =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last3Months'
  | 'thisYear'
  | 'lastYear'
  | 'allTime'
  | (string & {})

export interface DateRangeInterval {
  slug: DateRangeIntervalSlug
  label: string
  value: [Date, Date]
}

interface DateRangeIntervalProps {
  interval: DateRangeInterval | undefined
  intervals: DateRangeInterval[]
  onIntervalChange: (interval: DateRangeInterval) => void
  additionalIntervals?: DateRangeInterval[]
}

const DateRangeIntervals = ({
  interval,
  intervals,
  onIntervalChange,
  additionalIntervals,
}: DateRangeIntervalProps) => {
  const allIntervals = [...(additionalIntervals ?? []), ...intervals]

  return (
    <div className="flex w-full flex-col gap-1">
      {allIntervals.map((int) => (
        <PopoverClose asChild key={int.slug}>
          <div
            onClick={() => onIntervalChange(int)}
            role="button"
            className={twMerge(
              'dark:hover:bg-polar-800 dark:text-polar-500 flex w-full items-center justify-between rounded-sm border border-transparent px-3 py-2 text-sm text-gray-500 select-none hover:bg-gray-100',
              interval?.slug === int.slug &&
                'dark:bg-polar-800 dark:border-polar-700 bg-gray-100 text-black dark:text-white',
            )}
          >
            {int.label}
          </div>
        </PopoverClose>
      ))}
    </div>
  )
}

export default DateRangePicker

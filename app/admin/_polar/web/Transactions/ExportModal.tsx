'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Export/ExportModal.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ Vive en Transactions/ (no en Export/): hoy lo usa sólo el «Export» de Income. El selector de fechas es el de
//    Analytics (web/Metrics/DateRangePicker.tsx), que ya es el de Polar.
// ⚠️ LO QUE SE SACÓ: el renglón «Time zone» (hora local o UTC): MaKo guarda el DÍA de cada pago, en la zona de la
//    plataforma, sin hora, así que no hay nada que convertir. La selección sigue llevando `timezone` (la del navegador) por
//    la forma de Polar, y nadie la usa.

import DateRangePicker, { type DateRange } from '@/app/admin/_polar/web/Metrics/DateRangePicker'
import { Button, InlineModal, InlineModalHeader, List, ListItem, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { endOfToday, format, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { ChevronDown } from '@/app/admin/_polar/orbit/icons'
import React, { useMemo, useState } from 'react'
import { ExportColumnGroup, ExportColumns } from './ExportColumns'
import { ExportSelection, createExportColumnConfig } from './exportUtils'

const formatExportRange = (range: DateRange): string => {
  const from = format(range.from, 'd MMM yyyy', { locale: es })
  const to = format(range.to, 'd MMM yyyy', { locale: es })
  return from === to ? from : `${from} – ${to}`
}

interface ExportModalProps<T extends string> {
  start: string | Date
  title: string
  description: string
  dateRangeLabel: string
  columns: readonly ExportColumnGroup<T>[]
  defaultColumns: T[]
  onExport: (selection: ExportSelection<T>) => void
  banner?: React.ReactNode
  exportDisabled?: boolean
  isShown: boolean
  hide: () => void
}

export function ExportModal<T extends string>({
  start,
  title,
  description,
  dateRangeLabel,
  columns: columnGroups,
  defaultColumns,
  onExport,
  banner,
  exportDisabled = false,
  isShown,
  hide,
}: ExportModalProps<T>) {
  const columnConfig = useMemo(() => createExportColumnConfig(columnGroups, defaultColumns), [columnGroups, defaultColumns])
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const rangeStart = startOfDay(new Date(start))
  const [dateRange, setDateRange] = useState<DateRange>({
    from: rangeStart,
    to: endOfToday(),
  })
  const [columns, setColumns] = useState<T[]>(columnConfig.defaults)
  const [columnsExpanded, setColumnsExpanded] = useState(false)

  const rangeLabel = formatExportRange(dateRange)

  const handleExport = () => {
    if (exportDisabled) {
      return
    }

    onExport({
      dateRange,
      timezone: localTimezone,
      columns: columnConfig.order(columns),
    })
    hide()
  }

  return (
    <InlineModal
      isShown={isShown}
      hide={hide}
      modalContent={
        <>
          <InlineModalHeader hide={hide}>
            <Text variant="heading-xs" as="h2">
              {title}
            </Text>
          </InlineModalHeader>

          <Box flexDirection="column" rowGap="xl" paddingHorizontal="2xl" paddingBottom="2xl">
            <Text color="muted">{description}</Text>

            {banner}

            <List size="small">
              <ListItem size="small" className="px-4 py-3 hover:bg-transparent dark:hover:bg-transparent">
                <Box flexDirection="column" rowGap="xs" minWidth={0}>
                  <Text>{dateRangeLabel}</Text>
                  <Text variant="caption" color="muted" truncate>
                    {rangeLabel}
                  </Text>
                </Box>
                <Box flexShrink={0}>
                  <DateRangePicker date={dateRange} onDateChange={setDateRange} minDate={rangeStart} />
                </Box>
              </ListItem>

              <ListItem size="small" className="px-4 py-3 hover:bg-transparent dark:hover:bg-transparent">
                <Box flexDirection="column" rowGap="xs" minWidth={0}>
                  <Text>Columnas</Text>
                  <Text variant="caption" color="muted" truncate>
                    {columnConfig.summarize(columns)}
                  </Text>
                </Box>
                <Box flexShrink={0}>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-9 px-4"
                    aria-expanded={columnsExpanded}
                    onClick={() => setColumnsExpanded((current) => !current)}
                  >
                    {columns.length === columnConfig.all.length ? `Las ${columnConfig.all.length}` : `${columns.length} elegidas`}
                    <ChevronDown
                      className={`ml-2 h-4 w-4 opacity-50 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                        columnsExpanded ? 'rotate-180' : ''
                      }`}
                    />
                  </Button>
                </Box>
              </ListItem>

              {columnsExpanded ? (
                <Box flexDirection="column" paddingHorizontal="l" paddingVertical="l">
                  <ExportColumns config={columnConfig} selected={columns} onChange={setColumns} />
                </Box>
              ) : null}
            </List>

            <Box flexDirection="column" rowGap="s">
              <Button fullWidth disabled={exportDisabled || columns.length === 0} onClick={handleExport}>
                Bajar el CSV
              </Button>
              <Text variant="caption" color="muted" align="center">
                {columns.length} columnas | {rangeLabel}
              </Text>
            </Box>
          </Box>
        </>
      }
    />
  )
}

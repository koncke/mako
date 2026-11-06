'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/events/EventsSidebar.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la barra de filtros de Polar, en su orden: el rango, los tipos de evento (con su cantidad), los negocios y el
// orden. Se sacaron «Source» (user/system), «Cost» («sólo con costo»), «LLM» («sólo de IA») y los metadatos: ningún evento
// de MaKo los tiene, y un filtro que no puede dejar afuera nada es un control que no hace nada.

import { CustomerSelector } from '@/app/admin/_polar/web/Events/CustomerSelector'
import { EventTypeFilter } from '@/app/admin/_polar/web/Events/EventTypeFilter'
import DateRangePicker, {
  DateRangeInterval,
  DateRangeIntervalSlug,
} from '@/app/admin/_polar/web/Metrics/DateRangePicker'
import type { NegocioEvento, Orden, TipoConConteo } from '@/app/admin/_polar/datos/eventos'
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { FunnelX } from '@/app/admin/_polar/orbit/icons'

export const EventsSidebar = ({
  earliest,
  dateRange,
  rangeIntervals,
  selectedRange,
  onDateRangeChange,
  sorting,
  onSortingChange,
  eventTypes,
  selectedEventTypes,
  onToggleEventType,
  negocios,
  selectedCustomerIds,
  onSelectCustomerIds,
  hasActiveFilters,
  onReset,
}: {
  earliest: Date
  dateRange: { from: Date; to: Date }
  rangeIntervals: DateRangeInterval[]
  selectedRange: DateRangeIntervalSlug | null
  onDateRangeChange: (
    range: { from: Date; to: Date },
    interval?: DateRangeInterval,
  ) => void
  sorting: Orden
  onSortingChange: (sorting: Orden) => void
  eventTypes: TipoConConteo[]
  selectedEventTypes: string[]
  onToggleEventType: (name: string) => void
  negocios: readonly NegocioEvento[]
  selectedCustomerIds: number[] | null
  onSelectCustomerIds: (ids: number[] | null) => void
  hasActiveFilters: boolean
  onReset: () => void
}) => {
  return (
    <Box flexDirection="column" gap="l" height="100%">
      <Box
        alignItems="center"
        justifyContent="between"
        paddingHorizontal="l"
        paddingTop="l"
        minHeight={40}
      >
        <Text>Filtros</Text>
        {hasActiveFilters && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 [&_svg]:size-3!"
                onClick={onReset}
                aria-label="Quitar los filtros"
              >
                <FunnelX />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quitar los filtros</TooltipContent>
          </Tooltip>
        )}
      </Box>
      <Box
        flexDirection="column"
        gap="xl"
        overflowY="auto"
        paddingHorizontal="l"
        paddingTop="s"
        paddingBottom="l"
      >
        <Box flexDirection="column" gap="s">
          <h3 className="text-sm">Período</h3>
          <DateRangePicker
            date={dateRange}
            onDateChange={onDateRangeChange}
            earliest={earliest}
            additionalIntervals={rangeIntervals}
            selectedInterval={selectedRange}
            className="w-full"
          />
        </Box>
        <Box flexDirection="column" gap="s">
          <h3 className="text-sm">Eventos</h3>
          <EventTypeFilter
            eventTypes={eventTypes}
            selected={selectedEventTypes}
            onToggle={onToggleEventType}
          />
        </Box>
        <CustomerSelector
          negocios={negocios}
          selectedCustomerIds={selectedCustomerIds}
          onSelectCustomerIds={onSelectCustomerIds}
        />
        <Box flexDirection="column" gap="s">
          <h3 className="text-sm">Orden</h3>
          <Select
            value={sorting}
            onValueChange={(value) => onSortingChange(value as Orden)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ordenar por" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="-timestamp">Los más nuevos</SelectItem>
              <SelectItem value="timestamp">Los más viejos</SelectItem>
            </SelectContent>
          </Select>
        </Box>
      </Box>
    </Box>
  )
}

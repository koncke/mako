'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Metrics/dashboards/DashboardViewHeader.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: queda el menú «Export» (todas las métricas del rango, en un CSV que arma el navegador con lo que ya tiene:
// `filasCsvDeMetricas`). Se sacaron el «+» que crea un tablero propio y el menú de cada tablero (editar, borrar): Polar los
// guarda en su API (`/v1/metrics/dashboards`) y MaKo no tiene dónde (docs/relevo/nube-admin-polar.md, «se sacó»).

import { MoreVertOutlined } from '@/app/admin/_polar/orbit/icons'
import type { ParsedMetricsResponse } from '@/app/admin/_polar/datos/polar-tipos'
import type { MetricaSlug } from '@/app/admin/_polar/datos/metricas'
import { descargarCsv, filasCsvDeMetricas, toISODate } from '@/app/admin/_polar/web/utils/metrics'
import { Button } from '@/app/admin/_polar/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/admin/_polar/ui/dropdown-menu'
import { useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

interface DashboardViewActionsProps {
  data: ParsedMetricsResponse
  metrics: MetricaSlug[]
  startDate: Date
  endDate: Date
  className?: string
}

export function DashboardViewActions({
  data,
  metrics,
  startDate,
  endDate,
  className,
}: DashboardViewActionsProps) {
  const exportMetrics = useCallback(
    () =>
      descargarCsv(
        `mako-metrics-${toISODate(startDate)}-${toISODate(endDate)}.csv`,
        filasCsvDeMetricas(data, metrics),
      ),
    [data, metrics, startDate, endDate],
  )

  return (
    <div className={twMerge('flex items-center gap-x-2', className)}>
      <ExportMenu onExport={exportMetrics} />
    </div>
  )
}

// ─── Dot menu ────────────────────────────────────────────────────────────────

function ExportMenu({ onExport }: { onExport: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8"
          aria-label="Más opciones"
        >
          <MoreVertOutlined fontSize="small" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExport}>Exportar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

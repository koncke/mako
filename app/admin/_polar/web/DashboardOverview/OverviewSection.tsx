'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/DashboardOverview/OverviewSection.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: las métricas salen de lo que ENTRÓ por mes (lib/admin-ingresos.ts → `metricasDeIngresos`, app/admin/_polar/datos/
// metricas.ts), que el server lee y pasa por props (Polar las pedía con `useMetrics`). Overview y Analytics › Metrics son los
// ÚNICOS lugares con este gráfico. Diferencias con Polar, cada una con su porqué:
//   · los rangos son los que MaKo puede contestar midiendo por mes («Todo» sólo si el primer pago entra en los meses leídos;
//     sin «30d» ni «Today»: `rangosDisponibles`), y el intervalo es siempre el mes;
//   · las métricas elegidas se recuerdan en el navegador (Polar: en la organización), y sin el `AccessRestricted` de Polar:
//     Admin es sólo del super admin.

import { MetricGroup } from '@/app/admin/_polar/web/Metrics/dashboards/MetricGroup'
import { Alert, Button, Modal, SegmentedControl, Text } from '@/app/admin/_polar/orbit'
import { Settings2 } from '@/app/admin/_polar/orbit/icons'
import { DEFAULT_OVERVIEW_METRICS } from '@/app/admin/_polar/web/utils/metrics'
import { metricasDeIngresos, type MetricaSlug } from '@/app/admin/_polar/datos/metricas'
import {
  RANGO_POR_DEFECTO, ROTULO_RANGO, mesesDelRango, metricasRecordadas, rangosDisponibles,
  type IngresosResumen, type Lectura, type RangoOverview,
} from '@/app/admin/_polar/datos/resumen'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { useRouter } from '@/app/_ui/Link'
import React, { useCallback } from 'react'
import { MetricSelectorModalContent, useMetricSelectorModal } from './MetricSelectorModal'
import { useChartRange, useRecordado } from './useChartRange'

interface OverviewSectionProps {
  ingresos: Lectura<IngresosResumen>
}

export function OverviewSection({ ingresos }: OverviewSectionProps) {
  const router = useRouter()
  const disponibles = React.useMemo<RangoOverview[]>(
    () => (ingresos.ok ? rangosDisponibles(ingresos.datos) : [RANGO_POR_DEFECTO]),
    [ingresos],
  )
  const { range, setRange } = useChartRange(disponibles, RANGO_POR_DEFECTO)
  const { isShown, show, hide } = useMetricSelectorModal()

  const serializar = useCallback((v: MetricaSlug[]) => JSON.stringify(v), [])
  const [activeMetrics, setActiveMetrics] = useRecordado<MetricaSlug[]>(
    'mako.admin.overview.metricas',
    DEFAULT_OVERVIEW_METRICS,
    metricasRecordadas,
    serializar,
  )

  const data = React.useMemo(
    () => (ingresos.ok ? metricasDeIngresos(mesesDelRango(ingresos.datos, range), ingresos.datos) : undefined),
    [ingresos, range],
  )

  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Text as="h2" variant="heading-xxs">
          Metrics
        </Text>
        {ingresos.ok ? (
          <div className="flex items-center justify-between gap-x-4">
            <SegmentedControl
              options={disponibles.map((value) => ({ value, label: ROTULO_RANGO[value] }))}
              value={range}
              onChange={setRange}
            />
            <Button
              type="button"
              onClick={show}
              variant="secondary"
              size="sm"
              wrapperClassNames="gap-x-2"
              aria-label="Personalizar"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Personalizar</span>
            </Button>
          </div>
        ) : null}
      </div>
      {ingresos.ok ? (
        <MetricGroup data={data} metricKeys={activeMetrics} interval="month" />
      ) : (
        <Alert
          variant="danger"
          title="No pude leer tus ingresos"
          description={
            <>
              {ingresos.error} <ReportarASoporte error={`No pude leer tus ingresos: ${ingresos.error}`} />
            </>
          }
          actions={[{ text: 'Reintentar', onClick: () => router.refresh() }]}
        />
      )}
      <Modal
        title="Personalizar las métricas de Overview"
        isShown={isShown}
        hide={hide}
        modalContent={
          <MetricSelectorModalContent
            activeMetrics={activeMetrics}
            onSave={(slugs) => {
              setActiveMetrics(slugs)
              hide()
            }}
          />
        }
      />
    </div>
  )
}

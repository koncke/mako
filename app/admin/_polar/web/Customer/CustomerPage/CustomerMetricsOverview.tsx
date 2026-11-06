'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerMetricsOverview.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ SIN GRÁFICOS (Martín, 6/11/2026: el gráfico de ingresos nunca va en Customers; vive en Overview y en Analytics › Metrics).
//    Polar dibuja acá un `MetricGroup` (un MetricChartBox con su gráfico por métrica: revenue, costs, gross_margin,
//    gross_margin_percentage, orders). Quedan las CIFRAS, en la caja de métricas de Polar sin gráfico (`MiniMetricChartBox`):
//    lo que pagó en el rango, lo que paga por mes hoy y cuántos pagos hizo (con `totalesDePedidos` de Sales: lo devuelto no
//    suma). Sin lo que paga por mes (no se pudo leer), esa caja queda sin número: no es un cero. Costs y Profit se sacaron: MaKo no mide lo que le
//    cuesta cada negocio (el gasto de IA por negocio no es atribuible: lib/costos-ia.ts).

import { MiniMetricChartBox } from '@/app/admin/_polar/web/Metrics/MiniMetricChartBox'
import { METRICAS } from '@/app/admin/_polar/datos/metricas'
import { cifrasDelRango } from '@/app/admin/_polar/datos/cliente'
import type { Pedido } from '@/app/admin/_polar/datos/ventas'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useMemo } from 'react'
import { CustomerMetricsRangeControl } from './CustomerMetricsRangeControl'
import { useCustomerMetricsParams } from './useCustomerMetricsParams'

interface CustomerMetricsOverviewProps {
  pedidos: Pedido[]
  /** `null` = no se pudo leer lo que paga por mes (no es un cero). */
  mrrUsd: number | null
  /** El principio de la actividad del negocio (el «All Time»). */
  inicio: string
}

export const CustomerMetricsOverview = ({
  pedidos,
  mrrUsd,
  inicio,
}: CustomerMetricsOverviewProps) => {
  const { desde, hasta } = useCustomerMetricsParams(inicio)

  const cifras = useMemo(
    () => cifrasDelRango(pedidos, mrrUsd ?? 0, desde, hasta),
    [pedidos, mrrUsd, desde, hasta],
  )

  return (
    <Box flexDirection="column" rowGap="xl">
      <Box
        flexDirection={{ base: 'column', md: 'row' }}
        alignItems={{ base: 'start', md: 'center' }}
        justifyContent="between"
        gap="l"
      >
        <Text as="h2" variant="heading-xxs">
          Metrics
        </Text>
        <CustomerMetricsRangeControl inicio={inicio} />
      </Box>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MiniMetricChartBox
          title="Lo que pagó"
          metric={METRICAS.revenue}
          value={cifras.revenue}
        />
        <MiniMetricChartBox
          title="Lo que paga por mes"
          metric={mrrUsd == null ? null : METRICAS.monthly_recurring_revenue}
          value={cifras.mrr}
        />
        <MiniMetricChartBox
          title="Pagos"
          metric={METRICAS.orders}
          value={cifras.orders}
        />
      </div>
      {cifras.sinDolares > 0 && (
        <Text variant="caption" color="muted">
          {cifras.sinDolares === 1
            ? '1 pago del rango no tiene su valor en dólares y no suma.'
            : `${cifras.sinDolares} pagos del rango no tienen su valor en dólares y no suman.`}
        </Text>
      )}
    </Box>
  )
}

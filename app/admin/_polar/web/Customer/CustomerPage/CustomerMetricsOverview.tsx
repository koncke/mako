'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerMetricsOverview.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ SIN GRÁFICOS (Martín, 6/11/2026: el gráfico de ingresos nunca va en Customers; vive en Overview y en Analytics › Metrics).
//    Polar dibuja acá un `MetricGroup` (un MetricChartBox con su gráfico por métrica: revenue, costs, gross_margin,
//    gross_margin_percentage, orders). Quedan las CIFRAS, en la caja de métricas de Polar sin gráfico (`MiniMetricChartBox`),
//    las de Polar que MaKo llena:
//    · lo pagado y los pedidos del rango (`cifrasDelRango`, con `totalesDePedidos` de Sales: lo devuelto no suma);
//    · Costs, Profit y Profit Margin (los nombres de Polar para costs, gross_margin y gross_margin_percentage) sólo si el gasto
//      de IA de este negocio es atribuible, con LA regla de Cost Drivers (`costoDelNegocio` → `cifrasDeCosto`): del MES de ese
//      gasto, que se mide por mes, y por eso van en su renglón con el mes en el título (no siguen al rango).
// ⛔ Sin «Lo que paga por mes» (revisión del 6/11/2026): era ingreso mensual en Customers, uno de los motivos del rechazo, y Polar
//    no lo tiene en la ficha.

import { MiniMetricChartBox } from '@/app/admin/_polar/web/Metrics/MiniMetricChartBox'
import { METRICAS } from '@/app/admin/_polar/datos/metricas'
import { cifrasDeCosto, cifrasDelRango } from '@/app/admin/_polar/datos/cliente'
import type { CostoDelNegocio } from '@/app/admin/_polar/datos/clientes'
import { mesTxt } from '@/lib/admin-ingresos-reglas'
import type { Pedido } from '@/app/admin/_polar/datos/ventas'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useMemo } from 'react'
import { CustomerMetricsRangeControl } from './CustomerMetricsRangeControl'
import { useCustomerMetricsParams } from './useCustomerMetricsParams'

interface CustomerMetricsOverviewProps {
  pedidos: Pedido[]
  /** Su gasto de IA del mes, con la regla de Cost Drivers. `null` = no se pudo leer. */
  costo: CostoDelNegocio | null
  /** El principio de la actividad del negocio (el «All Time»). */
  inicio: string
}

export const CustomerMetricsOverview = ({
  pedidos,
  costo,
  inicio,
}: CustomerMetricsOverviewProps) => {
  const { desde, hasta } = useCustomerMetricsParams(inicio)

  const cifras = useMemo(
    () => cifrasDelRango(pedidos, desde, hasta),
    [pedidos, desde, hasta],
  )
  const delMes = useMemo(() => cifrasDeCosto(pedidos, costo), [pedidos, costo])

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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MiniMetricChartBox
          title="Lo que pagó"
          metric={METRICAS.revenue}
          value={cifras.revenue}
        />
        <MiniMetricChartBox
          title="Pagos"
          metric={METRICAS.orders}
          value={cifras.orders}
        />
      </div>
      {delMes && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-ficha="costos-del-mes">
          <MiniMetricChartBox
            title={`${METRICAS.costs.display_name} · ${mesTxt(delMes.periodo)}`}
            metric={METRICAS.costs}
            value={delMes.costs}
          />
          <MiniMetricChartBox
            title={`${METRICAS.gross_margin.display_name} · ${mesTxt(delMes.periodo)}`}
            metric={METRICAS.gross_margin}
            value={delMes.profit}
          />
          <MiniMetricChartBox
            title={`${METRICAS.gross_margin_percentage.display_name} · ${mesTxt(delMes.periodo)}`}
            metric={delMes.margen == null ? null : METRICAS.gross_margin_percentage}
            value={delMes.margen}
          />
        </div>
      )}
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

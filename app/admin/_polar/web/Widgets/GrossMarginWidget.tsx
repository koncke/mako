'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/GrossMarginWidget.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el margen de lo cobrado (lo mismo que suma Revenue, `vistaDeIngresos`) contra el gasto de IA que paga MaKo
// (lib/costos-ia.ts, el mismo total que Analytics › Costs), de los últimos 30 días y de cada uno de los cinco meses completos
// de antes, como en Polar. Polar lo pedía con dos `useMetrics` (`revenue` y `costs`, por día y por mes); acá lo arma el server
// de una lectura (app/admin/_polar/datos/resumen.ts, `margenBruto`) y llega por props. Lo que cambió:
//   · sin el `WidgetGuard` de Polar (`analytics:read`): en Admin no hay permisos por rol;
//   · un mes sin el gasto medido (sin ninguna fila de uso de IA) dice «–», como un mes sin ingresos: nunca un 100% inventado;
//     y si no se pudo leer el gasto o los ingresos, la tarjeta lo dice (`WidgetError`), nunca un 0%;
//   · el link de cada mes lleva a Costs con `?mes=YYYY-MM` (el parámetro de la Costs de MaKo; Polar manda `startDate` y
//     `endDate`).

import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import { DIAS_MARGEN, mesCorto, type Lectura, type MargenBruto } from '@/app/admin/_polar/datos/resumen'
import { MonthlyBars } from './MonthlyBars'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetLink } from './WidgetLink'

const WIDGET_TITLE = 'Margen bruto'

interface GrossMarginWidgetProps {
  className?: string
  margen: Lectura<MargenBruto>
}

export const GrossMarginWidget = ({ className, margen }: GrossMarginWidgetProps) => {
  const router = useRouter()
  const trailingMargin = margen.ok ? margen.datos.ultimos30 : null
  const periods = margen.ok ? margen.datos.meses : []

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {trailingMargin != null ? `${trailingMargin}%` : '–'}
          </Text>
          <Text color="muted">Últimos {DIAS_MARGEN} días</Text>
        </Box>
      }
      action={<WidgetLink href="/admin/analytics/costs" />}
      className={className}
    >
      {margen.ok ? (
        <Box flexDirection="column" paddingBottom="m">
          <MonthlyBars
            max={100}
            bars={periods.map((period, index) => ({
              key: period.mes,
              label: mesCorto(period.mes),
              value: period.margen,
              formatted: period.margen != null ? `${period.margen}%` : '–',
              highlighted: index === periods.length - 1,
              href: period.href,
            }))}
          />
        </Box>
      ) : (
        <WidgetError title="No pude calcular el margen" detail={margen.error} onRetry={() => router.refresh()} />
      )}
    </WidgetContainer>
  )
}

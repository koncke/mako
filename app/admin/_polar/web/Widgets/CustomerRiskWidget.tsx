'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/CustomerRiskWidget.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: LA lista de Customers › At Risk (`vistaDeAtRisk`, armada para la tarjeta por `riesgoDeOverview` de
// app/admin/_polar/datos/resumen.ts): atrasados, cobros fallidos, pausados, los que dejaron de pagar y los sin uso, sin los
// clientes de una agencia. Polar dice «Past due» o «Cancels <fecha>» y el monto de la suscripción; acá va el estado de MaKo en
// su color (rojo lo grave, amarillo lo demás, como en la página) y lo que paga por mes (sin monto, no se escribe). El número
// grande es el largo de esa lista, así que dice lo mismo que la página a la que lleva «Ver todo» (revisión del Cerebro del
// 6/11/2026, punto 7). Un atrasado sin cuenta de MaKo abre su ficha del CRM; sin nada que abrir, la fila no es un link (punto 24).

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import type { Lectura, Riesgo } from '@/app/admin/_polar/datos/resumen'
import { ListRow } from './ListRow'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetLink } from './WidgetLink'

const WIDGET_TITLE = 'At Risk'
const VISIBLE_ROWS = 5

export interface CustomerRiskWidgetProps {
  className?: string
  riesgo: Lectura<Riesgo>
}

export const CustomerRiskWidget = ({ className, riesgo }: CustomerRiskWidgetProps) => {
  const router = useRouter()
  const items = riesgo.ok ? riesgo.datos.filas : []

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Text variant="heading-m" weight="book">
          {riesgo.ok ? String(riesgo.datos.total) : '–'}
        </Text>
      }
      action={<WidgetLink href="/admin/customers/at-risk" />}
      className={className}
    >
      {!riesgo.ok ? (
        <WidgetError title="No pude leer los negocios en riesgo" detail={riesgo.error} onRetry={() => router.refresh()} />
      ) : items.length === 0 ? (
        <Box
          flex={1}
          flexDirection="column"
          justifyContent="end"
          rowGap="xs"
          paddingBottom="xl"
        >
          {/* El mismo vacío que la página At Risk: los dos cuentan lo mismo. */}
          <Text>Nada en riesgo</Text>
          <Text color="muted">
            Ningún pago atrasado, cobro fallido ni negocio sin uso.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingBottom="m">
          {items.slice(0, VISIBLE_ROWS).map((item) => (
            // `clave` y no `ws`: un atrasado sin cuenta de MaKo no tiene `ws`.
            <ListRow key={item.clave} href={item.href ?? undefined}>
              <Box alignItems="baseline" columnGap="s" minWidth={0}>
                <Text truncate>{item.nombre}</Text>
                {item.plan && (
                  <Text color="muted" truncate>
                    {item.plan}
                  </Text>
                )}
              </Box>
              <Box alignItems="baseline" columnGap="m" flexShrink={0}>
                <Text color={item.grave ? 'danger' : 'warning'}>{item.texto}</Text>
                {item.montoCentavos != null && item.montoCentavos > 0 && (
                  <Text tabularNums>{formatCurrency('statistics')(item.montoCentavos, 'usd')}</Text>
                )}
              </Box>
            </ListRow>
          ))}
        </Box>
      )}
    </WidgetContainer>
  )
}

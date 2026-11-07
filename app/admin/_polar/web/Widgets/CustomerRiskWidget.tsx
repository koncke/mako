'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/CustomerRiskWidget.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la MISMA lista que Customers › At Risk (como Polar, donde la tarjeta y la página llaman a `useAtRisk(organization, 100)`):
// `vistaDeAtRisk` → `clientesEnRiesgo` (app/admin/_polar/datos/clientes.ts), con el mismo orden y el mismo motivo por negocio
// (atrasado, cobro fallido, pausado, dejó de pagar, sin uso), en rojo lo grave como en la página. Se ven las primeras
// VISIBLE_ROWS; el número grande es el total de la lista («100+» si llegó al tope, como Polar): `riesgoDeLaTarjeta`
// (app/admin/_polar/datos/resumen.ts). Polar dice «Past due» o «Cancels <fecha>» y el monto de la suscripción; acá el motivo de
// MaKo y lo que paga por mes (sin un monto que decir, no se escribe). La fila: ./ListRow.tsx.

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import { rutaDeNegocio } from '@/app/admin/_polar/datos/clientes'
import { totalDeRiesgoTxt, type Lectura, type Riesgo } from '@/app/admin/_polar/datos/resumen'
import { ListRow } from './ListRow'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetLink } from './WidgetLink'
import { VISIBLE_ROWS } from './fila'

const WIDGET_TITLE = 'At Risk'

export interface CustomerRiskWidgetProps {
  className?: string
  riesgo: Lectura<Riesgo>
}

export const CustomerRiskWidget = ({ className, riesgo }: CustomerRiskWidgetProps) => {
  const router = useRouter()
  const basePath = '/admin/customers'
  const items = riesgo.ok ? riesgo.datos.filas : []

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Text variant="heading-m" weight="book">
          {riesgo.ok ? totalDeRiesgoTxt(riesgo.datos) : '–'}
        </Text>
      }
      action={<WidgetLink href={`${basePath}/at-risk`} />}
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
          <Text>Nada en riesgo</Text>
          <Text color="muted">
            Ningún pago atrasado, cobro fallido ni negocio sin uso.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingBottom="m">
          {items.slice(0, VISIBLE_ROWS).map((item) => (
            <ListRow
              key={item.clave}
              href={item.ws != null ? rutaDeNegocio(item.ws) : undefined}
              nombre={item.nombre}
              secundario={item.plan ?? undefined}
              dato={
                <>
                  <Text as="span" color={item.grave ? 'danger' : 'warning'}>
                    {item.texto}
                  </Text>
                  {item.montoCentavos != null && item.montoCentavos > 0 && (
                    <Text as="span" tabularNums>
                      {formatCurrency('statistics')(item.montoCentavos, 'usd')}
                    </Text>
                  )}
                </>
              }
            />
          ))}
        </Box>
      )}
    </WidgetContainer>
  )
}

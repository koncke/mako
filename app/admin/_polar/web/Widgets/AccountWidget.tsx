'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/AccountWidget.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la tarjeta «Available balance» de Polar es «Por cobrar» (decidido el 6/11/2026, el LEEME de la referencia): MaKo no
// tiene un saldo para retirar. El número grande es el total de los próximos cobros que ya calcula `vistaDeIngresos()`
// (`porCobrar`: lo atrasado y lo que vence en los próximos 31 días, con la historia mes a mes de cada suscripción), y debajo
// cada uno, donde Polar lista sus payouts. El armado, en app/admin/_polar/datos/resumen.ts (`porCobrarResumen`): acá no se
// suma nada que la vista no haya sumado. Lo que se sacó de Polar, cada cosa con su porqué:
//   · `WidgetGuard`/`WidgetRestricted` (el permiso `finance:read` y el 403 de la cuenta): en Admin no hay permisos por rol
//     (es sólo del super admin, y lo pregunta la página);
//   · `useOrganizationAccount`, `useTransactionsSummary` y `usePayouts` (la cuenta de Polar, su saldo y sus retiros), y el
//     `PayoutStatusIcon` de cada retiro: en su lugar, «Atrasado» en rojo en el cobro que ya venció;
//   · el vacío «You may only withdraw funds above $10» (el mínimo para retirar de Polar): MaKo no retira; el vacío dice qué
//     aparece acá;
//   · el límite de 10 filas de `usePayouts`: la lista son TODOS los próximos cobros, así el número grande es la suma de lo que
//     se ve (la tarjeta scrollea, como la de Polar).
// «Ver todo» lleva a Sales › Subscriptions (donde está cada suscripción con su próximo cobro), no a Finance; con algo
// atrasado, filtrada en las atrasadas (`hrefDePorCobrar`, revisión del Cerebro del 6/11/2026, punto 8). Un cobro de un lead
// sin cuenta de MaKo abre su ficha del CRM (punto 24).

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import { hrefDePorCobrar, type Lectura, type PorCobrarResumen } from '@/app/admin/_polar/datos/resumen'
import { ListRow } from './ListRow'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetLink } from './WidgetLink'

export interface AccountWidgetProps {
  className?: string
  porCobrar: Lectura<PorCobrarResumen>
}

const WIDGET_TITLE = 'Por cobrar'

export const AccountWidget = ({ className, porCobrar }: AccountWidgetProps) => {
  const router = useRouter()
  const cobros = porCobrar.ok ? porCobrar.datos.filas : []
  const total = porCobrar.ok
    ? formatCurrency('statistics')(porCobrar.datos.totalCentavos, 'usd')
    : '–'

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Text variant="heading-m" weight="book">
          {total}
        </Text>
      }
      action={<WidgetLink href={hrefDePorCobrar(porCobrar.ok ? porCobrar.datos : null)} />}
      className={className}
    >
      {!porCobrar.ok ? (
        <WidgetError title="No pude leer lo que hay por cobrar" detail={porCobrar.error} onRetry={() => router.refresh()} />
      ) : cobros.length > 0 ? (
        <Box flexDirection="column" paddingBottom="m">
          {cobros.map((cobro) => (
            <ListRow key={cobro.id} href={cobro.href ?? undefined}>
              <Box alignItems="baseline" columnGap="s" minWidth={0}>
                <Text truncate>{cobro.nombre}</Text>
                <Text color={cobro.atrasado ? 'danger' : 'muted'} truncate>
                  {cobro.atrasado ? `Atrasado · ${cobro.cuando}` : cobro.cuando}
                </Text>
              </Box>
              <Text tabularNums>
                {formatCurrency('statistics')(cobro.centavos, 'usd')}
              </Text>
            </ListRow>
          ))}
        </Box>
      ) : (
        <Box
          flex={1}
          flexDirection="column"
          justifyContent="end"
          rowGap="xs"
          paddingBottom="xl"
        >
          <Text>Nada por cobrar todavía</Text>
          <Text color="muted">
            Las mensualidades que vencen en el próximo mes, y las atrasadas, aparecen aquí.
          </Text>
        </Box>
      )}
    </WidgetContainer>
  )
}

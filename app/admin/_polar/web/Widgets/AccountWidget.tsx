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
//   · el límite de 10 filas de `usePayouts`: se ven los primeros cinco (VISIBLE_ROWS, como Activity y At Risk de Polar: la
//     tarjeta tiene el alto fijo de Polar y una sexta fila quedaba cortada a la mitad por el borde). El número grande sigue
//     siendo el total de TODOS los próximos cobros, y si hay más de los que se ven, al lado se dice cuántos son; el resto está
//     en «Ver todo».
// Cada fila: el negocio y, a la derecha y enteros, cuándo vence (en rojo y con su fecha si está atrasado) y cuánto
// (./ListRow.tsx: el estado con su fecha es un dato, no lo secundario que se corta).
// «Ver todo» lleva a Sales › Subscriptions (donde está cada suscripción con su próximo cobro), no a Finance.

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import { tarjetaPorCobrar, type Lectura, type PorCobrarResumen } from '@/app/admin/_polar/datos/resumen'
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
  const tarjeta = porCobrar.ok ? tarjetaPorCobrar(porCobrar.datos) : null
  const cobros = tarjeta?.visibles ?? []
  const total = tarjeta
    ? formatCurrency('statistics')(tarjeta.totalCentavos, 'usd')
    : '–'

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {total}
          </Text>
          {tarjeta?.cuantos && <Text color="muted">{tarjeta.cuantos}</Text>}
        </Box>
      }
      action={<WidgetLink href="/admin/sales/subscriptions" />}
      className={className}
    >
      {!porCobrar.ok ? (
        <WidgetError title="No pude leer lo que hay por cobrar" detail={porCobrar.error} onRetry={() => router.refresh()} />
      ) : cobros.length > 0 ? (
        <Box flexDirection="column" paddingBottom="m">
          {cobros.map((cobro) => (
            <ListRow
              key={cobro.id}
              href={cobro.href ?? undefined}
              nombre={cobro.nombre}
              dato={
                <>
                  <Text as="span" color={cobro.atrasado ? 'danger' : 'muted'}>
                    {cobro.atrasado ? `Atrasado · ${cobro.cuando}` : cobro.cuando}
                  </Text>
                  <Text as="span" tabularNums>
                    {formatCurrency('statistics')(cobro.centavos, 'usd')}
                  </Text>
                </>
              }
            />
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

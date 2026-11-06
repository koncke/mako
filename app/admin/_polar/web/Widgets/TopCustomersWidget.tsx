'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/TopCustomersWidget.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los que más le pagaron a MaKo (los clientes de lib/admin-ingresos.ts, `topClientes` en
// app/admin/_polar/datos/resumen.ts). ⚠️ Polar cuenta los últimos 12 meses; MaKo tiene lo pagado por cliente desde SIEMPRE,
// así que el titular dice «del total cobrado» (y «Ver todo» abre Top Customers desde siempre, con los mismos montos). Un
// cliente sin cuenta de MaKo (un lead que pagó) abre su ficha del CRM de la plataforma; sin nada que abrir, la fila no es un
// link (revisión del Cerebro del 6/11/2026, punto 24).

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import type { Lectura, TopClientes } from '@/app/admin/_polar/datos/resumen'
import { ListRow } from './ListRow'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetLink } from './WidgetLink'

const WIDGET_TITLE = 'Top Customers'

interface TopCustomersWidgetProps {
  className?: string
  top: Lectura<TopClientes>
}

export const TopCustomersWidget = ({ className, top }: TopCustomersWidgetProps) => {
  const router = useRouter()
  const customers = top.ok ? top.datos.filas : []
  const share = top.ok ? top.datos.parte : null

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {share != null ? `${share}%` : '–'}
          </Text>
          <Text color="muted">del total cobrado</Text>
        </Box>
      }
      action={<WidgetLink href="/admin/customers/top" />}
      className={className}
    >
      {!top.ok ? (
        <WidgetError title="No pude leer quién más pagó" detail={top.error} onRetry={() => router.refresh()} />
      ) : customers.length === 0 ? (
        <Box
          flex={1}
          flexDirection="column"
          justifyContent="end"
          rowGap="xs"
          paddingBottom="xl"
        >
          <Text>Todavía no entró ningún pago</Text>
          <Text color="muted">Cuando un negocio le pague a MaKo, aparece aquí.</Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingBottom="m">
          {customers.map((customer) => (
            <ListRow key={customer.clave} href={customer.href ?? undefined}>
              <Box alignItems="baseline" columnGap="s" minWidth={0}>
                <Text truncate>{customer.nombre}</Text>
                <Text color="muted">
                  {customer.pagos} {customer.pagos === 1 ? 'pago' : 'pagos'}
                </Text>
              </Box>
              <Text tabularNums>{formatCurrency('statistics')(customer.totalCentavos, 'usd')}</Text>
            </ListRow>
          ))}
        </Box>
      )}
    </WidgetContainer>
  )
}

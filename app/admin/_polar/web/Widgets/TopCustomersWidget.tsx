'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/TopCustomersWidget.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los que más le pagaron a MaKo (los clientes de lib/admin-ingresos.ts, `topClientes` en
// app/admin/_polar/datos/resumen.ts). ⚠️ Polar cuenta los últimos 12 meses; MaKo tiene lo pagado por cliente desde SIEMPRE,
// así que el titular dice «del total cobrado». Un cliente sin cuenta de MaKo (un lead que pagó) no tiene ficha en
// Customers: su fila no lleva link.

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import type { Lectura, TopClientes } from '@/app/admin/_polar/datos/resumen'
import { ListRow } from './ListRow'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetLink } from './WidgetLink'
import { VISIBLE_ROWS } from './fila'

const WIDGET_TITLE = 'Top Customers'

interface TopCustomersWidgetProps {
  className?: string
  top: Lectura<TopClientes>
}

export const TopCustomersWidget = ({ className, top }: TopCustomersWidgetProps) => {
  const router = useRouter()
  const basePath = '/admin/customers'
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
      action={<WidgetLink href={`${basePath}/top`} />}
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
          {/* MaKo: el nombre y lo pagado enteros; «N pagos» cede primero y se esconde si no entra (./ListRow.tsx). */}
          {customers.slice(0, VISIBLE_ROWS).map((customer) => (
            <ListRow
              key={customer.clave}
              href={customer.ws != null ? `${basePath}/${customer.ws}` : undefined}
              nombre={customer.nombre}
              secundario={`${customer.pagos} ${customer.pagos === 1 ? 'pago' : 'pagos'}`}
              dato={<Text as="span" tabularNums>{formatCurrency('statistics')(customer.totalCentavos, 'usd')}</Text>}
            />
          ))}
        </Box>
      )}
    </WidgetContainer>
  )
}

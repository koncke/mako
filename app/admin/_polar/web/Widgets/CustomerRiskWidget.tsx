'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/CustomerRiskWidget.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los negocios en riesgo de lib/clientes-plataforma.ts (`vistaDeClientes`): pausados, con el último cobro fallido o
// sin uso. Polar dice «Past due» o «Cancels <fecha>» y el monto de la suscripción; acá va el motivo de MaKo y lo que paga por
// mes (sin MRR, no se escribe un monto). El armado, en app/admin/_polar/datos/resumen.ts (`filasDeRiesgo`).

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import Link, { useRouter } from '@/app/_ui/Link'
import type { Lectura, Riesgo } from '@/app/admin/_polar/datos/resumen'
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
  const basePath = '/admin/customers'
  const items = riesgo.ok ? riesgo.datos.filas : []

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Text variant="heading-m" weight="book">
          {riesgo.ok ? String(riesgo.datos.total) : '–'}
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
            Ningún negocio está pausado, con un cobro fallido ni sin uso.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingBottom="m">
          {items.slice(0, VISIBLE_ROWS).map((item) => (
            <Link key={item.ws} href={`${basePath}/${item.ws}`} className="hover:opacity-60">
              <Box
                alignItems="center"
                justifyContent="between"
                columnGap="m"
                paddingVertical="s"
                borderTopWidth={1}
                borderStyle="solid"
                borderColor="border-secondary"
              >
                <Box alignItems="baseline" columnGap="s" minWidth={0}>
                  <Text truncate>{item.nombre}</Text>
                  <Text color="muted" truncate>
                    {item.plan}
                  </Text>
                </Box>
                <Box alignItems="baseline" columnGap="m" flexShrink={0}>
                  <Text color="muted">{item.motivo}</Text>
                  {item.mrrCentavos > 0 && (
                    <Text tabularNums>{formatCurrency('statistics')(item.mrrCentavos, 'usd')}</Text>
                  )}
                </Box>
              </Box>
            </Link>
          ))}
        </Box>
      )}
    </WidgetContainer>
  )
}

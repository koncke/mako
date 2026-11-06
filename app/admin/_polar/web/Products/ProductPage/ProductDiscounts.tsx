'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Products/ProductPage/ProductDiscounts.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Los descuentos que valen para un plan de MaKo. MaKo tiene UNO atado al plan: el que se le ofrece a quien se va a dar de
// baja (`retencion.descuento`, lib/planes-mako.ts y lib/retencion-plan.ts). No tiene código: se ofrece en la pantalla de la
// baja, por eso el renglón dice «Sin código» como el de Polar.
// ⚠️ LO QUE SE SACÓ: el link «View all» (MaKo no tiene una página de descuentos), la carga (`useDiscounts`: el dato llega
//    con el plan) y la paginación (es uno). Lo demás de la retención —pausar meses o pasar a un plan más barato— no es un
//    descuento: no va acá (anotado en el informe del porte, 6/11/2026).

import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { List, ListItem, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { DiscountOutlined } from '@/app/admin/_polar/orbit/icons'
import type { ProductoMako } from '@/app/admin/_polar/datos/productos'

export interface ProductDiscountsProps {
  product: Pick<ProductoMako, 'nombre' | 'descuento'>
}

export const ProductDiscounts = ({ product }: ProductDiscountsProps) => {
  const d = product.descuento
  const discountCount = d ? 1 : 0

  return (
    <Box flexDirection="column" gap="xl" minWidth={0}>
      <Box flexDirection="column" gap="xs" minWidth={0}>
        <Text variant="heading-xxs" as="h2">
          Descuentos
        </Text>
        <Text color="muted">
          {discountCount} {discountCount === 1 ? 'descuento' : 'descuentos'} para {product.nombre}
        </Text>
      </Box>

      {!d ? (
        <EmptyState icon={<DiscountOutlined fontSize="medium" />} title="Sin descuentos" description="Este plan no tiene un descuento para quien se da de baja." />
      ) : (
        <Box flexDirection="column" gap="l">
          <List size="small">
            <ListItem size="small">
              <Box minWidth={0} flexGrow={1} alignItems="center" columnGap="m">
                <Box
                  width={32}
                  height={32}
                  flexShrink={0}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="s"
                  backgroundColor="background-secondary"
                  color="text-secondary"
                >
                  <DiscountOutlined fontSize="small" />
                </Box>
                <Box flexDirection="column" minWidth={0}>
                  <Text truncate>Antes de darse de baja</Text>
                  <Text variant="caption" color="muted">
                    Sin código
                  </Text>
                </Box>
              </Box>
              <Box flexShrink={0} alignItems="center">
                <Text>
                  {d.pct}% por {d.meses} {d.meses === 1 ? 'mes' : 'meses'}
                </Text>
              </Box>
            </ListItem>
          </List>
        </Box>
      )}
    </Box>
  )
}

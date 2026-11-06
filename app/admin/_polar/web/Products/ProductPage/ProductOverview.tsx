// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Products/ProductPage/ProductOverview.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ LO QUE SE SACÓ: la grilla de gráficos (MiniMetricChartBox: suscripciones activas, MRR, ventas, ingresos de hoy y
//    acumulados) y las listas de suscripciones y órdenes del producto. El gráfico de ingresos vive SÓLO en Overview y en
//    Analytics › Metrics, y las suscripciones y las órdenes, en Sales; además un pago de MaKo no guarda de qué plan es, así
//    que «las de este plan» no se pueden contar sin adivinar. Quedan los beneficios y los descuentos, como en Polar.

import { Grid } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ProductBenefits } from './ProductBenefits'
import { ProductDiscounts } from './ProductDiscounts'
import type { ProductoMako } from '@/app/admin/_polar/datos/productos'

export interface ProductOverviewProps {
  product: ProductoMako
}

export const ProductOverview = ({ product }: ProductOverviewProps) => {
  return (
    <Box flexDirection="column" rowGap="3xl">
      {!product.activo ? (
        <ProductBenefits product={product} />
      ) : (
        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, minmax(0, 1fr))' }} columnGap="2xl" rowGap="2xl">
          <ProductBenefits product={product} />
          <ProductDiscounts product={product} />
        </Grid>
      )}
    </Box>
  )
}

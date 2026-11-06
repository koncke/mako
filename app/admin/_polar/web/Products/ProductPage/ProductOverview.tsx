// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Products/ProductPage/ProductOverview.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ LO QUE SE SACÓ:
//    · la grilla de gráficos (MiniMetricChartBox: suscripciones activas, MRR, ventas, ingresos de hoy y acumulados) y las listas
//      de suscripciones y órdenes del producto. El gráfico de ingresos vive SÓLO en Overview y en Analytics › Metrics, y las
//      suscripciones y las órdenes, en Sales; además un pago de MaKo no guarda de qué plan es, así que «las de este plan» no se
//      pueden contar sin adivinar;
//    · los beneficios (ProductBenefits, revisión del 6/11/2026): Benefits es de lo que Polar tiene y MaKo no puede llenar (el
//      pedido de Martín lo nombra para sacarlo). Lo que un plan «incluye» es un texto de venta de /planes, no un beneficio que
//      se otorga y se revoca. La ficha de Polar no muestra la descripción del producto, así que tampoco va otra cosa en su lugar.
// Queda lo que Polar dibuja con un producto vivo: sus descuentos (un archivado no los tiene, como en Polar).

import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ProductDiscounts } from './ProductDiscounts'
import type { ProductoMako } from '@/app/admin/_polar/datos/productos'

export interface ProductOverviewProps {
  product: ProductoMako
}

export const ProductOverview = ({ product }: ProductOverviewProps) => {
  if (!product.activo) return null
  return (
    <Box flexDirection="column" rowGap="3xl">
      <ProductDiscounts product={product} />
    </Box>
  )
}

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Products/ProductPriceTypeLabel.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import React from 'react'

export type ProductPriceType = 'one_time' | 'recurring'

interface ProductPriceTypeLabelProps {
  productPriceType: ProductPriceType
}

const ProductPriceTypeLabel: React.FC<ProductPriceTypeLabelProps> = ({
  productPriceType,
}) => {
  switch (productPriceType) {
    case 'one_time':
      return 'Pago único'
    case 'recurring':
      return 'Suscripción'
    default:
      return null
  }
}

export default ProductPriceTypeLabel

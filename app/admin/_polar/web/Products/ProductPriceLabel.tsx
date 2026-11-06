// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Products/ProductPriceLabel.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El precio de un plan de MaKo: un precio fijo por mes, en dólares (`precioUsd`), y el anual si lo tiene (`verbose`, en la
// ficha). ⚠️ Lo que se sacó de Polar: los precios por uso (metered), por asiento y por unidad, «Pay what you want» y
// «Free»: un plan de MaKo no tiene ninguno de los cuatro. Los dos precios van con la fila de etiquetas de Polar, pero con
// «o» donde Polar pone «+»: Polar suma un precio fijo y uno por uso; acá son dos maneras de pagar lo mismo.

import { Fragment } from 'react'
import AmountLabel from './AmountLabel'
import type { ProductoMako } from '@/app/admin/_polar/datos/productos'

interface ProductPriceLabelProps {
  product: Pick<ProductoMako, 'precioUsd' | 'precioAnualUsd'>
  verbose?: boolean
}

const ProductPriceLabel: React.FC<ProductPriceLabelProps> = ({ product, verbose }: ProductPriceLabelProps) => {
  const labels = [
    <AmountLabel key="mes" amount={Math.round(product.precioUsd * 100)} currency="usd" interval="month" verbose={verbose} />,
    ...(verbose && product.precioAnualUsd != null
      ? [<AmountLabel key="anio" amount={Math.round(product.precioAnualUsd * 100)} currency="usd" interval="year" verbose={verbose} />]
      : []),
  ]

  if (labels.length === 1) {
    return labels[0]
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      {labels.map((label, index) => (
        <Fragment key={index}>
          {index > 0 && <span>o</span>}
          {label}
        </Fragment>
      ))}
    </span>
  )
}

export default ProductPriceLabel

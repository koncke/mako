// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/CheckoutStatus/CheckoutStatus.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import {
  CheckoutStatusDisplayColor,
  CheckoutStatusDisplayTitle,
} from '@/app/admin/_polar/web/utils/checkout'
import { schemas } from '@/app/admin/_polar/datos/polar-tipos'
import { Status } from '@/app/admin/_polar/orbit'

const CheckoutStatus = ({
  checkout: { status },
}: {
  checkout: schemas['Checkout']
}) => {
  return (
    <Status
      color={CheckoutStatusDisplayColor[status]}
      status={CheckoutStatusDisplayTitle[status]}
    />
  )
}

export default CheckoutStatus

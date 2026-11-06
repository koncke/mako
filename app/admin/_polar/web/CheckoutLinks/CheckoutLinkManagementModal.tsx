// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/CheckoutLinks/CheckoutLinkManagementModal.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El modal del «+» de Checkout Links: «Vender un plan». ⚠️ Sin el `AccessRestricted` de Polar (permiso `products:manage`):
// Admin entero es del super admin, y la acción vuelve a preguntar (`venderPlanAction` → `getSesionAdmin()`). Sin el modo
// «Edit Checkout Link»: un cobro de MaKo no se edita.

import { InlineModalHeader } from '@/app/admin/_polar/orbit'
import type { Pasarela } from '@/lib/cobros-tipos'
import type { ProductoMako } from '@/app/admin/_polar/datos/productos'
import { CheckoutLinkForm } from './CheckoutLinkForm'

interface CheckoutLinkManagementModalProps {
  productos: ProductoMako[]
  pasarelas: Pasarela[]
  monedaMp: string | null
  onClose: (cobroId: number) => void
  hide: () => void
  productIds?: string[]
}

export const CheckoutLinkManagementModal = ({ productos, pasarelas, monedaMp, onClose, hide, productIds }: CheckoutLinkManagementModalProps) => {
  return (
    <div className="flex flex-col">
      <InlineModalHeader hide={hide}>
        <h1 className="text-xl">Vender un plan</h1>
      </InlineModalHeader>
      <div className="flex flex-col gap-8 px-8 pb-12">
        <CheckoutLinkForm productos={productos} pasarelas={pasarelas} monedaMp={monedaMp} onClose={onClose} productIds={productIds} />
      </div>
    </div>
  )
}

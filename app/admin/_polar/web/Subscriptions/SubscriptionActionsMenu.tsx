'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Subscriptions/SubscriptionActionsMenu.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: lo único que se le hace a una suscripción desde acá es CORTARLA, y sólo la de la pasarela (`cancelarSuscripcionMakoAction`:
// deja de cobrar en el acto; en Mercado Pago no se puede deshacer). Una a mano se cambia o se corta en su ficha del CRM (los
// cambios de monto, los cortes y las vueltas, mig 0401), que es donde se registran sus pagos. Sin pausar ni «descancelar»: MaKo no
// lo tiene.

import { useState } from 'react'
import { useRouter } from '@/app/_ui/Link'
import type { SuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import { cancelarSuscripcionMakoAction } from '@/app/admin/cobros/actions'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { ConfirmModal } from '@/app/admin/_polar/web/Modal/ConfirmModal'
import { AvisoDeError, AvisoHecho } from '@/app/admin/_polar/web/Orders/Aviso'
import { MoreVertOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button } from '@/app/admin/_polar/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/admin/_polar/atoms/DropdownMenu'

const SubscriptionActionsMenu = ({ subscription }: { subscription: SuscripcionVenta }) => {
  const router = useRouter()
  const cortar = useModal()
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const cobroId = subscription.cobroParaCortar

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="Más acciones">
            <MoreVertOutlined fontSize="small" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {cobroId != null && <DropdownMenuItem onClick={cortar.show}>Cortar la suscripción</DropdownMenuItem>}
          <DropdownMenuItem
            onClick={() => {
              navigator.clipboard.writeText(subscription.id).then(() => setHecho('Copiaste el ID de la suscripción.')).catch(() => setError('No pude copiar el ID.'))
            }}
          >
            Copiar el ID de la suscripción
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {(error || hecho) && (
        <div className="fixed right-6 bottom-6 z-50 max-w-sm">
          <AvisoDeError texto={error} />
          <AvisoHecho texto={hecho} />
        </div>
      )}
      {cobroId != null && (
        <ConfirmModal
          isShown={cortar.isShown}
          hide={cortar.hide}
          title="¿Cortar la suscripción?"
          description={`La pasarela deja de cobrarle a ${subscription.cliente.nombre} en el acto. No se devuelve nada (eso es «Devolver el pago», en el pedido). En Mercado Pago no se puede deshacer.`}
          destructive
          destructiveText="Cortar la suscripción"
          onConfirm={async () => {
            setError(null)
            const r = await cancelarSuscripcionMakoAction(cobroId).catch(() => ({ ok: false, resumen: 'No pude cortar la suscripción.' }))
            if (!r.ok) return setError(r.resumen)
            setHecho(r.resumen || 'Suscripción cortada.')
            router.refresh()
          }}
        />
      )}
    </>
  )
}

export default SubscriptionActionsMenu

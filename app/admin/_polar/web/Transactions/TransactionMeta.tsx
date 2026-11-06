// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Transactions/TransactionMeta.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// La descripción de un movimiento: el tipo («Suscripción» / «Compra», el `Subscription` / `Purchase` de Polar, y «Devolución»
// para lo que salió) y, al lado, de quién es (donde Polar pone el producto: un pago de MaKo no guarda de qué plan es), con el
// link a SU PEDIDO de Sales › Orders (el «Order» de la transacción de Polar: el estado y el recibo viven ahí). El tooltip, que
// en Polar repite el producto, dice acá también lo que se pagó y por dónde. ⚠️ Sin los tipos de Polar que MaKo no tiene
// (Reward, Pledge, Payout).

import Link from '@/app/_ui/Link'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/admin/_polar/orbit'
import { medioDeIngreso, tipoDeIngreso, type MovimientoIngreso } from '@/app/admin/_polar/datos/finanzas'

interface TransactionMetaProps {
  transaction: MovimientoIngreso
}

/** El pedido de un movimiento en Sales › Orders. */
export const rutaDelMovimiento = (m: Pick<MovimientoIngreso, 'pedido'>) => `/admin/sales/${m.pedido}`

const TransactionMeta: React.FC<TransactionMetaProps> = ({ transaction }) => {
  return (
    <Tooltip>
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex min-w-0 flex-row gap-3">
          <div className="shrink-0 text-sm capitalize">{tipoDeIngreso(transaction)}</div>
          <TooltipTrigger asChild>
            <Link
              href={rutaDelMovimiento(transaction)}
              className="dark:text-polar-500 min-w-0 truncate text-sm text-gray-500 hover:underline"
            >
              {transaction.nombre}
            </Link>
          </TooltipTrigger>
          <TooltipContent>
            {[transaction.concepto, medioDeIngreso(transaction.medio)].filter(Boolean).join(' · ')}
          </TooltipContent>
        </div>
      </div>
    </Tooltip>
  )
}

export default TransactionMeta

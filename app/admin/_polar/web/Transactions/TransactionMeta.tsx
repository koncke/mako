// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Transactions/TransactionMeta.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// La descripción de una transacción: el tipo («Suscripción» / «Compra», el `Subscription` / `Purchase` de Polar) y, al lado,
// de quién es (donde Polar pone el producto: un pago de MaKo no guarda de qué plan es). El tooltip, que en Polar repite el
// producto, dice acá también por dónde entró. ⚠️ Sin los tipos de Polar que MaKo no tiene (Reward, Pledge, Payout).

import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/admin/_polar/orbit'
import { medioDeIngreso, tipoDeIngreso, type FilaIngreso } from '@/app/admin/_polar/datos/finanzas'

interface TransactionMetaProps {
  transaction: FilaIngreso
}

const TransactionMeta: React.FC<TransactionMetaProps> = ({ transaction }) => {
  return (
    <Tooltip>
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex min-w-0 flex-row gap-3">
          <div className="shrink-0 text-sm capitalize">{tipoDeIngreso(transaction)}</div>
          <TooltipTrigger asChild>
            <span className="dark:text-polar-500 min-w-0 truncate text-sm text-gray-500">{transaction.nombre}</span>
          </TooltipTrigger>
          <TooltipContent>
            {transaction.nombre} · {medioDeIngreso(transaction.medio)}
          </TooltipContent>
        </div>
      </div>
    </Tooltip>
  )
}

export default TransactionMeta

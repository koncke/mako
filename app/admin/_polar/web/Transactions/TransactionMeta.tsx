// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Transactions/TransactionMeta.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// La descripción de una transacción: el tipo («Suscripción», «Pago único» o «Cargado a mano»: lo mismo que dice Orders,
// `motivoDePedido`; antes decía «Compra» donde Orders dice «Pago único») y, al lado, de quién es (donde Polar pone el producto:
// un pago de MaKo no guarda de qué plan es). Si el pedido se devolvió, se anuló o no suma, lo dice con una marca. El medio va en
// su propia columna. ⚠️ Sin los tipos de Polar que MaKo no tiene (Reward, Pledge, Payout).

import { Status } from '@/app/admin/_polar/orbit'
import { marcaDeFila, type FilaIngreso } from '@/app/admin/_polar/datos/finanzas'

interface TransactionMetaProps {
  transaction: FilaIngreso
}

const TransactionMeta: React.FC<TransactionMetaProps> = ({ transaction }) => {
  const marca = marcaDeFila(transaction)
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="shrink-0 text-sm">{transaction.tipo}</div>
      <span className="dark:text-polar-500 min-w-0 truncate text-sm text-gray-500">{transaction.nombre}</span>
      {marca && <Status status={marca} color={transaction.suma ? 'purple' : 'gray'} size="small" />}
    </div>
  )
}

export default TransactionMeta

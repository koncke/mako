'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Orders/OrderDisputesTable.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: un contracargo queda escrito en el recibo (`disputa_texto`) y en el motivo del cobro; es lo único guardado (ni la fecha
// en que se abrió ni el monto disputado aparte). Se responde en la pasarela, no desde MaKo.

import type { CobroVenta, Pedido } from '@/app/admin/_polar/datos/ventas'
import { ROTULO_ESTADO_DISPUTA, estadoDeDisputa } from '@/app/admin/_polar/datos/ventas'
import { esTextoDeContracargo } from '@/lib/cobros-reglas'
import { DataTable, Status } from '@/app/admin/_polar/orbit'
import { OrderSection } from './OrderSection'

export const OrderDisputesTable = ({ order, cobro }: { order: Pedido; cobro: CobroVenta | null }) => {
  const textos = [...new Set([order.recibo?.disputa, cobro?.motivo && esTextoDeContracargo(cobro.motivo) ? cobro.motivo : null].filter((t): t is string => !!t))]
  if (textos.length === 0) {
    return null
  }
  return (
    <OrderSection title="Disputas">
      <DataTable
        isLoading={false}
        columns={[
          {
            accessorKey: 'texto',
            header: 'Qué pasó',
            cell: ({ row }) => <span className="whitespace-normal">{row.original.texto}</span>,
          },
          {
            accessorKey: 'estado',
            header: 'Estado',
            cell: ({ row }) => {
              const e = ROTULO_ESTADO_DISPUTA[estadoDeDisputa(row.original.texto)]
              return <Status color={e.color} status={e.titulo} />
            },
          },
        ]}
        data={textos.map((texto) => ({ texto }))}
      />
    </OrderSection>
  )
}

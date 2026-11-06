'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Subscriptions/SubscriptionOrdersSection.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los pedidos de una suscripción son sus MESES (la historia mes a mes, lib/suscripcion-meses.ts, la misma cuenta que la ficha):
// cuánto tocaba, cuánto entró y qué cambió (empezó, subió, bajó, se cortó, volvió), con el link al pedido de cada pago. Lo pidió
// Martín; Polar sólo lista los pedidos. Una suscripción de la pasarela no tiene historia acá (sus cobros están en Orders).

import Link from '@/app/_ui/Link'
import { ROTULO_CAMBIO_MES, ROTULO_ESTADO_MES, type MesVenta, type SuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import { usdEnTexto } from '@/app/admin/_polar/web/Orders/montos'
import { Button, DataTable, Status, type StatusColor } from '@/app/admin/_polar/orbit'
import { fechaCorta } from './SubscriptionStatus'

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const nombreDelMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1] ?? mes} ${mes.slice(0, 4)}`

const COLOR_ESTADO: Record<MesVenta['estado'], StatusColor> = {
  pagado: 'green', parcial: 'yellow', vencido: 'red', 'vence-hoy': 'yellow', 'por-cobrar': 'blue', proximo: 'gray', cortado: 'gray',
}

const SubscriptionOrdersSection = ({ subscription, hoy }: { subscription: SuscripcionVenta; hoy: string }) => {
  if (subscription.historia.length === 0) {
    return null
  }
  const meses = [...subscription.historia].reverse()
  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg">Mes a mes</h3>
      <DataTable
        data={meses}
        columns={[
          {
            header: 'Mes',
            accessorKey: 'mes',
            cell: ({ row: { original } }) => (
              <span className="flex items-center gap-2">
                <span className="capitalize">{nombreDelMes(original.mes)}</span>
                {original.cambio && (
                  <span className="dark:text-polar-500 text-xs text-gray-500">
                    {ROTULO_CAMBIO_MES[original.cambio]}
                    {original.antesUsd != null && original.esperadoUsd != null ? ` (de ${usdEnTexto(original.antesUsd, 'compact')})` : ''}
                  </span>
                )}
              </span>
            ),
          },
          {
            header: 'Vence',
            accessorKey: 'vence',
            cell: ({ row: { original } }) => (
              <span className="dark:text-polar-500 text-sm text-gray-500">{fechaCorta(original.vence, hoy)}</span>
            ),
          },
          {
            header: 'Estado',
            accessorKey: 'estado',
            cell: ({ row: { original } }) => <Status color={COLOR_ESTADO[original.estado]} status={ROTULO_ESTADO_MES[original.estado]} />,
          },
          {
            header: 'Tocaba',
            accessorKey: 'esperadoUsd',
            cell: ({ row: { original } }) => (original.esperadoUsd != null ? usdEnTexto(original.esperadoUsd, 'compact') : 'Sin monto'),
          },
          {
            header: 'Entró',
            accessorKey: 'pagadoUsd',
            cell: ({ row: { original } }) => usdEnTexto(original.pagadoUsd, 'compact'),
          },
          {
            header: '',
            accessorKey: 'pedidos',
            cell: ({ row: { original } }) =>
              original.pedidos[0] ? (
                <div className="flex justify-end">
                  <Link href={`/admin/sales/${original.pedidos[0]}`}>
                    <Button variant="secondary" size="sm">
                      Ver
                    </Button>
                  </Link>
                </div>
              ) : null,
          },
        ]}
        isLoading={false}
        className="text-sm"
      />
    </div>
  )
}

export default SubscriptionOrdersSection

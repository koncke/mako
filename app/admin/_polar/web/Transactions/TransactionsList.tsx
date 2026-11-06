'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Transactions/TransactionsList.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El libro de movimientos de plata de MaKo (app/admin/_polar/datos/finanzas.ts → `MovimientoIngreso`), con el DataTable de
// Polar: lo que entró en positivo y lo que salió (una devolución) en negativo, cada uno en su moneda.
// ⚠️ LO QUE SE SACÓ: las columnas «Fees», «Tax», «Net» y «Status» (la comisión, el impuesto, el neto y si el payout ya salió:
//    MaKo no guarda la comisión de las pasarelas por pago, `COMISION_PASARELA` es null para Stripe y Mercado Pago), las sub-filas
//    de comisiones y su expansión al tocar, y el tipo de cambio del tooltip de «Gross». La fecha va sin hora: MaKo guarda el día.
//    Tampoco va lo que es del PEDIDO (su estado, su recibo, sus acciones): eso vive en Sales › Orders, y la descripción de cada
//    movimiento lleva ahí.

import { Text, DataTable, DataTableColumnDef, DataTableColumnHeader } from '@/app/admin/_polar/orbit'
import type { DataTablePaginationState, DataTableSortingState } from '@/app/admin/_polar/orbit'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/admin/_polar/orbit'
import { montoEnTexto } from '@/app/admin/_polar/web/Orders/montos'
import type { OnChangeFn } from '@tanstack/react-table'
import TransactionMeta from './TransactionMeta'
import type { MovimientoIngreso } from '@/app/admin/_polar/datos/finanzas'

interface TransactionsListProps {
  transactions: MovimientoIngreso[]
  rowCount: number
  pageCount: number
  pagination: DataTablePaginationState
  onPaginationChange?: OnChangeFn<DataTablePaginationState>
  sorting: DataTableSortingState
  onSortingChange?: OnChangeFn<DataTableSortingState>
  isLoading: boolean
}

const TransactionsList = ({ transactions, rowCount, pageCount, pagination, onPaginationChange, sorting, onSortingChange, isLoading }: TransactionsListProps) => {
  const columns: DataTableColumnDef<MovimientoIngreso>[] = [
    {
      accessorKey: 'fecha',
      id: 'created_at',
      enableSorting: true,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
      cell: (props) => {
        const fecha = props.getValue() as string
        return (
          <Text as="span" tabularNums>
            {/* El día, al mediodía: `new Date('AAAA-MM-DD')` es la medianoche UTC y en América se lee el día anterior. */}
            <FormattedDateTime datetime={`${fecha}T12:00:00`} resolution="day" locale="es" />
          </Text>
        )
      },
    },
    {
      id: 'description',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Descripción" />,
      minSize: 200,
      cell: (props) => <TransactionMeta transaction={props.row.original} />,
    },
    {
      id: 'gross_amount',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" className="flex justify-end" />,
      cell: (props) => {
        const { monto, moneda, tipo } = props.row.original

        if (monto == null || !moneda) {
          return (
            <div className="flex flex-row justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="dark:decoration-polar-500 underline decoration-gray-400 decoration-dashed decoration-1 underline-offset-4">—</span>
                </TooltipTrigger>
                <TooltipContent>
                  {tipo === 'devolucion' ? 'No se guardó cuánto se devolvió: no suma.' : 'Sin su valor en dólares ni su moneda: no suma.'}
                </TooltipContent>
              </Tooltip>
            </div>
          )
        }

        return (
          <div className={monto < 0 ? 'flex flex-row justify-end text-red-500 dark:text-red-400' : 'flex flex-row justify-end'}>
            <Text as="span" tabularNums>
              {montoEnTexto(monto, moneda, 'accounting')}
            </Text>
          </div>
        )
      },
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={transactions}
      rowCount={rowCount}
      pageCount={pageCount}
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      sorting={sorting}
      onSortingChange={onSortingChange}
      getRowId={(row) => row.id}
      isLoading={isLoading}
    />
  )
}

export default TransactionsList

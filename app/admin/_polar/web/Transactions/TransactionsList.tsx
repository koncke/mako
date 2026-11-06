'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Transactions/TransactionsList.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// La lista de lo que entró a MaKo (app/admin/_polar/datos/finanzas.ts → `FilaIngreso`), con el DataTable de Polar.
// ⚠️ LO QUE SE SACÓ: las columnas «Fees», «Tax», «Net» y «Status» (la comisión de Polar, el impuesto, el neto y si el
//    payout ya salió: MaKo no los guarda por pago), las sub-filas de comisiones y su expansión al tocar, y el tipo de cambio
//    del tooltip de «Gross» (cada pago se guarda con su valor en dólares). La fecha va sin hora: MaKo guarda el día.

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text, DataTable, DataTableColumnDef, DataTableColumnHeader } from '@/app/admin/_polar/orbit'
import type { DataTablePaginationState, DataTableSortingState } from '@/app/admin/_polar/orbit'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/admin/_polar/orbit'
import type { OnChangeFn } from '@tanstack/react-table'
import TransactionMeta from './TransactionMeta'
import type { FilaIngreso } from '@/app/admin/_polar/datos/finanzas'

interface TransactionsListProps {
  transactions: FilaIngreso[]
  rowCount: number
  pageCount: number
  pagination: DataTablePaginationState
  onPaginationChange?: OnChangeFn<DataTablePaginationState>
  sorting: DataTableSortingState
  onSortingChange?: OnChangeFn<DataTableSortingState>
  isLoading: boolean
}

const TransactionsList = ({ transactions, rowCount, pageCount, pagination, onPaginationChange, sorting, onSortingChange, isLoading }: TransactionsListProps) => {
  const columns: DataTableColumnDef<FilaIngreso>[] = [
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
        const { usd } = props.row.original

        if (usd == null) {
          return (
            <div className="flex flex-row justify-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="dark:decoration-polar-500 underline decoration-gray-400 decoration-dashed decoration-1 underline-offset-4">—</span>
                </TooltipTrigger>
                <TooltipContent>Sin su valor en dólares: no suma.</TooltipContent>
              </Tooltip>
            </div>
          )
        }

        return <div className="flex flex-row justify-end">{formatCurrency('accounting')(Math.round(usd * 100), 'usd')}</div>
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

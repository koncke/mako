'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Transactions/TransactionsList.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El libro de lo que entró a MaKo (app/admin/_polar/datos/finanzas.ts → `FilaIngreso`: los pedidos de Sales › Orders), con el
// DataTable de Polar: Fecha, Descripción, Medio, Bruto, Devuelto y Neto (Polar: Gross, Fees, Tax, Net). Cada fila abre su pedido.
// ⚠️ LO QUE SE SACÓ: las columnas «Fees», «Tax» y «Status» del payout (la comisión de Polar, el impuesto y si el payout ya salió:
//    MaKo no los guarda por pago), las sub-filas de comisiones y su expansión al tocar, y el tipo de cambio del tooltip de «Gross»
//    (cada pago se guarda con su valor en dólares). La fecha va sin hora: MaKo guarda el día.

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Text, DataTable, DataTableColumnDef, DataTableColumnHeader } from '@/app/admin/_polar/orbit'
import type { DataTablePaginationState, DataTableSortingState } from '@/app/admin/_polar/orbit'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/admin/_polar/orbit'
import type { OnChangeFn } from '@tanstack/react-table'
import TransactionMeta from './TransactionMeta'
import { medioDeIngreso, type FilaIngreso } from '@/app/admin/_polar/datos/finanzas'

interface TransactionsListProps {
  transactions: FilaIngreso[]
  rowCount: number
  pageCount: number
  pagination: DataTablePaginationState
  onPaginationChange?: OnChangeFn<DataTablePaginationState>
  sorting: DataTableSortingState
  onSortingChange?: OnChangeFn<DataTableSortingState>
  isLoading: boolean
  /** Abre el pedido de la fila (su id de Sales). */
  onRowClick?: (id: string) => void
}

/** Un monto en dólares a la derecha; sin él, «—» con el porqué. */
const Monto = ({ usd, sinDato }: { usd: number | null; sinDato: string }) =>
  usd == null ? (
    <div className="flex flex-row justify-end">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="dark:decoration-polar-500 underline decoration-gray-400 decoration-dashed decoration-1 underline-offset-4">—</span>
        </TooltipTrigger>
        <TooltipContent>{sinDato}</TooltipContent>
      </Tooltip>
    </div>
  ) : (
    <div className="flex flex-row justify-end">{formatCurrency('accounting')(Math.round(usd * 100), 'usd')}</div>
  )

const TransactionsList = ({ transactions, rowCount, pageCount, pagination, onPaginationChange, sorting, onSortingChange, isLoading, onRowClick }: TransactionsListProps) => {
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
      id: 'method',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Medio" />,
      cell: (props) => <Text as="span">{medioDeIngreso(props.row.original.medio)}</Text>,
    },
    {
      id: 'gross_amount',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Bruto" className="flex justify-end" />,
      cell: (props) => <Monto usd={props.row.original.brutoUsd} sinDato="Sin su valor en dólares: no suma." />,
    },
    {
      id: 'refunded_amount',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Devuelto" className="flex justify-end" />,
      cell: (props) => (
        <Monto
          usd={props.row.original.devueltoUsd}
          sinDato={props.row.original.estado === 'void' ? 'Se anuló: no entró.' : 'No se sabe cuánto en dólares.'}
        />
      ),
    },
    {
      id: 'net_amount',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Neto" className="flex justify-end" />,
      cell: (props) => (
        <Monto
          usd={props.row.original.netoUsd}
          sinDato={props.row.original.suma ? 'No se sabe cuánto en dólares.' : 'Un recibo cargado a mano sin su pago en el CRM: no suma.'}
        />
      ),
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
      onRowClick={onRowClick ? (row) => onRowClick(row.original.id) : undefined}
    />
  )
}

export default TransactionsList

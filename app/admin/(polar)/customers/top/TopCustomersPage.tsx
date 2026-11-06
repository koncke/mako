'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/top/TopCustomersPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: lo que Polar pide con `useTopCustomers` se suma acá, con los pagos que leyó el server (`topClientes`,
// app/admin/_polar/datos/clientes.ts). «Orders» son los pagos que entraron; «Net Revenue» es lo pagado (MaKo no descuenta
// comisiones ni devoluciones: no se llama «neto»).

import { CustomerCell } from '@/app/admin/_polar/web/Customer/CustomerCell'
import { CustomersPageShell } from '@/app/admin/_polar/web/Customer/CustomersPageShell'
import { AvisosDeLectura } from '@/app/admin/_polar/web/Customer/AvisosDeLectura'
import { useClientSidePagination } from '@/app/admin/_polar/web/Customer/useClientSidePagination'
import { useEnElNavegador } from '@/app/admin/_polar/web/Customer/useEnElNavegador'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  rutaDeNegocio,
  topClientes,
  type ClienteTop,
  type PropsTop,
} from '@/app/admin/_polar/datos/clientes'
import { ChartRange, getChartRangeParams, toISODate } from '@/app/admin/_polar/web/utils/metrics'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Alert, DataTable, DataTableColumnDef } from '@/app/admin/_polar/orbit'
import { TrendingUp } from '@/app/admin/_polar/orbit/icons'
import { useRouter } from '@/app/_ui/Link'
import { useMemo, useState } from 'react'

// El máximo que acepta `/v1/customers/top` de Polar.
const LIMIT = 50

// MaKo: los anchos en porcentajes y la columna secundaria escondida en una caja angosta (`DataTableColumnMeta`): con los
// 150 px fijos de Polar, en el teléfono la tabla se corría de costado y lo pagado quedaba detrás del scroll, y en la
// computadora los nombres se cortaban con lugar libre al lado. El nombre toma el espacio; en el teléfono se ve lo pagado.
const columns: DataTableColumnDef<ClienteTop>[] = [
  {
    accessorKey: 'nombre',
    enableSorting: false,
    meta: { width: '50%' },
    header: 'Cliente',
    cell: ({ row: { original: customer } }) => (
      <CustomerCell
        name={customer.nombre}
        email={customer.ws == null ? 'Sin cuenta en MaKo' : null}
      />
    ),
  },
  {
    accessorKey: 'pagos',
    enableSorting: false,
    meta: { width: '15%', className: 'hidden @md:table-cell' },
    header: 'Pagos',
    cell: ({ getValue }) => (getValue() as number).toLocaleString('es-AR'),
  },
  {
    accessorKey: 'totalCentavos',
    enableSorting: false,
    meta: { width: '35%', className: 'whitespace-nowrap' },
    header: 'Pagado',
    cell: ({ getValue }) =>
      formatCurrency('statistics')(getValue() as number, 'usd'),
  },
]

export const TopCustomersPage = ({ datos, error, avisos, desde }: PropsTop) => {
  const router = useRouter()
  const enElNavegador = useEnElNavegador()
  const [range, setRange] = useState<ChartRange>('30d')
  const [startDate, endDate] = useMemo(
    () => getChartRangeParams(range, desde),
    [range, desde],
  )

  const topCustomers = useMemo(
    () =>
      datos && enElNavegador
        ? topClientes(datos, toISODate(startDate), toISODate(endDate), LIMIT)
        : null,
    [datos, enElNavegador, startDate, endDate],
  )
  const isLoading = !!datos && !topCustomers

  const {
    pageItems,
    pagination,
    setPagination,
    resetPage,
    rowCount,
    pageCount,
  } = useClientSidePagination(topCustomers ?? [])

  return (
    <CustomersPageShell
      range={range}
      onRangeChange={(value) => {
        setRange(value)
        resetPage()
      }}
    >
      {error || !datos ? (
        <Alert
          variant="danger"
          title="No pude leer lo que pagó cada negocio"
          description={error ?? undefined}
          actions={[{ text: 'Reintentar', onClick: () => router.refresh() }]}
        />
      ) : !isLoading && (topCustomers ?? []).length === 0 ? (
        <>
          <AvisosDeLectura avisos={avisos} />
          <EmptyState
            icon={<TrendingUp />}
            title="Sin pagos todavía"
            description="Ningún pago entró en este período."
          />
        </>
      ) : (
        <>
          <AvisosDeLectura avisos={avisos} />
          <DataTable
            className="@container"
            columns={columns}
            data={pageItems}
            isLoading={isLoading}
            rowCount={rowCount}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            getRowId={(customer) => customer.clave}
            onRowClick={(row) => {
              if (row.original.ws != null) {
                router.push(rutaDeNegocio(row.original.ws))
              }
            }}
          />
        </>
      )}
    </CustomersPageShell>
  )
}

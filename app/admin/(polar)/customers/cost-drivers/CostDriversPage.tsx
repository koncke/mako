'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/cost-drivers/CostDriversPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: el costo de cada negocio es lo que le costó a MaKo su IA en el rango elegido (`costosPorCliente`,
// app/admin/_polar/datos/clientes.ts, de lib/costos-ia.ts). El selector de rango es el de Polar, arriba a la derecha (decisión
// del Cerebro, 6/11/2026): cada rango es una ventana exacta que lee el server, así que elegirlo cambia `?range=` y la página se
// vuelve a leer. Si el período no se puede repartir por negocio, se dice (no hay número).

import { CustomerCell } from '@/app/admin/_polar/web/Customer/CustomerCell'
import { CustomersPageShell } from '@/app/admin/_polar/web/Customer/CustomersPageShell'
import { SinReparto } from '@/app/admin/_polar/web/Customer/TopCostCustomersList'
import { useClientSidePagination } from '@/app/admin/_polar/web/Customer/useClientSidePagination'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  RUTA_CUSTOMERS,
  rutaDeNegocio,
  type ClienteCosto,
  type PropsCostDrivers,
} from '@/app/admin/_polar/datos/clientes'
import type { ChartRange } from '@/app/admin/_polar/web/utils/metrics'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Alert, DataTable, DataTableColumnDef, Text } from '@/app/admin/_polar/orbit'
import { Coins } from '@/app/admin/_polar/orbit/icons'
import { useRouter } from '@/app/_ui/Link'

const columns: DataTableColumnDef<ClienteCosto>[] = [
  {
    id: 'customer',
    enableSorting: false,
    header: 'Cliente',
    cell: ({ row: { original: stat } }) => <CustomerCell name={stat.nombre} />,
  },
  {
    accessorKey: 'llamadas',
    enableSorting: false,
    header: 'Llamadas a la IA',
    cell: ({ getValue }) => (getValue() as number).toLocaleString('es-AR'),
  },
  {
    accessorKey: 'share',
    enableSorting: false,
    header: 'Parte del gasto',
    cell: ({ getValue }) => `${Math.round((getValue() as number) * 100)}%`,
  },
  {
    accessorKey: 'costoCentavos',
    enableSorting: false,
    header: 'Costo',
    cell: ({ getValue }) =>
      formatCurrency('subcent')(getValue() as number, 'usd'),
  },
]

export const CostDriversPage = ({ costos, error, range, rotulo }: PropsCostDrivers) => {
  const router = useRouter()
  const stats = costos?.clientes ?? []

  const { pageItems, pagination, setPagination, rowCount, pageCount } =
    useClientSidePagination(stats)

  return (
    <CustomersPageShell
      range={range}
      onRangeChange={(r: ChartRange) => router.replace(`${RUTA_CUSTOMERS}/cost-drivers${r === '30d' ? '' : `?range=${r}`}`)}
    >
      <Text color="muted">{rotulo}</Text>
      {error || !costos ? (
        <Alert
          variant="danger"
          title="No pude leer el gasto de IA"
          description={error ?? undefined}
          actions={[{ text: 'Reintentar', onClick: () => router.refresh() }]}
        />
      ) : !costos.atribuible ? (
        <SinReparto />
      ) : stats.length === 0 ? (
        <EmptyState
          icon={<Coins />}
          title="Sin gasto de IA"
          description="Ningún negocio le costó IA a MaKo en este período."
        />
      ) : (
        <DataTable
          columns={columns}
          data={pageItems}
          isLoading={false}
          rowCount={rowCount}
          pageCount={pageCount}
          pagination={pagination}
          onPaginationChange={setPagination}
          getRowId={(stat) => String(stat.ws)}
          onRowClick={(row) => router.push(rutaDeNegocio(row.original.ws))}
        />
      )}
    </CustomersPageShell>
  )
}

'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/cost-drivers/CostDriversPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: el costo de cada negocio es lo que le costó a MaKo su IA en el mes en curso (`costosPorCliente`,
// app/admin/_polar/datos/clientes.ts, de lib/costos-ia.ts). Sin el selector de rango de Polar: el gasto de IA se corta por
// mes, y «30d» o «3m» no se pueden leer sin inventar. Si el mes no se puede repartir por negocio, se dice (no hay número).

import { CustomerCell } from '@/app/admin/_polar/web/Customer/CustomerCell'
import { CustomersPageShell } from '@/app/admin/_polar/web/Customer/CustomersPageShell'
import { SinReparto } from '@/app/admin/_polar/web/Customer/TopCostCustomersList'
import { useClientSidePagination } from '@/app/admin/_polar/web/Customer/useClientSidePagination'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  rutaDeNegocio,
  type ClienteCosto,
  type PropsCostos,
} from '@/app/admin/_polar/datos/clientes'
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

export const CostDriversPage = ({ costos, error, mesDeCostos }: PropsCostos) => {
  const router = useRouter()
  const stats = costos?.clientes ?? []

  const { pageItems, pagination, setPagination, rowCount, pageCount } =
    useClientSidePagination(stats)

  return (
    <CustomersPageShell>
      <Text color="muted">Gasto de IA de {mesDeCostos}</Text>
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
          description="Ningún negocio le costó IA a MaKo este mes."
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

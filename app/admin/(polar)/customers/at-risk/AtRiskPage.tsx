'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/at-risk/AtRiskPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: lo que Polar junta con `useAtRisk` (las suscripciones atrasadas y las que se cancelan) llega armado del server
// (`clientesEnRiesgo`, app/admin/_polar/datos/clientes.ts): un renglón por negocio, con su motivo más grave.

import { CustomerCell } from '@/app/admin/_polar/web/Customer/CustomerCell'
import { CustomersPageShell } from '@/app/admin/_polar/web/Customer/CustomersPageShell'
import { AvisosDeLectura } from '@/app/admin/_polar/web/Customer/AvisosDeLectura'
import { useClientSidePagination } from '@/app/admin/_polar/web/Customer/useClientSidePagination'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  rutaDeNegocio,
  type ClienteEnRiesgo,
  type PropsAtRisk,
} from '@/app/admin/_polar/datos/clientes'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Alert, DataTable, DataTableColumnDef, Text } from '@/app/admin/_polar/orbit'
import { ShieldCheck } from '@/app/admin/_polar/orbit/icons'
import { useRouter } from '@/app/_ui/Link'

const columns: DataTableColumnDef<ClienteEnRiesgo>[] = [
  {
    id: 'customer',
    enableSorting: false,
    header: 'Cliente',
    cell: ({ row: { original } }) => <CustomerCell name={original.nombre} />,
  },
  {
    id: 'product',
    enableSorting: false,
    header: 'Plan',
    cell: ({ row: { original } }) => original.plan ?? 'Sin cuenta en MaKo',
  },
  {
    id: 'amount',
    enableSorting: false,
    header: 'Monto',
    cell: ({ row: { original } }) =>
      original.montoCentavos != null
        ? formatCurrency('statistics')(original.montoCentavos, 'usd')
        : '—',
  },
  {
    id: 'status',
    enableSorting: false,
    header: 'Estado',
    cell: ({ row: { original } }) => (
      <Text color={original.grave ? 'danger' : 'warning'}>{original.texto}</Text>
    ),
  },
]

export const AtRiskPage = ({ atRisk, error, avisos }: PropsAtRisk) => {
  const router = useRouter()
  const items = atRisk ?? []
  const { pageItems, pagination, setPagination, rowCount, pageCount } =
    useClientSidePagination(items)

  return (
    <CustomersPageShell>
      {error || !atRisk ? (
        <Alert
          variant="danger"
          title="No pude leer los negocios en riesgo"
          description={error ?? undefined}
          actions={[{ text: 'Reintentar', onClick: () => router.refresh() }]}
        />
      ) : items.length === 0 ? (
        <>
          <AvisosDeLectura avisos={avisos} />
          <EmptyState
            icon={<ShieldCheck />}
            title="Nada en riesgo"
            description="Ningún pago atrasado, cobro fallido ni negocio sin uso."
          />
        </>
      ) : (
        <>
          <AvisosDeLectura avisos={avisos} />
          <DataTable
            columns={columns}
            data={pageItems}
            isLoading={false}
            rowCount={rowCount}
            pageCount={pageCount}
            pagination={pagination}
            onPaginationChange={setPagination}
            getRowId={(item) => item.clave}
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

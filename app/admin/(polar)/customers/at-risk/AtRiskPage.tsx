'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/at-risk/AtRiskPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: lo que Polar junta con `useAtRisk` (las suscripciones atrasadas y las que se cancelan) llega armado del server
// (`clientesEnRiesgo`, app/admin/_polar/datos/clientes.ts): un renglón por negocio, con su motivo más grave.
// Debajo, «Para mirar» (decisión del Cerebro, 6/11/2026; `clientesParaMirar`): lo que pide atención sin ser un riesgo de cobro
// (pago pendiente, fin de lo gratis, sin empezar, en prueba, nuevo), en una tabla con las mismas columnas. No suma al riesgo.
// Es LA cuenta de riesgo: la tarjeta At Risk de la portada dibuja la misma lista (revisión del Cerebro del 6/11/2026, punto 7).
// Un atrasado sin cuenta de MaKo abre su ficha del CRM; sin nada que abrir, la fila no es clicable (`rutaDeQuienPaga`, punto 24).

import { CustomerCell } from '@/app/admin/_polar/web/Customer/CustomerCell'
import { CustomersPageShell } from '@/app/admin/_polar/web/Customer/CustomersPageShell'
import { AvisosDeLectura } from '@/app/admin/_polar/web/Customer/AvisosDeLectura'
import { useClientSidePagination } from '@/app/admin/_polar/web/Customer/useClientSidePagination'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  rutaDeNegocio,
  rutaDeQuienPaga,
  type ClienteEnRiesgo,
  type ClienteParaMirar,
  type PropsAtRisk,
} from '@/app/admin/_polar/datos/clientes'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
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

const COLOR_TONO: Record<ClienteParaMirar['tono'], 'danger' | 'warning' | 'muted' | 'success'> = {
  bad: 'danger',
  warn: 'warning',
  info: 'muted',
  good: 'success',
}

const columnasParaMirar: DataTableColumnDef<ClienteParaMirar>[] = [
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
    cell: ({ row: { original } }) => original.plan ?? '—',
  },
  {
    id: 'reason',
    enableSorting: false,
    header: 'Motivo',
    cell: ({ row: { original } }) => <Text color={COLOR_TONO[original.tono]}>{original.rotulo}</Text>,
  },
  {
    id: 'status',
    enableSorting: false,
    header: 'Qué pasa',
    cell: ({ row: { original } }) => <Text color="muted">{original.texto}</Text>,
  },
]

// Sin paginar: la paginación de arriba vive en la URL (`page`), y dos tablas con la misma se moverían juntas. Son pocos.
const ParaMirar = ({ items }: { items: ClienteParaMirar[] }) => {
  const router = useRouter()
  if (items.length === 0) return null
  return (
    <Box flexDirection="column" rowGap="m">
      <Text as="h2" variant="heading-xxs">
        Para mirar
      </Text>
      <DataTable
        columns={columnasParaMirar}
        data={items}
        isLoading={false}
        getRowId={(item) => String(item.ws)}
        onRowClick={(row) => router.push(rutaDeNegocio(row.original.ws))}
      />
    </Box>
  )
}

export const AtRiskPage = ({ atRisk, error, avisos, paraMirar, plataforma }: PropsAtRisk & { plataforma: number | null }) => {
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
            isRowClickable={(row) => rutaDeQuienPaga(row.original, plataforma) != null}
            onRowClick={(row) => {
              const ruta = rutaDeQuienPaga(row.original, plataforma)
              if (ruta) router.push(ruta)
            }}
          />
        </>
      )}
      {!error && atRisk && paraMirar && <ParaMirar items={paraMirar} />}
    </CustomersPageShell>
  )
}

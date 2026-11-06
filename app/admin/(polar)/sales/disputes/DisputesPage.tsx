'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/disputes/DisputesPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la vista es PURA. Lo que Polar tiene y MaKo no guarda se sacó: «Respond by» y «Opened» (MaKo no guarda cuándo se abrió ni
// hasta cuándo se responde), y el detalle con la respuesta (en MaKo un contracargo se responde en la pasarela). Tocar una disputa
// lleva a su PEDIDO, que tiene la disputa en su sección: cada dato en un lugar.

import { useMemo } from 'react'
import { useRouter } from '@/app/_ui/Link'
import { DisputeStatusSelect } from '@/app/admin/_polar/web/Disputes/DisputeStatusSelect'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { AvisosDeLectura } from '@/app/admin/_polar/web/Customer/AvisosDeLectura'
import { useDataTableQueryState } from '@/app/admin/_polar/web/Orders/useDataTableQueryState'
import { usdEnTexto } from '@/app/admin/_polar/web/Orders/montos'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  PAGINA_POR_DEFECTO, ROTULO_ESTADO_DISPUTA, esEstadoDisputa, filtrarDisputas, paginar,
  type DisputaVenta, type EstadoDisputa,
} from '@/app/admin/_polar/datos/ventas'
import { DataTable, DataTableColumnDef, DataTableColumnHeader, Status, Text, Truncated } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { GavelOutlined } from '@/app/admin/_polar/orbit/icons'

interface Props {
  disputas: DisputaVenta[]
  avisos: string[]
}

const DisputesPage = ({ disputas, avisos }: Props) => {
  const router = useRouter()

  const { pagination, setPagination, params, setParams } = useDataTableQueryState({ defaultPageSize: PAGINA_POR_DEFECTO })

  const statusParam = params.get('status')
  const status: EstadoDisputa | null = esEstadoDisputa(statusParam) ? statusParam : null
  const setStatus = (value: EstadoDisputa | null) => setParams({ status: value, page: null })

  const filtradas = useMemo(() => filtrarDisputas(disputas, status), [disputas, status])
  const pagina = paginar(filtradas, pagination.pageIndex, pagination.pageSize)

  const columns: DataTableColumnDef<DisputaVenta>[] = [
    {
      accessorKey: 'customer',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
      cell: ({ row: { original: dispute } }) => (
        <Truncated>
          <Text>{dispute.cliente}</Text>
        </Truncated>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
      cell: ({ row: { original: dispute } }) => {
        const { titulo, color } = ROTULO_ESTADO_DISPUTA[dispute.estado]
        return <Status status={titulo} color={color} size="small" />
      },
    },
    {
      accessorKey: 'reason',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Por qué" />,
      cell: ({ row: { original: dispute } }) => <Text color="muted">{dispute.razon ?? '—'}</Text>,
    },
    {
      accessorKey: 'amount',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Monto" />,
      cell: ({ row: { original: dispute } }) => <Text>{usdEnTexto(dispute.usd, 'standard')}</Text>,
    },
  ]

  return (
    <DashboardBody wide title="Disputes">
      <Box flexDirection="column" rowGap="l">
        <AvisosDeLectura avisos={avisos} />
        {disputas.length === 0 ? (
          <EmptyState
            icon={<GavelOutlined fontSize="inherit" />}
            title="Todavía no hubo contracargos"
            description="Un contracargo del banco aparece aquí."
          />
        ) : (
          <>
            <Box alignItems="center" columnGap="m">
              <Box width={220}>
                <DisputeStatusSelect value={status} onChange={setStatus} />
              </Box>
            </Box>
            <DataTable
              columns={columns}
              data={pagina.filas}
              rowCount={pagina.total}
              pageCount={pagina.paginas}
              pagination={pagination}
              onPaginationChange={setPagination}
              isLoading={false}
              getRowId={(row) => row.id}
              // Una disputa sin pedido no se abre: parecer clicable y no abrir nada se lee como que está rota (punto 24).
              isRowClickable={(row) => row.original.pedido != null}
              onRowClick={(row) => {
                if (row.original.pedido) router.push(`/admin/sales/${row.original.pedido}`)
              }}
            />
          </>
        )}
      </Box>
    </DashboardBody>
  )
}

export default DisputesPage

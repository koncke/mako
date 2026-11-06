'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/checkouts/CheckoutsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la vista es PURA. El filtro por email (Polar: `query`) y por estado, en memoria con el estado en la URL. Sin el filtro por
// producto ni la etiqueta de versión: un cobro de MaKo dice su plan o su concepto, no un producto del catálogo. «Product» es el
// plan (o el concepto) y su monto en la moneda del cobro.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from '@/app/_ui/Link'
import CheckoutStatus from '@/app/admin/_polar/web/Checkouts/CheckoutStatus'
import CheckoutStatusSelect from '@/app/admin/_polar/web/Checkouts/CheckoutStatusSelect'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { AvisosDeLectura } from '@/app/admin/_polar/web/Orders/Aviso'
import { useDataTableQueryState } from '@/app/admin/_polar/web/Orders/useDataTableQueryState'
import { montoEnTexto } from '@/app/admin/_polar/web/Orders/montos'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  COMPARADORES_CHECKOUT, PAGINA_POR_DEFECTO, esEstadoCheckout, filtrarCheckouts, ordenar, paginar,
  type CheckoutVenta, type EstadoCheckout,
} from '@/app/admin/_polar/datos/ventas'
import { DataTable, DataTableColumnDef, DataTableColumnHeader, Input, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ShoppingCart } from '@/app/admin/_polar/orbit/icons'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import React from 'react'

interface ClientPageProps {
  checkouts: CheckoutVenta[]
  avisos: string[]
}

const ClientPage: React.FC<ClientPageProps> = ({ checkouts, avisos }) => {
  const router = useRouter()

  const { pagination, setPagination, sorting, setSorting, params, setParams } = useDataTableQueryState({
    defaultSorting: [{ id: 'created_at', desc: true }],
    defaultPageSize: PAGINA_POR_DEFECTO,
  })

  const statusParam = params.get('status')
  const status: EstadoCheckout | null = esEstadoCheckout(statusParam) ? statusParam : null
  const query = params.get('query') ?? ''
  const [texto, setTexto] = useState(query)

  const onStatusSelect = (value: EstadoCheckout | null) => setParams({ status: value, page: null })

  // Polar espera medio segundo antes de buscar (`useDebouncedCallback`, 500 ms).
  useEffect(() => {
    if (texto === query) return
    const t = setTimeout(() => setParams({ query: texto || null, page: null }), 500)
    return () => clearTimeout(t)
  }, [texto, query, setParams])

  const filtrados = useMemo(() => filtrarCheckouts(checkouts, { estado: status, consulta: query }), [checkouts, status, query])
  const ordenados = useMemo(
    () => ordenar(filtrados, sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null, COMPARADORES_CHECKOUT),
    [filtrados, sorting],
  )
  const pagina = paginar(ordenados, pagination.pageIndex, pagination.pageSize)

  const columns: DataTableColumnDef<CheckoutVenta>[] = [
    {
      accessorKey: 'created_at',
      enableSorting: true,
      size: 160,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
      cell: ({ row: { original } }) => (
        <Text as="span" tabularNums>
          <FormattedDateTime locale="es-AR" datetime={original.createdAt} resolution="time" />
        </Text>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
      cell: ({ row: { original } }) => <CheckoutStatus checkout={original} />,
    },
    {
      id: 'customer',
      accessorKey: 'customer',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
      cell: ({ row: { original } }) => (
        <div className="flex flex-row items-center gap-2 overflow-hidden">
          {original.email || original.nombre ? (
            <div className="overflow-hidden text-ellipsis">
              {original.nombre || original.email}
              {original.nombre && original.email && (
                <span className="dark:text-polar-500 ml-2 text-gray-500">{original.email}</span>
              )}
            </div>
          ) : (
            <>—</>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'products',
      id: 'products',
      enableSorting: false,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
      cell: ({ row: { original } }) => (
        <Box as="span" display="inline-flex" alignItems="center" columnGap="s">
          {original.producto}
          <span className="dark:text-polar-500 text-gray-500">{montoEnTexto(original.monto, original.moneda, 'standard')}</span>
        </Box>
      ),
    },
  ]

  return (
    <DashboardBody wide>
      <div className="flex flex-col gap-8">
        <AvisosDeLectura avisos={avisos} />
        <div className="flex w-full flex-row items-center justify-between gap-2">
          <div className="grid w-full grid-cols-2 gap-4 sm:w-auto sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1">
              <Input type="text" placeholder="Filtrar por email" value={texto} onChange={(e) => setTexto(e.target.value)} />
            </div>
            <CheckoutStatusSelect value={status} onChange={onStatusSelect} />
          </div>
        </div>
        {checkouts.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart />}
            title="No hay links de pago sin pagar"
            description="Un link de pago que se vende desde MaKo aparece aquí mientras no se paga; pagado, pasa a Orders."
          />
        ) : (
          <DataTable
            columns={columns}
            data={pagina.filas}
            rowCount={pagina.total}
            pageCount={pagina.paginas}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={false}
            onRowClick={(row) => router.push(`/admin/sales/checkouts/${row.original.id}`)}
            getRowId={(row) => String(row.id)}
          />
        )}
      </div>
    </DashboardBody>
  )
}

export default ClientPage

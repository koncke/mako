'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/subscriptions/SubscriptionsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la vista es PURA (todo por props). Filtra, ordena y pagina en memoria con el estado en la URL, como Polar en su server.
// El estado arranca en «Activa», como `DEFAULT_SUBSCRIPTION_STATUS` de Polar. Lo que se sacó: el filtro por producto (una
// suscripción a mano no tiene producto del catálogo), el de «se corta al final del período» (MaKo no lo guarda), la etiqueta de
// versión del producto y las columnas de metadata.

import { useMemo } from 'react'
import { useRouter } from '@/app/_ui/Link'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { SubscriptionStatus as SubscriptionStatusComponent, fechaCorta } from '@/app/admin/_polar/web/Subscriptions/SubscriptionStatus'
import { ExportCsvModal } from '@/app/admin/_polar/web/Orders/ExportCsvModal'
import { AvisosDeLectura } from '@/app/admin/_polar/web/Orders/Aviso'
import { useDataTableQueryState } from '@/app/admin/_polar/web/Orders/useDataTableQueryState'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  COMPARADORES_SUSCRIPCION, ESTADOS_SUSCRIPCION, ESTADO_SUSCRIPCION_POR_DEFECTO, PAGINA_POR_DEFECTO,
  csvDeSuscripciones, fechaDeParams, filtrarSuscripciones, ordenar, paginar, paramsDeFecha, primerDia,
  type FechaElegida, type FiltroEstadoSuscripcion, type SuscripcionVenta,
} from '@/app/admin/_polar/datos/ventas'
import { Avatar, DataTable, DataTableColumnDef, DataTableColumnHeader, InlineModal, Status, Text } from '@/app/admin/_polar/orbit'
import { AllInclusiveOutlined } from '@/app/admin/_polar/orbit/icons'
import React from 'react'
import SubscriptionFilters from './SubscriptionFilters'

interface ClientPageProps {
  hoy: string
  suscripciones: SuscripcionVenta[]
  avisos: string[]
}

const esFiltro = (v: string | null): v is FiltroEstadoSuscripcion => v === 'any' || (ESTADOS_SUSCRIPCION as readonly string[]).includes(String(v))

const ClientPage: React.FC<ClientPageProps> = ({ hoy, suscripciones, avisos }) => {
  const router = useRouter()

  const { pagination, setPagination, sorting, setSorting, params, setParams } = useDataTableQueryState({
    defaultSorting: [{ id: 'started_at', desc: true }],
    defaultPageSize: PAGINA_POR_DEFECTO,
  })

  const statusParam = params.get('status')
  const status: FiltroEstadoSuscripcion = esFiltro(statusParam) ? statusParam : ESTADO_SUSCRIPCION_POR_DEFECTO
  const rangeParam = params.get('range')
  const fromParam = params.get('from')
  const toParam = params.get('to')
  const fecha = useMemo(() => fechaDeParams(rangeParam, fromParam, toParam), [rangeParam, fromParam, toParam])
  const desde = useMemo(() => primerDia(suscripciones.map((s) => s.empezo), hoy), [suscripciones, hoy])

  const onStatusSelect = (value: FiltroEstadoSuscripcion) => setParams({ status: value === ESTADO_SUSCRIPCION_POR_DEFECTO ? null : value, page: null })
  const onDateChange = (value: FechaElegida) => setParams({ ...paramsDeFecha(value), page: null })

  const filtradas = useMemo(() => filtrarSuscripciones(suscripciones, { estado: status, ...fecha }, hoy), [suscripciones, status, fecha, hoy])
  const ordenadas = useMemo(
    () => ordenar(filtradas, sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null, COMPARADORES_SUSCRIPCION),
    [filtradas, sorting],
  )
  const pagina = paginar(ordenadas, pagination.pageIndex, pagination.pageSize)

  const {
    isShown: isExportModalShown,
    show: showExportModal,
    hide: hideExportModal,
  } = useModal()

  // MaKo: la tabla es un `@container` y las columnas ceden por el ancho de SU caja (el `meta`, DataTable de orbit): a 390, con
  // las cinco de Polar sólo se veían Cliente y el Estado cortado. Angosta, el Cliente (con el producto debajo) y el Estado;
  // un poco más ancha vuelven Desde y Próxima; ancha, el Producto, como en Polar.
  const columns: DataTableColumnDef<SuscripcionVenta>[] = [
    {
      id: 'customer',
      accessorKey: 'customer',
      enableSorting: true,
      meta: { width: '28%' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" />,
      cell: ({ row: { original: subscription } }) => (
        <div className="flex min-w-0 flex-row items-center gap-2 overflow-hidden">
          <span className="hidden shrink-0 @md:inline-flex">
            <Avatar avatar_url={null} name={subscription.cliente.nombre || '—'} />
          </span>
          <div className="flex min-w-0 flex-col">
            <div className="truncate">{subscription.cliente.nombre || '—'}</div>
            <span className="dark:text-polar-500 truncate text-xs text-gray-500 @2xl:hidden">{subscription.producto ?? '—'}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      meta: { width: '22%' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" />,
      cell: ({ row: { original: subscription } }) => (
        <div className="[&>div]:flex-wrap [&>div]:gap-y-1">
          <SubscriptionStatusComponent subscription={subscription} />
        </div>
      ),
    },
    {
      accessorKey: 'started_at',
      enableSorting: true,
      meta: { width: '15%', className: 'hidden @xl:table-cell' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Desde" />,
      cell: ({ row: { original } }) => (original.empezo ? <Text as="span" tabularNums>{fechaCorta(original.empezo, hoy)}</Text> : '—'),
    },
    {
      accessorKey: 'current_period_end',
      enableSorting: true,
      meta: { width: '15%', className: 'hidden @xl:table-cell' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Próxima" />,
      cell: ({ row: { original } }) => (original.renovacion ? <Text as="span" tabularNums>{fechaCorta(original.renovacion, hoy)}</Text> : '—'),
    },
    {
      accessorKey: 'product',
      id: 'product',
      enableSorting: true,
      meta: { width: '20%', className: 'hidden @2xl:table-cell' },
      header: ({ column }) => <DataTableColumnHeader column={column} title="Producto" />,
      cell: ({ row: { original } }) => (
        <div className="flex flex-row items-center gap-2">
          {original.producto ?? '—'}
          {original.fuente === 'pasarela' && <Status status="Pasarela" color="blue" size="small" />}
        </div>
      ),
    },
  ]

  return (
    <DashboardBody wide>
      <div className="flex flex-col gap-8">
        <AvisosDeLectura avisos={avisos} />
        <SubscriptionFilters
          status={status}
          onStatusSelect={onStatusSelect}
          fecha={fecha}
          hoy={hoy}
          desde={desde}
          onDateChange={onDateChange}
          onExport={showExportModal}
        />
        {suscripciones.length === 0 ? (
          <EmptyState
            icon={<AllInclusiveOutlined fontSize="inherit" />}
            title="Todavía no hay suscripciones"
            description="Cuando un cliente de MaKo se suscribe (a mano en el CRM o por la pasarela), aparece aquí con su historia mes a mes."
          />
        ) : (
          <DataTable
            className="@container"
            columns={columns}
            data={pagina.filas}
            rowCount={pagina.total}
            pageCount={pagina.paginas}
            pagination={pagination}
            onPaginationChange={setPagination}
            sorting={sorting}
            onSortingChange={setSorting}
            isLoading={false}
            onRowClick={(row) => router.push(`/admin/sales/subscriptions/${row.original.id}`)}
            getRowId={(row) => row.id}
          />
        )}
      </div>
      <InlineModal
        isShown={isExportModalShown}
        hide={hideExportModal}
        modalContent={
          <ExportCsvModal
            title="Exportar suscripciones"
            description="Descarga tus suscripciones como un archivo CSV."
            csv={csvDeSuscripciones(ordenadas)}
            archivo={`suscripciones-${hoy}.csv`}
            hide={hideExportModal}
          />
        }
      />
    </DashboardBody>
  )
}

export default ClientPage

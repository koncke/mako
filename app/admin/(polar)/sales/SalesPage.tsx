'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/SalesPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la vista es PURA (todo llega por props, así se captura con datos de ejemplo). Lo que Polar filtra, ordena y pagina en su
// server se hace en memoria sobre lo que leyó el page.tsx, con el estado en la URL (useDataTableQueryState). Lo de Polar que MaKo
// no llena se sacó: el filtro por producto (un pago de MaKo no tiene producto del catálogo), la etiqueta de versión del producto y
// las columnas de metadata. Lo de MaKo que pidió Martín: «Cargar pago», al lado de «Export».

import { useMemo } from 'react'
import { useRouter } from '@/app/_ui/Link'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { MiniMetricChartBox } from '@/app/admin/_polar/web/Metrics/MiniMetricChartBox'
import { OrderStatus } from '@/app/admin/_polar/web/Orders/OrderStatus'
import { ExportCsvModal } from '@/app/admin/_polar/web/Orders/ExportCsvModal'
import { CargarPagoModal } from '@/app/admin/_polar/web/Orders/CargarPagoModal'
import { AvisosDeLectura } from '@/app/admin/_polar/web/Orders/Aviso'
import { useDataTableQueryState } from '@/app/admin/_polar/web/Orders/useDataTableQueryState'
import { usdEnTexto } from '@/app/admin/_polar/web/Orders/montos'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  COMPARADORES_PEDIDO, METRICA_AOV, METRICA_ORDERS, METRICA_REVENUE, PAGINA_POR_DEFECTO,
  esEstadoPedido, csvDePedidos, fechaDeParams, filtrarPedidos, medioEnTexto, ordenar, paginar, paramsDeFecha, primerDia, totalesDePedidos,
  type EstadoPedido, type FechaElegida, type Pedido,
} from '@/app/admin/_polar/datos/ventas'
import type { DatosCargarPago, EstadoLibro } from '@/app/admin/_polar/datos/ventas-server'
import { Avatar, DataTable, DataTableColumnDef, DataTableColumnHeader, InlineModal, Status, Text, Truncated } from '@/app/admin/_polar/orbit'
import { ShoppingBagOutlined } from '@/app/admin/_polar/orbit/icons'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import React from 'react'
import SalesFilters from './SalesFilters'

interface ClientPageProps {
  hoy: string
  pedidos: Pedido[]
  avisos: string[]
  libro: EstadoLibro
  cargarPago: DatosCargarPago | null
}

const ClientPage: React.FC<ClientPageProps> = ({ hoy, pedidos, avisos, libro, cargarPago }) => {
  const router = useRouter()

  const { pagination, setPagination, sorting, setSorting, params, setParams } =
    useDataTableQueryState({
      defaultSorting: [{ id: 'created_at', desc: true }],
      defaultPageSize: PAGINA_POR_DEFECTO,
    })

  const statusParam = params.get('status')
  const status: EstadoPedido | null = esEstadoPedido(statusParam) ? statusParam : null
  const rangeParam = params.get('range')
  const fromParam = params.get('from')
  const toParam = params.get('to')
  const fecha = useMemo(() => fechaDeParams(rangeParam, fromParam, toParam), [rangeParam, fromParam, toParam])
  const desde = useMemo(() => primerDia(pedidos.map((p) => p.fecha), hoy), [pedidos, hoy])

  const onStatusSelect = (value: EstadoPedido | null) => setParams({ status: value, page: null })
  const onDateChange = (value: FechaElegida) => setParams({ ...paramsDeFecha(value), page: null })

  const filtrados = useMemo(() => filtrarPedidos(pedidos, { estado: status, ...fecha }, hoy), [pedidos, status, fecha, hoy])
  const ordenados = useMemo(
    () => ordenar(filtrados, sorting[0] ? { id: sorting[0].id, desc: sorting[0].desc } : null, COMPARADORES_PEDIDO),
    [filtrados, sorting],
  )
  const pagina = paginar(ordenados, pagination.pageIndex, pagination.pageSize)
  const totales = totalesDePedidos(filtrados)

  // MaKo: la tabla es un `@container` y las columnas ceden por el ancho de SU caja (el `meta` de las columnas, DataTable de
  // orbit): con la tabla de Polar (cinco columnas de ancho fijo), a 390 sólo se veían Fecha y Cliente y el monto y el estado
  // quedaban detrás de un scroll lateral. Angosta, quedan el Cliente (con la fecha debajo) y el Monto (con el estado debajo);
  // un poco más ancha vuelve el Estado; ancha, todas, como en Polar.
  const fechaDelPedido = (order: Pedido) => <FormattedDateTime locale="es-AR" datetime={`${order.fecha}T12:00:00`} />
  const columns: DataTableColumnDef<Pedido>[] = [
    {
      accessorKey: 'created_at',
      enableSorting: true,
      size: 160,
      meta: { width: '17%', className: 'hidden @2xl:table-cell' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Fecha" />
      ),
      cell: ({ row: { original: order } }) => (
        <Text tabularNums>{fechaDelPedido(order)}</Text>
      ),
    },
    {
      accessorKey: 'customer',
      enableSorting: true,
      size: 200,
      meta: { width: '27%' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Cliente" />
      ),
      cell: ({ row: { original: order } }) => {
        const nombre = order.cliente?.nombre || '—'
        const aNombre =
          order.recibo && order.recibo.aNombre.toLocaleLowerCase() !== nombre.toLocaleLowerCase()
            ? order.recibo.aNombre
            : null
        return (
          <div className="flex min-w-0 flex-row items-center gap-2">
            <span className="hidden shrink-0 @md:inline-flex">
              <Avatar className="h-8 w-8" avatar_url={null} name={nombre} />
            </span>
            <div className="flex min-w-0 flex-col">
              <Truncated>
                <Text as="span">
                  {nombre}
                  {aNombre && (
                    <span className="dark:text-polar-500 ml-2 text-gray-500">
                      {aNombre}
                    </span>
                  )}
                </Text>
              </Truncated>
              <span className="dark:text-polar-500 text-xs text-gray-500 tabular-nums @2xl:hidden">{fechaDelPedido(order)}</span>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'product',
      enableSorting: false,
      size: 200,
      meta: { width: '22%', className: 'hidden @2xl:table-cell' },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Concepto"
          className="font-[550] text-black dark:text-white"
        />
      ),
      cell: ({ row: { original: order } }) => (
        <div className="flex flex-row items-center gap-2">
          <Truncated>
            <Text as="span">{order.concepto || medioEnTexto(order.medio)}</Text>
          </Truncated>
          {order.recurrente && <Status status="Suscripción" color="blue" size="small" />}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      enableSorting: true,
      size: 140,
      meta: { width: '14%', className: 'hidden @md:table-cell' },
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Estado" />
      ),
      cell: ({ row: { original: order } }) => (
        <OrderStatus status={order.estado} />
      ),
    },
    {
      accessorKey: 'net_amount',
      enableSorting: true,
      size: 80,
      meta: { width: '20%', className: 'whitespace-nowrap' },
      header: ({ column }) => (
        <DataTableColumnHeader
          column={column}
          title="Monto"
          className="flex justify-end"
        />
      ),
      cell: ({ row: { original: order } }) => (
        <div className="flex flex-col items-end gap-1">
          <Text tabularNums>{usdEnTexto(order.usd)}</Text>
          <span className="@md:hidden">
            <OrderStatus status={order.estado} size="small" />
          </span>
        </div>
      ),
    },
  ]

  const {
    isShown: isExportModalShown,
    show: showExportModal,
    hide: hideExportModal,
  } = useModal()
  const {
    isShown: isCargarShown,
    show: showCargar,
    hide: hideCargar,
  } = useModal()

  return (
    <DashboardBody wide>
      <div className="flex flex-col gap-8">
        <AvisosDeLectura avisos={avisos} />
        <SalesFilters
          status={status}
          onStatusSelect={onStatusSelect}
          fecha={fecha}
          hoy={hoy}
          desde={desde}
          onDateChange={onDateChange}
          onExport={showExportModal}
          onCargarPago={cargarPago ? showCargar : undefined}
          libro={libro}
        />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <MiniMetricChartBox value={totales.orders} metric={METRICA_ORDERS} />
          <MiniMetricChartBox value={totales.revenue} metric={METRICA_REVENUE} />
          <MiniMetricChartBox value={totales.averageOrderValue} metric={METRICA_AOV} />
        </div>
        {pedidos.length === 0 ? (
          <EmptyState
            icon={<ShoppingBagOutlined fontSize="inherit" />}
            title="Todavía no entró ningún pago"
            description="Cuando entre un pago (por la pasarela o cargado a mano), aparece aquí con su recibo."
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
            onRowClick={(row) => router.push(`/admin/sales/${row.original.id}`)}
            getRowId={(row) => row.id}
          />
        )}
        {totales.sinDolares > 0 && (
          <Text color="muted">
            {totales.sinDolares === 1
              ? '1 pago no tiene su valor en dólares: no suma en los totales.'
              : `${totales.sinDolares} pagos no tienen su valor en dólares: no suman en los totales.`}
          </Text>
        )}
      </div>
      <InlineModal
        isShown={isExportModalShown}
        hide={hideExportModal}
        modalContent={
          <ExportCsvModal
            title="Exportar pedidos"
            description="Descarga tus pedidos como un archivo CSV."
            csv={csvDePedidos(ordenados)}
            archivo={`pedidos-${hoy}.csv`}
            hide={hideExportModal}
          />
        }
      />
      {cargarPago && (
        <InlineModal
          isShown={isCargarShown}
          hide={hideCargar}
          modalContent={<CargarPagoModal cuentas={cargarPago.cuentas} planes={cargarPago.planes} hoy={hoy} hide={hideCargar} />}
        />
      )}
    </DashboardBody>
  )
}

export default ClientPage

'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/finance/(wide)/income/IncomePage.tsx
// y de su layout.tsx (el DashboardBody con el «Export» en la cabecera). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El LIBRO de la plata de MaKo (TransactionsList de Polar): los pedidos de Sales › Orders con lo que entró, lo devuelto y lo que
// quedó, ordenado por fecha y de a 50, como Polar (`useDataTableQueryState` con `created_at` desc y 50 por página). Cada fila abre
// su pedido. Arriba, lo que entró este mes, con la misma cuenta que las cajas de Orders (revisión del Cerebro del 6/11/2026,
// punto 26: antes era la lista de Orders otra vez, con otros números y sin abrir nada). Lo que Polar pide paginado a su API
// (`useSearchTransactions`) llega entero del server y se ordena y se pagina en memoria (app/admin/_polar/datos/finanzas.ts).
// ⚠️ ACÁ NO VA EL GRÁFICO de ingresos (Martín, 6/11/2026): vive sólo en Overview y en Analytics › Metrics.
// ⚠️ Sin la cuenta de payouts de Polar (`useOrganizationAccount`, la demora de los pagos): MaKo no tiene payouts.

import TransactionsList from '@/app/admin/_polar/web/Transactions/TransactionsList'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { AvisosDeLectura } from '@/app/admin/_polar/web/Customer/AvisosDeLectura'
import { Card, CardContent, CardHeader } from '@/app/admin/_polar/atoms/Card'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { Alert } from '@/app/admin/_polar/orbit'
import type { DataTablePaginationState, DataTableSortingState } from '@/app/admin/_polar/orbit'
import { AttachMoneyOutlined } from '@/app/admin/_polar/orbit/icons'
import { useRouter } from '@/app/_ui/Link'
import { useMemo, useState } from 'react'
import { ordenarIngresos, paginar, type DatosIngresos } from '@/app/admin/_polar/datos/finanzas'
import { IncomePageHeader } from './IncomePageHeader'

export default function ClientPage({ datos }: { datos: DatosIngresos }) {
  const router = useRouter()
  const [pagination, setPagination] = useState<DataTablePaginationState>({ pageIndex: 0, pageSize: 50 })
  const [sorting, setSorting] = useState<DataTableSortingState>([{ id: 'created_at', desc: true }])

  const filas = useMemo(() => (datos.ok ? datos.filas : []), [datos])
  const pagina = useMemo(() => {
    const desc = sorting[0]?.id === 'created_at' ? sorting[0].desc : true
    return paginar(ordenarIngresos(filas, desc), pagination.pageIndex, pagination.pageSize)
  }, [filas, sorting, pagination])

  return (
    <DashboardBody
      wrapperClassName="gap-4"
      header={datos.ok && filas.length > 0 ? <IncomePageHeader filas={filas} hoy={datos.hoy} className="hidden md:flex" /> : undefined}
      titleActions={datos.ok && filas.length > 0 ? <IncomePageHeader filas={filas} hoy={datos.hoy} /> : undefined}
    >
      {!datos.ok ? (
        // Una lectura que falló va como todas las de Admin (punto 42): `warning` con «Reportar a Soporte», nunca como un vacío.
        <Alert variant="warning" soporte title="No pude leer lo que entró" description={datos.error} />
      ) : (
        <div className="flex flex-col gap-4">
          <AvisosDeLectura avisos={datos.avisos} />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <span className="dark:text-polar-500 text-gray-500">Este mes</span>
              </CardHeader>
              <CardContent>
                <h3 className="text-2xl">{formatCurrency('statistics')(datos.esteMes, 'usd')}</h3>
              </CardContent>
            </Card>
          </div>
          {filas.length === 0 ? (
            <EmptyState icon={<AttachMoneyOutlined />} title="Todavía no entró nada" description="Cuando alguien pague un plan, el pago aparece aquí." />
          ) : (
            <TransactionsList
              transactions={pagina.items}
              rowCount={pagina.rowCount}
              pageCount={pagina.pageCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              sorting={sorting}
              onSortingChange={setSorting}
              isLoading={false}
              onRowClick={(id) => router.push(`/admin/sales/${id}`)}
            />
          )}
        </div>
      )}
    </DashboardBody>
  )
}

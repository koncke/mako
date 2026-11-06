'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/finance/(wide)/income/IncomePage.tsx
// y de su layout.tsx (el DashboardBody con el «Export» en la cabecera). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El LIBRO de movimientos de plata (TransactionsList de Polar: su `useSearchTransactions({ type: 'balance' })`): lo que entró y
// lo que salió, un renglón por movimiento, ordenado por fecha y de a 50, como Polar (`useDataTableQueryState` con `created_at`
// desc y 50 por página). Lo que Polar pide paginado a su API llega entero del server y se ordena y se pagina en memoria
// (app/admin/_polar/datos/finanzas.ts). No es la lista de pedidos: el estado de un pedido y su recibo viven en Sales › Orders,
// y cada movimiento lleva a su pedido.
// ⚠️ ACÁ NO VA EL GRÁFICO de ingresos (Martín, 6/11/2026): vive sólo en Overview y en Analytics › Metrics.
// ⚠️ Sin la cuenta de payouts de Polar (`useOrganizationAccount`, la demora de los pagos): MaKo no tiene payouts.

import TransactionsList from '@/app/admin/_polar/web/Transactions/TransactionsList'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { Alert } from '@/app/admin/_polar/orbit'
import type { DataTablePaginationState, DataTableSortingState } from '@/app/admin/_polar/orbit'
import { AttachMoneyOutlined } from '@/app/admin/_polar/orbit/icons'
import { useMemo, useState } from 'react'
import { ordenarIngresos, paginar, type DatosIngresos } from '@/app/admin/_polar/datos/finanzas'
import { IncomePageHeader } from './IncomePageHeader'

export default function ClientPage({ datos }: { datos: DatosIngresos }) {
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
        <Alert variant="danger" soporte title="No pude leer los movimientos" description={datos.error} />
      ) : (
        <div className="flex flex-col gap-4">
          {datos.avisos.length > 0 && (
            <Alert variant="warning" soporte title="El libro puede quedarse corto" description={`No pude leer ${datos.avisos.join('; ')}.`} />
          )}
          {filas.length === 0 ? (
            <EmptyState icon={<AttachMoneyOutlined />} title="Todavía no entró nada" description="Cuando alguien pague un plan, el pago aparece aquí; si se devuelve, también lo que salió." />
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
            />
          )}
        </div>
      )}
    </DashboardBody>
  )
}

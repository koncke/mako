'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Transactions/ExportTransactionsModal.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El «Export income» de Polar con los movimientos de plata de MaKo: las mismas filas de la lista (lo que entró y lo que salió),
// filtradas por el rango, con las columnas que se eligen. El texto lo arma `armarCsv` (lib/csv-celda.ts, la única vía de un CSV
// en MaKo: neutraliza lo que arranca como fórmula) y se baja en el navegador; Polar se lo pide a su API (`/v1/transactions/export`).
// El «Order ID» de Polar es «Pedido»: el pedido de Sales › Orders de cada movimiento.
// ⚠️ LO QUE SE SACÓ: las columnas que MaKo no guarda por movimiento (estado, «paid out at», número de factura, comisiones,
//    impuesto, neto) y el aviso de «sin cuenta de finanzas» (MaKo no tiene una).

import { armarCsv } from '@/lib/csv-celda'
import { format } from 'date-fns'
import React from 'react'
import { celdasDeExportacion, COLUMNAS_POR_DEFECTO, GRUPOS_EXPORTACION, type ColumnaIngreso, type MovimientoIngreso } from '@/app/admin/_polar/datos/finanzas'
import { ExportModal } from './ExportModal'
import { downloadExport } from './exportUtils'

interface ExportTransactionsModalProps {
  filas: MovimientoIngreso[]
  /** El día de hoy de la plataforma (si no hay filas, el rango arranca ahí). */
  hoy: string
  isShown: boolean
  hide: () => void
}

const ExportTransactionsModal: React.FC<ExportTransactionsModalProps> = ({ filas, hoy, isShown, hide }) => {
  // Desde el primer movimiento (en Polar, desde que se creó la organización).
  const desde = filas.reduce((min, f) => (f.fecha < min ? f.fecha : min), hoy)
  return (
    <ExportModal<ColumnaIngreso>
      start={`${desde}T00:00:00`}
      title="Exportar los movimientos"
      description="Descarga lo que entró y lo que salió de MaKo como un archivo CSV."
      dateRangeLabel="Fechas"
      columns={GRUPOS_EXPORTACION}
      defaultColumns={COLUMNAS_POR_DEFECTO}
      onExport={(selection) => {
        const rango = { desde: format(selection.dateRange.from, 'yyyy-MM-dd'), hasta: format(selection.dateRange.to, 'yyyy-MM-dd') }
        const texto = armarCsv(celdasDeExportacion(filas, selection.columns, rango))
        downloadExport(new Blob([texto], { type: 'text/csv;charset=utf-8' }), `mako-movimientos-${rango.desde}-a-${rango.hasta}.csv`)
      }}
      isShown={isShown}
      hide={hide}
    />
  )
}

export default ExportTransactionsModal

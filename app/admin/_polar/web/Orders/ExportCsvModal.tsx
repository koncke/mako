'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Orders/ExportOrdersModal.tsx (y su gemelo de
// Subscriptions). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: Polar arma el CSV en su server (`/v1/orders/export`) con las columnas que elige la persona; acá las filas ya están en la
// página (las del filtro), así que el CSV llega armado de app/admin/_polar/datos/ventas.ts (`csvDePedidos`, `csvDeSuscripciones`,
// por lib/csv-celda.ts: lo que arranca como fórmula se neutraliza) y este modal sólo lo baja. Sin elegir columnas: van todas.

import { Button, InlineModalHeader, Text } from '@/app/admin/_polar/orbit'
import type { ArchivoCsv } from '@/app/admin/_polar/datos/ventas'

export const ExportCsvModal = ({
  title,
  description,
  csv,
  archivo,
  hide,
}: {
  title: string
  description: string
  /** El archivo armado (ventas.ts) y cuántas filas lleva. */
  csv: ArchivoCsv
  archivo: string
  hide: () => void
}) => {
  const bajar = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv.texto], { type: 'text/csv;charset=utf-8' }))
    a.download = archivo
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    hide()
  }
  const n = csv.filas
  return (
    <div className="flex flex-col">
      <InlineModalHeader hide={hide}>
        <h2>{title}</h2>
      </InlineModalHeader>
      <div className="flex flex-col gap-y-6 px-8 pb-8">
        <Text color="muted">{description}</Text>
        <Text>{n === 1 ? 'Va 1 fila, la del filtro de la tabla.' : `Van ${n} filas, las del filtro de la tabla.`}</Text>
        <div className="flex flex-row gap-x-4">
          <Button onClick={bajar} disabled={n === 0}>Exportar</Button>
          <Button variant="ghost" onClick={hide}>No cambiar nada</Button>
        </div>
      </div>
    </div>
  )
}

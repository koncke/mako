'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Orders/ExportOrdersModal.tsx (y su gemelo de
// Subscriptions). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: Polar arma el CSV en su server (`/v1/orders/export`) con las columnas que elige la persona; acá las filas ya están en la
// página (las del filtro), así que el CSV se arma en el navegador con lib/csv-celda.ts (lo que arranca como fórmula se neutraliza:
// un nombre o un concepto lo escribió otra persona). Sin elegir columnas: van todas las de la tabla.

import { armarCsv } from '@/lib/csv-celda'
import { Button, InlineModalHeader, Text } from '@/app/admin/_polar/orbit'

export const ExportCsvModal = ({
  title,
  description,
  filas,
  archivo,
  hide,
}: {
  title: string
  description: string
  filas: ReadonlyArray<ReadonlyArray<string | number | null>>
  archivo: string
  hide: () => void
}) => {
  const bajar = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([armarCsv(filas)], { type: 'text/csv;charset=utf-8' }))
    a.download = archivo
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    hide()
  }
  const n = Math.max(0, filas.length - 1)
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

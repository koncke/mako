// Bajar un CSV desde una tabla de Admin (el botón «Export» de Studio Admin, que en Studio no hace nada).
// Cada celda pasa por `armarCsv` (lib/csv-celda.ts): un nombre que arranca con «=» no se vuelve una fórmula en Excel
// (tests/csv-una-sola-via.test.ts).

import { armarCsv } from "@/lib/csv-celda"

export function bajarCsv(nombre: string, filas: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>) {
  const blob = new Blob([armarCsv(filas)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

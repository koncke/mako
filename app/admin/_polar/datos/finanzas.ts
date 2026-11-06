// =============================================================================
// Admin › Finance › Income — el libro de lo que entró a MaKo, como la lista de transacciones de Polar
// =============================================================================
// Puro y SIN `server-only`: lo usan la vista (IncomePage, TransactionsList, el «Export») y tests/admin-polar-productos.test.ts,
// que EJECUTA estas funciones. La lectura vive en finanzas-server.ts.
//
// De dónde sale: `vistaDeIngresos().entradas` (lib/admin-ingresos.ts → lib/admin-ingresos-reglas.ts, `entradasDe`): un
// renglón por pago que entró, con su fecha (el día, sin hora), su valor en dólares (null = no lo tiene: no suma), el medio,
// si es de una suscripción y de quién es. Es la MISMA lista con la que Overview y Analytics › Metrics arman sus gráficos.
//
// ⚠️ ACÁ VA LA LISTA, NUNCA UN GRÁFICO (Martín, 6/11/2026): el gráfico de ingresos vive sólo en Overview y en Analytics › Metrics.
// ⚠️ LO QUE POLAR TIENE Y MaKo NO: la comisión de Polar (Fees), el impuesto (Tax), el neto (Net), el estado del payout
//    (Status: disponible / pagado), la hora de cada transacción y el tipo de cambio de la moneda de cobro. Se sacan: MaKo no
//    los guarda por pago.
// =============================================================================

import type { Entrada } from '@/lib/admin-ingresos-reglas'
import { NOMBRE_PASARELA, esPasarela } from '@/lib/cobros-tipos'

/** Una fila de la lista: una entrada con un id estable (su lugar en el libro, del más viejo al más nuevo). */
export type FilaIngreso = Entrada & { id: string }

/** Lo que lee el server (finanzas-server.ts → `leerIngresos`). `hoy` es el día de la plataforma; `avisos`, lo que no se leyó. */
export type DatosIngresos =
  | { ok: true; filas: FilaIngreso[]; hoy: string; avisos: string[] }
  | { ok: false; error: string }

/** Las entradas, numeradas en el orden en que llegan (`entradasDe` las da del más viejo al más nuevo). */
export const filasDeIngresos = (entradas: readonly Entrada[]): FilaIngreso[] => entradas.map((e, i) => ({ ...e, id: `i${i}` }))

/** El orden de la columna «Date» (la única que ordena, como en Polar). Por defecto, el más nuevo primero. */
export function ordenarIngresos(filas: readonly FilaIngreso[], desc = true): FilaIngreso[] {
  const s = desc ? -1 : 1
  return [...filas].sort((a, b) => s * (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : Number(a.id.slice(1)) - Number(b.id.slice(1))))
}

/** La página `pageIndex` (desde 0) de `pageSize`, con lo que el DataTable de Polar pide (`rowCount`, `pageCount`). */
export function paginar<T>(filas: readonly T[], pageIndex: number, pageSize: number): { items: T[]; rowCount: number; pageCount: number } {
  const size = Math.max(1, Math.floor(pageSize) || 1)
  const pageCount = Math.max(1, Math.ceil(filas.length / size))
  const i = Math.min(Math.max(0, Math.floor(pageIndex) || 0), pageCount - 1)
  return { items: filas.slice(i * size, (i + 1) * size), rowCount: filas.length, pageCount }
}

/** El «type» de una transacción de Polar (`Subscription` / `Purchase`), traducido. */
export const tipoDeIngreso = (f: Pick<Entrada, 'recurrente'>): string => (f.recurrente ? 'Suscripción' : 'Compra')

/** Por dónde entró: el nombre de la pasarela si es una, o el medio como se guardó («transferencia», «binance»…). */
export function medioDeIngreso(medio: string | null | undefined): string {
  const m = String(medio ?? '').trim()
  if (!m) return 'Sin medio'
  if (esPasarela(m)) return NOMBRE_PASARELA[m]
  return m.charAt(0).toUpperCase() + m.slice(1)
}

// ─── El «Export» ───────────────────────────────────────────────────────────

/** Las columnas que MaKo puede exportar, con los grupos del «Export income» de Polar. */
export type ColumnaIngreso = 'created_at' | 'type' | 'customer' | 'method' | 'gross_amount' | 'currency'

export const GRUPOS_EXPORTACION = [
  {
    label: 'Transacción',
    columns: [
      { value: 'created_at', label: 'Fecha' },
      { value: 'type', label: 'Tipo' },
      { value: 'customer', label: 'De quién' },
      { value: 'method', label: 'Medio' },
    ],
  },
  {
    label: 'Montos',
    columns: [
      { value: 'gross_amount', label: 'Monto' },
      { value: 'currency', label: 'Moneda' },
    ],
  },
] as const satisfies readonly { label: string; columns: readonly { value: ColumnaIngreso; label: string }[] }[]

export const COLUMNAS_POR_DEFECTO: ColumnaIngreso[] = ['created_at', 'type', 'customer', 'method', 'gross_amount', 'currency']

const ROTULO: Record<ColumnaIngreso, string> = Object.fromEntries(
  GRUPOS_EXPORTACION.flatMap((g) => g.columns.map((c) => [c.value, c.label])),
) as Record<ColumnaIngreso, string>

/** Las filas cuyo día cae en el rango (los dos extremos adentro, `AAAA-MM-DD`). */
export const enElRango = (filas: readonly FilaIngreso[], desde: string, hasta: string): FilaIngreso[] =>
  filas.filter((f) => f.fecha >= desde && f.fecha <= hasta)

/**
 * Las celdas del archivo: el encabezado y un renglón por pago del rango, del más viejo al más nuevo, con las columnas en
 * el orden de los grupos. El texto lo arma quien baja el archivo con `armarCsv` (lib/csv-celda.ts), que neutraliza lo que
 * arranca como fórmula: un nombre que escribió otro puede empezar con «=». El monto va como número (dólares con centavos);
 * sin su valor en dólares, vacío.
 */
export function celdasDeExportacion(filas: readonly FilaIngreso[], columnas: readonly ColumnaIngreso[], rango: { desde: string; hasta: string }): Array<Array<string | number | null>> {
  const orden = COLUMNAS_POR_DEFECTO.filter((c) => columnas.includes(c))
  const valor = (f: FilaIngreso, c: ColumnaIngreso): string | number | null => {
    switch (c) {
      case 'created_at':
        return f.fecha
      case 'type':
        return tipoDeIngreso(f)
      case 'customer':
        return f.nombre
      case 'method':
        return medioDeIngreso(f.medio)
      case 'gross_amount':
        return f.usd == null ? null : Math.round(f.usd * 100) / 100
      case 'currency':
        return f.usd == null ? null : 'USD'
    }
  }
  const cuerpo = ordenarIngresos(enElRango(filas, rango.desde, rango.hasta), false).map((f) => orden.map((c) => valor(f, c)))
  return [orden.map((c) => ROTULO[c]), ...cuerpo]
}

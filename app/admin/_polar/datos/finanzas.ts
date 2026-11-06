// =============================================================================
// Admin › Finance › Income — el LIBRO de la plata de MaKo, como la lista de transacciones de Polar
// =============================================================================
// Puro y SIN `server-only`: lo usan la vista (IncomePage, TransactionsList, el «Export») y tests/admin-polar-productos.test.ts,
// que EJECUTA estas funciones. La lectura vive en finanzas-server.ts.
//
// ⚠️ DE DÓNDE SALE (revisión del Cerebro del 6/11/2026, punto 26): de los MISMOS pedidos y totales de Admin › Sales › Orders
// (`vistaOrders`, ./ventas-server.ts). Antes salía de `vistaDeIngresos().entradas` y era Orders otra vez pero peor: no abría el
// pago, no decía si se devolvió o se anuló, no traía los cargados a mano, y daba otros números que Orders. Ahora cada fila es un
// pedido (con su id, y abre su detalle), con lo que entró (Bruto), lo devuelto y lo que quedó (Neto); arriba, lo que entró este
// mes con la misma cuenta que las cajas de Orders (`totalesDePedidos`).
//
// ⚠️ ACÁ VA LA LISTA, NUNCA UN GRÁFICO (Martín, 6/11/2026): el gráfico de ingresos vive sólo en Overview y en Analytics › Metrics.
// ⚠️ LO QUE POLAR TIENE Y MaKo NO: la comisión de Polar (Fees), el impuesto (Tax), el estado del payout (disponible / pagado), la
//    hora de cada transacción y el tipo de cambio de la moneda de cobro. MaKo no los guarda por pago. Sin filtro: Polar no lo tiene.
// =============================================================================

import { NOMBRE_PASARELA, esPasarela } from '@/lib/cobros-tipos'
import { ROTULO_ESTADO_PEDIDO, filtrarPedidos, motivoDePedido, totalesDePedidos, type EstadoPedido, type Pedido } from './ventas'

const r2 = (n: number) => Math.round(n * 100) / 100
/** Las monedas que valen un dólar: lo devuelto en ellas se lee en dólares (nunca se pone una tasa a otra). */
const EN_DOLARES = new Set(['USD', 'USDT', 'USDC'])

/** Una fila del libro: un pedido de Orders, con lo que entró, lo devuelto y lo que quedó, en dólares. */
export type FilaIngreso = {
  /** El id del pedido (`p-12`, `c-34`, `r-5`): el de su detalle en Sales. */
  id: string
  /** Su lugar en el libro, del más viejo (0) al más nuevo: desempata dos pagos del mismo día. */
  n: number
  /** YYYY-MM-DD, el día que entró. */
  fecha: string
  /** «Suscripción», «Pago único» o «Cargado a mano» (lo mismo que dice Orders, `motivoDePedido`). */
  tipo: string
  nombre: string
  medio: string | null
  estado: EstadoPedido
  /** `false` = un recibo cargado a mano sin atar al CRM: no suma (como en Orders). */
  suma: boolean
  /** Lo que entró. null = sin su valor en dólares. */
  brutoUsd: number | null
  /** Lo devuelto: 0 si no se devolvió nada; null si no se sabe en dólares (o el pedido se anuló). */
  devueltoUsd: number | null
  /** Lo que quedó (bruto − devuelto). 0 si se anuló; null si no se sabe, o si no suma. */
  netoUsd: number | null
}

/** Lo que lee el server (finanzas-server.ts → `leerIngresos`). `hoy` es el día de la plataforma; `avisos`, lo que no se leyó. */
export type DatosIngresos =
  | {
    ok: true; filas: FilaIngreso[]; hoy: string; avisos: string[]
    /** Lo que entró este mes, en CENTAVOS: la caja «Ingresos» de Orders con «Este mes». */
    esteMes: number
  }
  | { ok: false; error: string }

function devueltoDe(p: Pedido): number | null {
  if (p.estado === 'paid') return 0
  if (p.estado === 'refunded') return p.usd
  if (p.estado === 'partially_refunded') {
    const r = p.recibo
    return r?.devueltoMonto != null && EN_DOLARES.has(r.monedaDetalle) ? r2(r.devueltoMonto) : null
  }
  return null
}

/** Las filas del libro, de los pedidos de Orders (en cualquier orden): el más nuevo primero, como llegan. */
export function filasDeIngresos(pedidos: readonly Pedido[]): FilaIngreso[] {
  const viejoPrimero = [...pedidos].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.id.localeCompare(b.id)))
  return viejoPrimero.map((p, n) => {
    const suma = p.suma !== false
    const devueltoUsd = devueltoDe(p)
    const netoUsd = !suma ? null : p.estado === 'void' ? 0 : p.usd == null || devueltoUsd == null ? null : r2(p.usd - devueltoUsd)
    return {
      id: p.id, n, fecha: p.fecha, tipo: motivoDePedido(p), nombre: p.cliente?.nombre ?? '—', medio: p.medio, estado: p.estado, suma,
      brutoUsd: p.usd, devueltoUsd, netoUsd,
    }
  }).reverse()
}

/** Lo que dibuja Income con los pedidos de Orders: las filas y lo que entró este mes (la misma cuenta que Orders). */
export function datosDelLibro(pedidos: readonly Pedido[], hoy: string, avisos: string[]): DatosIngresos {
  const esteMes = totalesDePedidos(filtrarPedidos(pedidos, { estado: null, intervalo: 'thisMonth' }, hoy)).revenue
  return { ok: true, filas: filasDeIngresos(pedidos), hoy, avisos, esteMes }
}

/** El orden de la columna «Fecha» (la única que ordena, como en Polar). Por defecto, el más nuevo primero. */
export function ordenarIngresos(filas: readonly FilaIngreso[], desc = true): FilaIngreso[] {
  const s = desc ? -1 : 1
  return [...filas].sort((a, b) => s * (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.n - b.n))
}

/** La página `pageIndex` (desde 0) de `pageSize`, con lo que el DataTable de Polar pide (`rowCount`, `pageCount`). */
export function paginar<T>(filas: readonly T[], pageIndex: number, pageSize: number): { items: T[]; rowCount: number; pageCount: number } {
  const size = Math.max(1, Math.floor(pageSize) || 1)
  const pageCount = Math.max(1, Math.ceil(filas.length / size))
  const i = Math.min(Math.max(0, Math.floor(pageIndex) || 0), pageCount - 1)
  return { items: filas.slice(i * size, (i + 1) * size), rowCount: filas.length, pageCount }
}

/** Por dónde entró: el nombre de la pasarela si es una, o el medio como se guardó («transferencia», «binance»…). */
export function medioDeIngreso(medio: string | null | undefined): string {
  const m = String(medio ?? '').trim()
  if (!m) return 'Sin medio'
  if (esPasarela(m)) return NOMBRE_PASARELA[m]
  return m.charAt(0).toUpperCase() + m.slice(1)
}

/** Lo que dice la fila al lado del tipo, si no es un pago que entró y quedó: «Devuelto», «Anulado», «No suma». */
export function marcaDeFila(f: Pick<FilaIngreso, 'estado' | 'suma'>): string | null {
  if (!f.suma) return 'No suma'
  return f.estado === 'paid' ? null : ROTULO_ESTADO_PEDIDO[f.estado]
}

// ─── El «Export» ───────────────────────────────────────────────────────────

/** Las columnas que MaKo puede exportar, con los grupos del «Export income» de Polar. */
export type ColumnaIngreso = 'created_at' | 'type' | 'customer' | 'method' | 'status' | 'gross_amount' | 'refunded_amount' | 'net_amount' | 'currency'

export const GRUPOS_EXPORTACION = [
  {
    label: 'Transacción',
    columns: [
      { value: 'created_at', label: 'Fecha' },
      { value: 'type', label: 'Tipo' },
      { value: 'customer', label: 'De quién' },
      { value: 'method', label: 'Medio' },
      { value: 'status', label: 'Estado' },
    ],
  },
  {
    label: 'Montos',
    columns: [
      { value: 'gross_amount', label: 'Bruto' },
      { value: 'refunded_amount', label: 'Devuelto' },
      { value: 'net_amount', label: 'Neto' },
      { value: 'currency', label: 'Moneda' },
    ],
  },
] as const satisfies readonly { label: string; columns: readonly { value: ColumnaIngreso; label: string }[] }[]

export const COLUMNAS_POR_DEFECTO: ColumnaIngreso[] = ['created_at', 'type', 'customer', 'method', 'status', 'gross_amount', 'refunded_amount', 'net_amount', 'currency']

const ROTULO: Record<ColumnaIngreso, string> = Object.fromEntries(
  GRUPOS_EXPORTACION.flatMap((g) => g.columns.map((c) => [c.value, c.label])),
) as Record<ColumnaIngreso, string>

/** Las filas cuyo día cae en el rango (los dos extremos adentro, `AAAA-MM-DD`). */
export const enElRango = (filas: readonly FilaIngreso[], desde: string, hasta: string): FilaIngreso[] =>
  filas.filter((f) => f.fecha >= desde && f.fecha <= hasta)

/**
 * Las celdas del archivo: el encabezado y un renglón por pedido del rango, del más viejo al más nuevo, con las columnas en el
 * orden de los grupos. El texto lo arma quien baja el archivo con `armarCsv` (lib/csv-celda.ts), que neutraliza lo que arranca
 * como fórmula: un nombre que escribió otro puede empezar con «=». Los montos van como número (dólares con centavos); sin su
 * valor en dólares, vacío.
 */
export function celdasDeExportacion(filas: readonly FilaIngreso[], columnas: readonly ColumnaIngreso[], rango: { desde: string; hasta: string }): Array<Array<string | number | null>> {
  const orden = COLUMNAS_POR_DEFECTO.filter((c) => columnas.includes(c))
  const valor = (f: FilaIngreso, c: ColumnaIngreso): string | number | null => {
    switch (c) {
      case 'created_at':
        return f.fecha
      case 'type':
        return f.tipo
      case 'customer':
        return f.nombre
      case 'method':
        return medioDeIngreso(f.medio)
      case 'status':
        return marcaDeFila(f) ?? ROTULO_ESTADO_PEDIDO[f.estado]
      case 'gross_amount':
        return f.brutoUsd == null ? null : r2(f.brutoUsd)
      case 'refunded_amount':
        return f.devueltoUsd == null ? null : r2(f.devueltoUsd)
      case 'net_amount':
        return f.netoUsd == null ? null : r2(f.netoUsd)
      case 'currency':
        return f.brutoUsd == null ? null : 'USD'
    }
  }
  const cuerpo = ordenarIngresos(enElRango(filas, rango.desde, rango.hasta), false).map((f) => orden.map((c) => valor(f, c)))
  return [orden.map((c) => ROTULO[c]), ...cuerpo]
}

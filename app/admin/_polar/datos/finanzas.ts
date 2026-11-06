// =============================================================================
// Admin › Finance › Income — el LIBRO de movimientos de plata de MaKo, como la lista de transacciones de Polar
// =============================================================================
// Puro y SIN `server-only`: lo usan la vista (IncomePage, TransactionsList, el «Exportar») y los tests
// (tests/admin-polar-productos.test.ts y tests/admin-polar-arreglos-3.test.ts), que EJECUTAN estas funciones. La lectura vive
// en finanzas-server.ts.
//
// QUÉ ES (revisión del 6/11/2026): Income de Polar (`finance/(wide)/income`, components/Transactions/TransactionsList) NO es la
// lista de pedidos: es el libro de la cuenta (`useSearchTransactions({ type: 'balance' })`). Cada movimiento de plata es una
// fila: un pago ENTRA (monto positivo, el día que entró), una devolución SALE (monto negativo, el día que se devolvió), y un
// cobro anulado no es un movimiento (la plata nunca se movió). El estado del pedido y su recibo NO van acá: son de Sales ›
// Orders, y cada movimiento lleva a su pedido (el «Order» de Polar: su `order_id`).
//
// De dónde sale: los pedidos de Sales › Orders (`vistaOrders`, ventas-server.ts → `pedidosDe`: cada pago que entró, con su
// recibo, y los recibos de «Cargar pago»). De cada uno se toma lo que dice si la plata se movió: lo que entró (`usd`, o lo
// recibido en la moneda del recibo si no tiene su valor en dólares) y, si se devolvió, cuándo y cuánto (`devueltoAt`,
// `devueltoMonto` en la moneda del recibo: la MISMA regla que Analytics › Events, `eventosDePedidos`).
//
// ⚠️ ACÁ VA LA LISTA, NUNCA UN GRÁFICO (Martín, 6/11/2026): el gráfico de ingresos vive sólo en Overview y en Analytics › Metrics.
// ⚠️ LO QUE POLAR TIENE Y MaKo NO: la comisión (Fees), el impuesto (Tax), el neto (Net), el estado del payout (Status) y el tipo de
//    cambio. MaKo no guarda la comisión de Stripe ni de Mercado Pago por pago (`COMISION_PASARELA` es null para las dos,
//    lib/cobros-tipos.ts), así que el neto no se puede decir sin inventarlo: no van.
// ⚠️ UN CONTRACARGO NO ES (todavía) UN MOVIMIENTO: MaKo no guarda el día en que la pasarela sacó la plata de un contracargo, sólo
//    su texto (Sales › Disputes). Anotado en «no está en la fuente».
// =============================================================================

import type { Pedido, ReciboVenta } from './ventas'
import { NOMBRE_PASARELA, esPasarela } from '@/lib/cobros-tipos'

/** Lo que el libro necesita de un pedido de Sales › Orders. */
export type PedidoParaIngreso = Pick<Pedido, 'id' | 'fecha' | 'cliente' | 'concepto' | 'medio' | 'recurrente' | 'usd' | 'estado'> & {
  recibo: Pick<ReciboVenta, 'devueltoAt' | 'devueltoMonto' | 'monedaDetalle' | 'pagos'> | null
}

export type TipoMovimientoIngreso = 'cobro' | 'devolucion'

/** Un movimiento de plata: lo que entró o salió, un día, de un pedido. */
export type MovimientoIngreso = {
  /** Único: el id del pedido (lo que entró) o `<pedido>:devolucion` (lo que salió). */
  id: string
  /** El pedido de Sales › Orders (`/admin/sales/<pedido>`). */
  pedido: string
  /** YYYY-MM-DD. */
  fecha: string
  tipo: TipoMovimientoIngreso
  /** De una suscripción (MRR) o un pago suelto: el «Subscription / Purchase» de Polar. */
  recurrente: boolean
  /** De quién (el negocio, o la persona si no tiene cuenta). */
  nombre: string
  concepto: string | null
  medio: string | null
  /** Con signo: lo que entra es positivo, lo que sale negativo. null = no se sabe cuánto (no suma). */
  monto: number | null
  /** La moneda de `monto` («USD», «USDT», «ARS»…). null cuando no se sabe el monto. */
  moneda: string | null
}

/** Lo que lee el server (finanzas-server.ts → `leerIngresos`). `hoy` es el día de la plataforma; `avisos`, lo que no se leyó. */
export type DatosIngresos =
  | { ok: true; filas: MovimientoIngreso[]; hoy: string; avisos: string[] }
  | { ok: false; error: string }

const r2 = (n: number) => Math.round(n * 100) / 100

/** Lo que entró por un pedido: sus dólares; si no los tiene, lo recibido en la moneda del recibo (UNA sola moneda); si no, nada. */
export function entradaDelPedido(p: Pick<PedidoParaIngreso, 'usd' | 'recibo'>): { monto: number; moneda: string } | null {
  if (p.usd != null) return { monto: r2(p.usd), moneda: 'USD' }
  const vivos = (p.recibo?.pagos ?? []).filter((x) => !x.anulado)
  const monedas = new Set(vivos.map((x) => x.moneda.toUpperCase()))
  if (vivos.length === 0 || monedas.size !== 1) return null
  return { monto: r2(vivos.reduce((s, x) => s + x.monto, 0)), moneda: [...monedas][0] }
}

/**
 * Los movimientos del libro, del más viejo al más nuevo. Un pedido anulado no mueve plata; uno devuelto (o con una devolución
 * parcial) entra el día que se pagó y sale el día que se devolvió. Lo devuelto: `devueltoMonto` en la moneda del recibo si está;
 * si no, todo lo que entró (devuelto entero) o «no se sabe» (una devolución parcial sin su monto).
 */
export function movimientosDe(pedidos: readonly PedidoParaIngreso[]): MovimientoIngreso[] {
  const out: MovimientoIngreso[] = []
  for (const p of pedidos) {
    if (p.estado === 'void') continue
    const entro = entradaDelPedido(p)
    const base = {
      pedido: p.id, recurrente: p.recurrente, nombre: p.cliente?.nombre || '—', concepto: p.concepto, medio: p.medio,
    }
    out.push({ ...base, id: p.id, fecha: p.fecha.slice(0, 10), tipo: 'cobro', monto: entro?.monto ?? null, moneda: entro?.moneda ?? null })
    if (p.estado !== 'refunded' && p.estado !== 'partially_refunded') continue
    const r = p.recibo
    const sale = r?.devueltoMonto != null
      ? { monto: r2(r.devueltoMonto), moneda: r.monedaDetalle.toUpperCase() }
      : p.estado === 'refunded' ? entro : null
    out.push({
      ...base, id: `${p.id}:devolucion`, fecha: (r?.devueltoAt ?? p.fecha).slice(0, 10), tipo: 'devolucion',
      monto: sale ? -sale.monto : null, moneda: sale?.moneda ?? null,
    })
  }
  return ordenarIngresos(out, false)
}

/** El orden de la columna «Fecha» (la única que ordena, como en Polar). Por defecto, el más nuevo primero. */
export function ordenarIngresos(filas: readonly MovimientoIngreso[], desc = true): MovimientoIngreso[] {
  const s = desc ? -1 : 1
  // A igual día, lo que entró antes de lo que salió (y, entre dos del mismo tipo, por el pedido).
  const peso = (m: MovimientoIngreso) => (m.tipo === 'cobro' ? 0 : 1)
  return [...filas].sort((a, b) => s * (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : peso(a) - peso(b) || a.id.localeCompare(b.id)))
}

/** Lo que movió el libro, por moneda (lo que no se sabe cuánto no suma). Para cotejar con lo que entró. */
export function totalPorMoneda(filas: readonly MovimientoIngreso[]): Record<string, number> {
  const t: Record<string, number> = {}
  for (const f of filas) if (f.monto != null && f.moneda) t[f.moneda] = r2((t[f.moneda] ?? 0) + f.monto)
  return t
}

/** La página `pageIndex` (desde 0) de `pageSize`, con lo que el DataTable de Polar pide (`rowCount`, `pageCount`). */
export function paginar<T>(filas: readonly T[], pageIndex: number, pageSize: number): { items: T[]; rowCount: number; pageCount: number } {
  const size = Math.max(1, Math.floor(pageSize) || 1)
  const pageCount = Math.max(1, Math.ceil(filas.length / size))
  const i = Math.min(Math.max(0, Math.floor(pageIndex) || 0), pageCount - 1)
  return { items: filas.slice(i * size, (i + 1) * size), rowCount: filas.length, pageCount }
}

/** El «type» de una transacción de Polar (`Subscription` / `Purchase`), traducido; lo que sale, «Devolución». */
export const tipoDeIngreso = (f: Pick<MovimientoIngreso, 'recurrente' | 'tipo'>): string =>
  f.tipo === 'devolucion' ? 'Devolución' : f.recurrente ? 'Suscripción' : 'Compra'

/** Por dónde entró: el nombre de la pasarela si es una, o el medio como se guardó («transferencia», «binance»…). */
export function medioDeIngreso(medio: string | null | undefined): string {
  const m = String(medio ?? '').trim()
  if (!m) return 'Sin medio'
  if (esPasarela(m)) return NOMBRE_PASARELA[m]
  return m.charAt(0).toUpperCase() + m.slice(1)
}

// ─── El «Exportar» ─────────────────────────────────────────────────────────

/** Las columnas que MaKo puede exportar, con los grupos del «Export income» de Polar. */
export type ColumnaIngreso = 'created_at' | 'type' | 'customer' | 'method' | 'order_id' | 'gross_amount' | 'currency'

export const GRUPOS_EXPORTACION = [
  {
    label: 'Movimiento',
    columns: [
      { value: 'created_at', label: 'Fecha' },
      { value: 'type', label: 'Tipo' },
      { value: 'customer', label: 'De quién' },
      { value: 'method', label: 'Medio' },
      { value: 'order_id', label: 'Pedido' },
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

export const COLUMNAS_POR_DEFECTO: ColumnaIngreso[] = ['created_at', 'type', 'customer', 'method', 'order_id', 'gross_amount', 'currency']

const ROTULO: Record<ColumnaIngreso, string> = Object.fromEntries(
  GRUPOS_EXPORTACION.flatMap((g) => g.columns.map((c) => [c.value, c.label])),
) as Record<ColumnaIngreso, string>

/** Las filas cuyo día cae en el rango (los dos extremos adentro, `AAAA-MM-DD`). */
export const enElRango = (filas: readonly MovimientoIngreso[], desde: string, hasta: string): MovimientoIngreso[] =>
  filas.filter((f) => f.fecha >= desde && f.fecha <= hasta)

/**
 * Las celdas del archivo: el encabezado y un renglón por movimiento del rango, del más viejo al más nuevo, con las columnas en
 * el orden de los grupos. El texto lo arma quien baja el archivo con `armarCsv` (lib/csv-celda.ts), que neutraliza lo que
 * arranca como fórmula: un nombre que escribió otro puede empezar con «=». El monto va como número, con su signo (lo que salió,
 * negativo); sin saber cuánto, vacío.
 */
export function celdasDeExportacion(filas: readonly MovimientoIngreso[], columnas: readonly ColumnaIngreso[], rango: { desde: string; hasta: string }): Array<Array<string | number | null>> {
  const orden = COLUMNAS_POR_DEFECTO.filter((c) => columnas.includes(c))
  const valor = (f: MovimientoIngreso, c: ColumnaIngreso): string | number | null => {
    switch (c) {
      case 'created_at':
        return f.fecha
      case 'type':
        return tipoDeIngreso(f)
      case 'customer':
        return f.nombre
      case 'method':
        return medioDeIngreso(f.medio)
      case 'order_id':
        return f.pedido
      case 'gross_amount':
        return f.monto
      case 'currency':
        return f.monto == null ? null : f.moneda
    }
  }
  const cuerpo = ordenarIngresos(enElRango(filas, rango.desde, rango.hasta), false).map((f) => orden.map((c) => valor(f, c)))
  return [orden.map((c) => ROTULO[c]), ...cuerpo]
}

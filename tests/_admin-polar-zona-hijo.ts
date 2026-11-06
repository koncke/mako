// =============================================================================
// Hijo de tests/admin-polar-zona.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// El server de MaKo corre en UTC y el navegador de Martín en Argentina. Los dos modos de este hijo son los dos lados:
//   · `server` (corre con TZ=UTC): arma, con las MISMAS funciones puras que las páginas, lo que cada página le pasa a su vista
//     (Metrics: `vistaDeMetricas`; Costs: `armarCostos`; Usage de la ficha: `usoDelNegocio`). Lo escribe como JSON con cada
//     `Date` marcado como `{ "$fecha": "<iso>" }`: así viaja un `Date` por React (el instante, no la hora de pared).
//   · `navegador` (corre con TZ=America/Argentina/Buenos_Aires): lee ese JSON, rearma los `Date` y hace lo que hace la vista en
//     el navegador (`propsDeMetricas`, `recortarMetricas`, el CSV, `metricasDeCostos`, `rangoDelMes`, `fechaDeEje`), y dibuja
//     Costs con un router de mentira. Escribe lo que vería Martín.
// Los datos son ficticios (AGENTS.md: nada de clientes reales en tests/).
// =============================================================================

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { calcularIngresos, type ClienteIngreso, type PagoIngreso } from '../lib/admin-ingresos-reglas'
import type { ResumenPeriodo } from '../lib/costos-ia'
import { propsDeMetricas, recortarMetricas, vistaDeMetricas, type VistaDeMetricas } from '../app/admin/_polar/datos/metricas'
import { armarCostos, metricasDeCostos, rangoDelMes, type VistaCostos } from '../app/admin/_polar/datos/costos'
import { usoDelNegocio } from '../app/admin/_polar/datos/cliente'
import { fechaDeEje, filasCsvDeMetricas, getTimestampFormatter } from '../app/admin/_polar/web/utils/metrics'

const HOY = '2026-11-06'

function delServer() {
  const quien = new Map<string, ClienteIngreso>([['ws:1', { clave: 'ws:1', nombre: 'Estudio Norte', ws: 1, leadId: 1 }]])
  let n = 0
  const pago = (fecha: string, usd: number): PagoIngreso => ({
    id: `p:${++n}`, cliente: 'ws:1', suscripcion: 'sub:ws:1', fecha, usd, medio: 'transferencia', concepto: null,
  })
  const pagos = ['2026-08-03', '2026-09-03', '2026-10-03', '2026-11-03'].map((f, i) => pago(f, 100 + i))
  const metricas = vistaDeMetricas({ ...calcularIngresos(pagos, quien, HOY), avisos: ['los recibos: de mentira'] })

  const corte = (clave: string, costUsd: number) => ({ clave, llamadas: 1, tokens: 0, costUsd })
  const resumen: ResumenPeriodo = {
    periodo: '2026-11', desde: null, hasta: null, filas: 3, llamadas: 3, tokens: 0, costUsd: 0.75,
    porFeature: [corte('closing', 0.75)], porProveedor: [], porModelo: [],
    porDia: [corte('2026-11-01', 0.25), corte('2026-11-05', 0.5)],
    porWorkspace: [], mesesDisponibles: [], delNegocio: { llamadas: 0, costUsd: 0 }, delCredito: { llamadas: 0, costUsd: 0 },
  }
  const costos = armarCostos({
    periodo: '2026-11', actual: resumen, previo: { ...resumen, porFeature: [corte('closing', 0.5)] }, hoy: HOY,
    mesesConDatos: ['2026-11', '2026-10'], cobrado: 103, avisos: ['el mes anterior (sin comparaciones): de mentira'],
  })

  const uso = usoDelNegocio(
    [
      { dia: '2026-11-01', usuario: 7, tab: 'crm', pantallas: 3, acciones: 1 },
      { dia: '2026-11-05', usuario: 7, tab: 'crm', pantallas: 2, acciones: 0 },
    ],
    [{ key: 'crm', label: 'CRM', keys: ['crm'] }],
    [],
    '2026-11-01', HOY, 'day',
  )
  return { metricas, costos, serieDeUso: uso.serie }
}

type DelServer = ReturnType<typeof delServer>

/** Cuántos `Date` lleva lo que el server le pasa a la vista: tiene que ser cero (punto 5 de la revisión del 6/11/2026). */
function contarFechas(v: unknown): number {
  if (v instanceof Date) return 1
  if (Array.isArray(v)) return v.reduce((s: number, x) => s + contarFechas(x), 0)
  if (v && typeof v === 'object') return Object.values(v).reduce((s: number, x) => s + contarFechas(x), 0)
  return 0
}

const aJson = (v: unknown) =>
  JSON.stringify(v, function (this: Record<string, unknown>, k) {
    const crudo = this[k]
    return crudo instanceof Date ? { $fecha: crudo.toISOString() } : crudo
  })
const deJson = (s: string) =>
  JSON.parse(s, (_k, v) => (v && typeof v === 'object' && typeof v.$fecha === 'string' ? new Date(v.$fecha) : v))

async function enElNavegador(s: DelServer) {
  const mes = getTimestampFormatter('month')
  const dia = getTimestampFormatter('day')
  const props = propsDeMetricas(s.metricas as VistaDeMetricas)
  const periodos = props.data.periods
  // «Este mes» del selector de Metrics, en la hora de quien mira (`rangosMensuales`: del 1 a hoy).
  const esteMes = recortarMetricas(props.data, new Date(2026, 10, 1), new Date(2026, 10, 6, 23, 59, 59, 999))
  const csv = filasCsvDeMetricas(props.data, ['revenue'])

  const c = s.costos as VistaCostos
  const gasto = metricasDeCostos(c.porDia, c.periodo, c.hoy)
  const rango = rangoDelMes(c.periodo)
  const router = { refresh() {}, push() {}, replace() {}, back() {}, forward() {}, prefetch() {} }
  const { default: CostsPage } = await import('../app/admin/(polar)/analytics/costs/CostsPage')
  const { default: MetricsPage } = await import('../app/admin/(polar)/analytics/metrics/MetricsPage')
  const { TooltipProvider } = await import('../app/admin/_polar/orbit/components/Tooltip')
  // Las páginas de verdad, como las dibuja Next en el navegador: con el router, la URL (sin rango) y los tooltips.
  const dibujar = (el: ReturnType<typeof createElement>, ruta: string) => renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: router as never },
      createElement(PathnameContext.Provider, { value: ruta },
        createElement(SearchParamsContext.Provider, { value: new URLSearchParams() as never },
          createElement(TooltipProvider, null, el)))))
  const html = dibujar(createElement(CostsPage, { vista: c }), '/admin/analytics/costs')
  const htmlMetrics = dibujar(createElement(MetricsPage, { vista: s.metricas as VistaDeMetricas }), '/admin/analytics/metrics')
  const { default: EventsPage } = await import('../app/admin/(polar)/analytics/events/EventsPage')
  const htmlEvents = dibujar(createElement(EventsPage, {
    vista: { eventos: [], negocios: [], cortes: [], avisos: ['los errores: de mentira'], earliest: '2026-08-01T00:00:00.000Z' },
  }), '/admin/analytics/events')

  return {
    metricas: {
      primero: mes(periodos[0].timestamp),
      ultimo: mes(periodos[periodos.length - 1].timestamp),
      meses: periodos.length,
      esteMes: esteMes.periods.map((p) => mes(p.timestamp)),
      revenueEsteMes: esteMes.totals.revenue,
      csvUltimo: csv[csv.length - 1][0],
      html: htmlMetrics,
    },
    costos: {
      dias: gasto.periods.map((p) => dia(p.timestamp)),
      gastoDel1: gasto.periods[0]?.costs,
      desde: [rango.from.getFullYear(), rango.from.getMonth() + 1, rango.from.getDate()],
      hasta: [rango.to.getFullYear(), rango.to.getMonth() + 1, rango.to.getDate()],
      html,
    },
    uso: s.serieDeUso.map((p) => dia(fechaDeEje(p.timestamp as string))),
    eventos: htmlEvents,
  }
}

async function main() {
  const modo = process.argv[2]
  if (modo === 'server') {
    const s = delServer()
    process.stdout.write(JSON.stringify({ fechas: contarFechas(s), zona: Intl.DateTimeFormat().resolvedOptions().timeZone, payload: aJson(s) }))
    return
  }
  if (modo === 'navegador') {
    let entrada = ''
    for await (const trozo of process.stdin) entrada += trozo
    const s = deJson(entrada) as DelServer
    process.stdout.write(JSON.stringify({ zona: Intl.DateTimeFormat().resolvedOptions().timeZone, ...(await enElNavegador(s)) }))
    return
  }
  throw new Error(`modo desconocido: ${modo}`)
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e))
  process.exit(1)
})

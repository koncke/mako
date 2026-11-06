'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/costs/CostsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// LA VISTA de Admin › Analytics › Costs, PURA (todo por props: se captura con datos de ejemplo). La pantalla de Polar con
// sus dos pestañas (Overview y LLM) y sus secciones en el mismo orden, con el gasto de IA de MaKo (`datos/costos.ts`):
//   · Overview: los gráficos del gasto por día y del margen bruto (revisión del 6/11/2026: el `gross_margin` y el
//     `gross_margin_percentage` de Polar, con la cuenta de la tarjeta de Overview); «Breakdown» (Desglose) por feature (lo que en
//     Polar es el tipo de evento); «Changes» (Cambios) contra el mes anterior;
//   · LLM: «By Model» (Por modelo) y «By Vendor» (Por proveedor).
// Los dos «By Customer» de Polar se sacaron (6/11/2026): el gasto de IA de cada negocio vive en UN lugar, Customers › Cost
// Drivers, donde lo puso Martín. Costs no lleva un link ahí: Cost Drivers mira el mes en curso y Costs cualquier mes, así que
// desde un mes viejo el link llevaría a otra cosa. Los títulos de las secciones, en español (no son nombres de la barra).
// Se sacaron: «Anomalies» (los eventos por encima del p99 de su tipo: MaKo guarda el gasto agregado, no cada llamada con su
// costo comparable), la cantidad de clientes de cada modelo y el detalle de un tipo (`costs/[spanId]`: no hay llamadas que
// listar). En vez del rango de días de Polar, el mes (`resumenDelPeriodo` lee un mes), y el selector va a la URL (`?mes=`).

import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { MetricGroup } from '@/app/admin/_polar/web/Metrics/dashboards/MetricGroup'
import { metricasDeCostosConDatos, plataDeCosto, type FilaCosto, type VistaCostos } from '@/app/admin/_polar/datos/costos'
import { mesTxt } from '@/lib/admin-ingresos-reglas'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import {
  Alert,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Text,
} from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { RankedList, RankedListItem } from './RankedListItem'
import { TrendBadge } from './TrendBadge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/admin/_polar/orbit'
import {
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  ChartNoAxesColumn as BarChart2,
  Minus,
  TrendingUp,
} from '@/app/admin/_polar/orbit/icons'
import { useRouter } from '@/app/_ui/Link'
import { useMemo } from 'react'
import { fmtPct } from './utils'

export default function ClientPage({ vista }: { vista: VistaCostos }) {
  const router = useRouter()
  // MaKo: los límites del mes vienen en UTC («2026-11-01T00:00:00.000Z»); leídos con `new Date()` en México eran el 31 de
  // octubre a las 18 h, y el rango decía «31 oct – 30 nov». Se toma el DÍA y se arma a medianoche del navegador.
  const dateRange = useMemo(
    () => ({ from: diaLocal(vista.desde), to: diaLocal(vista.hasta) }),
    [vista.desde, vista.hasta],
  )
  const prevStart = vista.previo ? diaLocal(vista.previo.desde) : null
  const prevEnd = vista.previo ? diaLocal(vista.previo.hasta) : null

  const fmt = formatCurrency('accounting')
  // MaKo: Polar muestra los costos chicos con seis decimales («US$ 0,029286»); acá en centavos, y lo que no llega a uno
  // dice «< US$ 0,01» (`plataDeCosto`, datos/costos.ts).
  const fmtSub = (centavos: number) => plataDeCosto(centavos, fmt)

  const tendencia = (r: FilaCosto) =>
    r.pct !== null && prevStart && prevEnd ? (
      <TrendBadge
        delta={r.delta}
        pct={r.pct}
        currentStart={dateRange.from}
        currentEnd={dateRange.to}
        prevStart={prevStart}
        prevEnd={prevEnd}
      />
    ) : null

  const ranked = (rows: FilaCosto[], value: (r: FilaCosto) => string) => (
    <RankedList>
      {rows.map((r, i) => (
        <RankedListItem
          key={r.clave}
          itemKey={r.clave}
          rank={i + 1}
          share={r.share}
          label={
            <Box flex={1} minWidth={0}>
              <Text variant="title" truncate>
                {r.label}
              </Text>
            </Box>
          }
          stats={
            <>
              {tendencia(r)}
              <Text as="span" variant="caption" color="muted" tabularNums>
                {r.llamadas.toLocaleString('es-AR')} llamadas
              </Text>
              <Text as="span" variant="caption" color="muted" tabularNums>
                Promedio {fmtSub(r.promedio)}
              </Text>
            </>
          }
          value={
            <Box width={96} justifyContent="end">
              <Text as="span" variant="title" monospace tabularNums>
                {value(r)}
              </Text>
            </Box>
          }
        />
      ))}
    </RankedList>
  )

  const content = (
    <Tabs defaultValue="overview">
      {vista.avisos.length > 0 && (
        <div className="mb-8">
          <Alert
            variant="warning"
            soporte
            title="No pude leer todo"
            description={vista.avisos.join(' · ')}
          />
        </div>
      )}
      <TabsList className="mb-8">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="llm">LLM</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="flex flex-col gap-y-10">
          {/* Las de Polar (`getMetricsForType('costs')`) que MaKo llena: el gasto, el acumulado y el margen bruto (con la cuenta de
              la tarjeta «Margen bruto» de Overview, que lleva acá). Sin lo que entró, el margen no se dibuja. */}
          <MetricGroup
            metricKeys={metricasDeCostosConDatos(vista.metricas)}
            data={vista.metricas}
            interval="day"
            completarFila
          />

          {/* Where money is going */}
          <section>
            <SectionHeader
              title="Desglose"
              description="Cada función de MaKo, por lo que gastó este mes."
            />
            {vista.porFeature.length === 0 ? (
              <EmptyState
                icon={<BarChart2 />}
                title="Sin gasto de IA"
                description="Este mes MaKo no gastó en IA con sus claves."
              />
            ) : (
              <RankedList>
                {vista.porFeature.map((s, i) => (
                  <RankedListItem
                    key={s.clave}
                    itemKey={s.clave}
                    rank={i + 1}
                    share={s.share}
                    label={
                      <Box flex={1} minWidth={0}>
                        <Text variant="title" truncate>
                          {s.label}
                        </Text>
                      </Box>
                    }
                    stats={
                      <>
                        {tendencia(s)}
                        <Text as="span" variant="caption" color="muted" tabularNums>
                          {s.llamadas.toLocaleString('es-AR')} llamadas
                        </Text>
                        <Text as="span" variant="caption" color="muted" tabularNums>
                          Promedio {fmtSub(s.promedio)}
                        </Text>
                      </>
                    }
                    value={
                      <Box width={96} justifyContent="end">
                        <Text as="span" variant="default" tabularNums>
                          {fmt(s.costo, 'usd')}
                        </Text>
                      </Box>
                    }
                  />
                ))}
              </RankedList>
            )}
          </section>

          {/* What changed */}
          {vista.previo && (
            <section>
              <SectionHeader
                title="Cambios"
                description="Lo que más cambió contra el mes anterior."
              />
              {vista.cambios.length === 0 ? (
                <EmptyState
                  icon={<TrendingUp />}
                  title="Sin cambios"
                  description="Ninguna función gastó distinto que el mes anterior."
                />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {vista.cambios.map((s) => {
                    const isUp = s.delta > 0
                    const isDown = s.delta < 0
                    return (
                      <div
                        key={s.clave}
                        className="dark:border-polar-700 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:bg-transparent"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm leading-snug font-medium dark:text-white">
                            {s.label}
                          </span>
                          <span
                            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                              isUp
                                ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                                : isDown
                                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                                  : 'dark:bg-polar-700 bg-gray-100 text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {isUp ? (
                              <ArrowUpRight className="size-3" />
                            ) : isDown ? (
                              <ArrowDownRight className="size-3" />
                            ) : (
                              <Minus className="size-3" />
                            )}
                            {s.pct !== null
                              ? fmtPct(s.pct)
                              : fmt(Math.abs(s.delta), 'usd')}
                          </span>
                        </div>
                        <div className="flex items-end justify-between">
                          <div className="dark:text-polar-500 flex flex-col gap-0.5 text-xs text-gray-400">
                            <span>antes {fmt(s.previo ?? 0, 'usd')}</span>
                            <span>ahora {fmt(s.costo, 'usd')}</span>
                          </div>
                          <span className="font-mono text-lg font-medium tabular-nums dark:text-white">
                            {fmt(s.costo, 'usd')}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

        </div>
      </TabsContent>

      <TabsContent value="llm">
        <div className="flex flex-col gap-y-10">
          <section>
            <SectionHeader
              title="Por modelo"
              description="Los modelos de IA, por lo que gastaron este mes."
            />
            {vista.porModelo.length === 0 ? (
              <EmptyState
                icon={<Bot />}
                title="Sin gasto por modelo"
                description="Este mes ningún modelo gastó con las claves de MaKo."
              />
            ) : (
              ranked(vista.porModelo, (r) => fmtSub(r.costo))
            )}
          </section>

          <section>
            <SectionHeader
              title="Por proveedor"
              description="Los proveedores de IA, por lo que gastaron este mes."
            />
            {vista.porProveedor.length === 0 ? (
              <EmptyState
                icon={<Bot />}
                title="Sin gasto por proveedor"
                description="Este mes ningún proveedor cobró con las claves de MaKo."
              />
            ) : (
              ranked(vista.porProveedor, (r) => fmtSub(r.costo))
            )}
          </section>
        </div>
      </TabsContent>
    </Tabs>
  )

  return (
    <DashboardBody
      title="Costs"
      header={
        <Select
          value={vista.periodo}
          onValueChange={(mes) => router.push(`/admin/analytics/costs?mes=${mes}`)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {vista.meses.map((mes) => (
              <SelectItem key={mes} value={mes}>
                {mesTxt(mes)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {content}
    </DashboardBody>
  )
}

/** «2026-11-01T00:00:00.000Z» o «2026-11-01» → la medianoche de ese día en el navegador. */
function diaLocal(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

function SectionHeader({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-medium dark:text-white">{title}</h2>
      <p className="dark:text-polar-500 mt-0.5 text-sm text-gray-400">
        {description}
      </p>
    </div>
  )
}

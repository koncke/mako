'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/costs/CostsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// LA VISTA de Admin › Analytics › Costs, PURA (todo por props: se captura con datos de ejemplo). La pantalla de Polar con
// sus dos pestañas (Overview y LLM) y sus secciones en el mismo orden, con el gasto de IA de MaKo (`datos/costos.ts`):
//   · Overview: el gráfico del gasto por día; «Breakdown» por feature (lo que en Polar es el tipo de evento); «Changes»
//     contra el mes anterior; «By Customer» por negocio, SÓLO si el corte es real (si no, se dice por qué);
//   · LLM: «By Model» y «By Vendor». El «By Customer» de esta pestaña se sacó: en MaKo todo costo es de IA, así que sería
//     la misma lista dos veces.
// Se sacaron: «Anomalies» (los eventos por encima del p99 de su tipo: MaKo guarda el gasto agregado, no cada llamada con su
// costo comparable), la cantidad de clientes de cada modelo y el detalle de un tipo (`costs/[spanId]`: no hay llamadas que
// listar). En vez del rango de días de Polar, el mes (`resumenDelPeriodo` lee un mes), y el selector va a la URL (`?mes=`).

import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { MetricGroup } from '@/app/admin/_polar/web/Metrics/dashboards/MetricGroup'
import { COST_METRICS, type FilaCosto, type VistaCostos } from '@/app/admin/_polar/datos/costos'
import { mesTxt } from '@/lib/admin-ingresos-reglas'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import {
  Alert,
  Avatar,
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
  Users,
} from '@/app/admin/_polar/orbit/icons'
import { useRouter } from '@/app/_ui/Link'
import { useMemo } from 'react'
import { fmtPct } from './utils'

export default function ClientPage({ vista }: { vista: VistaCostos }) {
  const router = useRouter()
  const dateRange = useMemo(
    () => ({ from: new Date(vista.desde), to: new Date(vista.hasta) }),
    [vista.desde, vista.hasta],
  )
  const prevStart = vista.previo ? new Date(vista.previo.desde) : null
  const prevEnd = vista.previo ? new Date(vista.previo.hasta) : null

  const fmt = formatCurrency('accounting')
  const fmtSub = formatCurrency('subcent')

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
                Promedio {fmtSub(r.promedio, 'usd')}
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
          <MetricGroup
            metricKeys={[...COST_METRICS]}
            data={vista.metricas}
            interval="day"
          />

          {/* Where money is going */}
          <section>
            <SectionHeader
              title="Breakdown"
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
                          Promedio {fmtSub(s.promedio, 'usd')}
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
                title="Changes"
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

          {/* By Customer */}
          <section>
            <SectionHeader
              title="By Customer"
              description="Los negocios que más gastaron este mes."
            />
            {vista.porNegocio === null ? (
              <EmptyState
                icon={<Users />}
                title="Este mes no se puede repartir por negocio"
                description="El gasto de Claude con la clave de MaKo no guarda de qué negocio vino: repartirlo diría que un negocio gastó lo de todos."
              />
            ) : vista.porNegocio.length === 0 ? (
              <EmptyState
                icon={<Users />}
                title="Sin gasto por negocio"
                description="Este mes ningún negocio gastó en IA con las claves de MaKo."
              />
            ) : (
              <RankedList>
                {vista.porNegocio.map((r, i) => (
                  <RankedListItem
                    key={r.clave}
                    itemKey={r.clave}
                    rank={i + 1}
                    share={r.share}
                    onSelect={
                      r.ws ? () => router.push(`/admin/customers/${r.ws}`) : undefined
                    }
                    label={
                      <>
                        <Avatar
                          name={r.label}
                          avatar_url={null}
                          className="h-9 w-9 shrink-0 text-xs"
                        />
                        <Box flexDirection="column" flex={1} minWidth={0}>
                          <Text variant="title" truncate>
                            {r.label}
                          </Text>
                        </Box>
                      </>
                    }
                    stats={
                      <Text as="span" variant="caption" color="muted" tabularNums>
                        {r.llamadas.toLocaleString('es-AR')} llamadas
                      </Text>
                    }
                    value={
                      <Box width={96} justifyContent="end">
                        <Text as="span" variant="default" tabularNums>
                          {fmt(r.costo, 'usd')}
                        </Text>
                      </Box>
                    }
                  />
                ))}
              </RankedList>
            )}
          </section>
        </div>
      </TabsContent>

      <TabsContent value="llm">
        <div className="flex flex-col gap-y-10">
          <section>
            <SectionHeader
              title="By Model"
              description="Los modelos de IA, por lo que gastaron este mes."
            />
            {vista.porModelo.length === 0 ? (
              <EmptyState
                icon={<Bot />}
                title="Sin gasto por modelo"
                description="Este mes ningún modelo gastó con las claves de MaKo."
              />
            ) : (
              ranked(vista.porModelo, (r) => fmtSub(r.costo, 'usd'))
            )}
          </section>

          <section>
            <SectionHeader
              title="By Vendor"
              description="Los proveedores de IA, por lo que gastaron este mes."
            />
            {vista.porProveedor.length === 0 ? (
              <EmptyState
                icon={<Bot />}
                title="Sin gasto por proveedor"
                description="Este mes ningún proveedor cobró con las claves de MaKo."
              />
            ) : (
              ranked(vista.porProveedor, (r) => fmtSub(r.costo, 'usd'))
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

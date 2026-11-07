'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/costs/CostsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// LA VISTA de Admin › Analytics › Costs, PURA (todo por props: se captura con datos de ejemplo). La pantalla de Polar con
// sus dos pestañas (Overview y LLM) y sus secciones en el mismo orden, con el gasto de IA de MaKo (`datos/costos.ts`):
//   · Overview: arriba, lo cobrado del mes y su «AI margin» (en el lugar de la tarjeta Gross Margin de Polar; punto 12 de la
//     revisión del 6/11/2026); el gráfico del gasto por día; «Breakdown» por feature (lo que en Polar es el tipo de evento);
//     «Changes» contra el mes anterior;
//   · LLM: «By Model» y «By Vendor».
// Los dos «By Customer» de Polar se sacaron (6/11/2026): el gasto de IA de cada negocio vive en UN lugar, Customers › Cost
// Drivers, donde lo puso Martín. Costs no lleva un link ahí: Cost Drivers mira un rango hasta hoy y Costs cualquier mes, así
// que desde un mes viejo el link llevaría a otra cosa. Los títulos de las secciones van en inglés, como en Polar (decisión de
// Martín: los nombres de sección, en inglés); las frases y lo que mide cada gráfico, en español.
// ⚠️ El gráfico y las fechas de las comparaciones se arman ACÁ, en el navegador (`metricasDeCostos`, `rangoDelMes`): del
//    server llegan el mes y los días como texto. Armados allá (UTC), cada día salía con la fecha anterior (punto 5).
// Se sacaron: «Anomalies» (los eventos por encima del p99 de su tipo: MaKo guarda el gasto agregado, no cada llamada con su
// costo comparable), la cantidad de clientes de cada modelo y el detalle de un tipo (`costs/[spanId]`: no hay llamadas que
// listar). En vez del rango de días de Polar, el mes (`resumenDelPeriodo` lee un mes), y el selector va a la URL (`?mes=`).

import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { MetricGroup } from '@/app/admin/_polar/web/Metrics/dashboards/MetricGroup'
import {
  COST_METRICS,
  metricasDeCostos,
  rangoDelMes,
  type FilaCosto,
  type MargenDelMes,
  type VistaCostos,
} from '@/app/admin/_polar/datos/costos'
import {
  PARTIDAS_FIJAS,
  DIAS_PARA_ENVEJECER,
  cuestaAMartin,
  diasSinConfirmar,
  fijoDeMartin,
  fijoSiPagaTodo,
  partidasViejas,
} from '@/lib/costos-fijos'
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
  const dateRange = useMemo(() => rangoDelMes(vista.periodo), [vista.periodo])
  const previo = useMemo(
    () => (vista.previo ? rangoDelMes(vista.previo.periodo) : null),
    [vista.previo],
  )
  const prevStart = previo?.from ?? null
  const prevEnd = previo?.to ?? null
  const metricas = useMemo(
    () => metricasDeCostos(vista.porDia, vista.periodo, vista.hoy),
    [vista.porDia, vista.periodo, vista.hoy],
  )

  const fmt = formatCurrency('accounting')
  const fmtSub = formatCurrency('subcent')
  // El fijo: el tuyo y el total son distintos a propósito (hoy Mauricio paga una parte, y las
  // cuentas de Claude que no son suyas van a medias con Leandro). El equilibrio usa el TUYO.
  const fijoTuyo = fijoDeMartin()
  const fijoTotal = fijoSiPagaTodo()
  const viejas = partidasViejas(vista.hoy)

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
            soporte
            title="Puede faltar algo"
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
          <MargenDelMesCards margen={vista.margen} mes={vista.periodo} />
          <MetricGroup
            metricKeys={[...COST_METRICS]}
            data={metricas}
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

          {/* Fixed costs — lo que se paga vaya o no vaya un cliente */}
          <section>
            <SectionHeader
              title="Fixed costs"
              description="Lo que se paga todos los meses, haya clientes o no. Arriba está el gasto de IA, que es variable; esto no se mueve."
            />
            <RankedList>
              {PARTIDAS_FIJAS.map((p, i) => {
                const mio = cuestaAMartin(p)
                const dias = diasSinConfirmar(p, vista.hoy)
                const viejo = dias >= DIAS_PARA_ENVEJECER
                return (
                  <RankedListItem
                    key={p.id}
                    itemKey={p.id}
                    rank={i + 1}
                    share={fijoTotal > 0 ? p.usdPorMes / fijoTotal : 0}
                    label={
                      <Box flex={1} minWidth={0}>
                        <Text variant="title" truncate>
                          {p.nombre}
                        </Text>
                      </Box>
                    }
                    stats={
                      <>
                        <Text as="span" variant="caption" color="muted">
                          {p.quienPaga === 'mauricio'
                            ? 'lo paga Mauricio'
                            : p.quienPaga === 'compartido'
                              ? `a medias con Leandro · tu parte: ${fmt(mio, 'usd')}`
                              : 'a tu cargo'}
                        </Text>
                        <Text as="span" variant="caption" color={viejo ? 'warning' : 'muted'}>
                          {p.comoSeSabe === 'api'
                            ? 'consultado a su API'
                            : p.comoSeSabe === 'panel'
                              ? 'hay que mirarlo en su panel'
                              : 'declarado'}
                          {' · '}
                          {dias === 0 ? 'confirmado hoy' : `hace ${dias} ${dias === 1 ? 'día' : 'días'}`}
                        </Text>
                      </>
                    }
                    value={
                      <Box width={96} justifyContent="end">
                        <Text as="span" variant="default" tabularNums>
                          {fmt(p.usdPorMes, 'usd')}
                        </Text>
                      </Box>
                    }
                  />
                )
              })}
            </RankedList>
            {/* Los dos totales, que son distintos a propósito: el equilibrio se calcula con el de arriba. */}
            <Alert
              variant="info"
              title="Sale de tu bolsillo"
              description={
                `${fmt(fijoTuyo, 'usd')} al mes. El total es ${fmt(fijoTotal, 'usd')}: la diferencia la paga Mauricio hoy. ` +
                `Con 10 clientes son ${fmt(fijoTuyo / 10, 'usd')} por cliente; con 100, ${fmt(fijoTuyo / 100, 'usd')}.`
              }
            />
            {viejas.length > 0 && (
              <Alert
                variant="warning"
                title="Cifras que nadie confirma hace rato"
                description={
                  `${viejas.map((p) => p.nombre).join(', ')}. Estas no se pueden leer por API: hay que ` +
                  'entrar al panel y actualizarlas en lib/costos-fijos.ts. Mientras tanto la pantalla ' +
                  'muestra lo ultimo confirmado, no lo de hoy.'
                }
              />
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

/**
 * Lo cobrado del mes y su «AI margin», arriba del gráfico, con la forma de una tarjeta de Polar (el título chico, el número
 * grande y su leyenda). «AI margin» y no «Gross margin»: sólo resta la IA pagada por API con las claves de MaKo (punto 12).
 */
function MargenDelMesCards({ margen, mes }: { margen: MargenDelMes; mes: string }) {
  const fmt = formatCurrency('accounting')
  const tarjeta = (titulo: string, valor: string, leyenda: string) => (
    <div className="dark:border-polar-700 flex flex-col gap-2 rounded-2xl border border-gray-200 p-6">
      <Text variant="title">{titulo}</Text>
      <Text variant="heading-m" weight="book" tabularNums>
        {valor}
      </Text>
      <Text variant="caption" color="muted">
        {leyenda}
      </Text>
    </div>
  )
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {tarjeta(
        'Ingresos',
        margen.cobradoCentavos != null ? fmt(margen.cobradoCentavos, 'usd') : '–',
        `Lo cobrado en ${mesTxt(mes)}`,
      )}
      {tarjeta(
        'AI margin',
        margen.margen != null ? `${margen.margen}%` : '–',
        `${mesTxt(mes)} · sólo resta la IA por API`,
      )}
    </div>
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

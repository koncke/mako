'use client'

// Admin › Analytics › Costs: lo que se va de una suscripción (10/11/2026). Martín: «la torta de un cliente de 97: cuánto le
// queda y a dónde va cada dólar», con lo que tenía el tablero local (docs/tableros/numeros-mako.html): los selectores, la
// cuenta del primer mes, el techo del CAC y los cupos por plan.
//
// ⚠️ PROHIBIDO INVENTAR (AGENTS.md): todo se arma con piezas que ya son copia de polarsource/polar (Apache-2.0):
//   · los selectores son el `Select` de Orbit, en la fila de filtros de Polar (MetricsHeader.tsx: `flex-col … lg:flex-row`);
//   · el reparto es el «Breakdown» de las cancelaciones de Polar (CancellationsDistributionChart.tsx → DistributionChart.tsx),
//     en la grilla con bordes de CancellationsContent.tsx, y con los colores de Polar (cancellations/constants.ts);
//   · el primer mes y los cupos son las tarjetas de «Changes» de Polar (CostsPage.tsx), como Unit economics y What you keep;
//   · el techo del CAC es un `Alert`, como «Por qué el doble de clientes da MÁS del doble».
// Del tablero quedaron afuera «Altas nuevas este mes» y «Quién paga qué» (ver docs/relevo/nube-costs-suscripcion.md).
//
// ⚠️ LOS NÚMEROS SALEN DE `loQueSeVaDeUnaSuscripcion` (lib/economia-unitaria.ts), la misma función que arma la torta de
// /admin/estrategia. Con el escenario del modelo (lo que viene elegido) el 97 da 61,53 de ganancia
// (con 9 meses de vida, `MESES_DE_VIDA`).
// ⚠️ Y LA PLATA VA EN DÓLARES POR `fmtUsd` (utils.ts): el `formatCurrency` de Polar recibe centavos.

import DistributionChart from '@/app/admin/_polar/web/Metrics/DistributionChart'
import {
  Alert,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/admin/_polar/orbit'
import { ArrowDownRight, ArrowUpRight } from '@/app/admin/_polar/orbit/icons'
import { fijoDeMartin, fijoSiPagaTodo } from '@/lib/costos-fijos'
import {
  ESCENARIO_DEL_MODELO,
  NOMBRE_DE_PARTE,
  PASARELAS,
  PLANES_PAGOS,
  loQueSeVaDeUnaSuscripcion,
  type ClaveDeParte,
  type Escenario,
  type Suscripcion as SuscripcionPlan,
} from '@/lib/economia-unitaria'
import { useMemo, useState, type ReactNode } from 'react'
import { SectionHeader } from './SectionHeader'
import { fmtPct, fmtUsd } from './utils'

/** Los colores de Polar para un reparto (clients/apps/web/src/components/Metrics/cancellations/constants.ts, REASON_COLORS). */
const COLOR_DE_PARTE: Record<ClaveDeParte, string> = {
  ganancia: '#8ED6B9',
  conseguir: '#618BE6',
  servir: '#F3AB71',
  impuesto: '#EF765F',
  cobro: '#CEC7C7',
}

const usd = fmtUsd
const enteros = (n: number) => n.toLocaleString('es-AR')
/** 0,25 → «25%»; 0,018 → «1,80%», como los escribe el tablero. */
const pct = (tasa: number) => {
  const v = Math.round(tasa * 10000) / 100
  return `${v.toLocaleString('es-AR', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}%`
}

/** Lo que se elige en los selectores. Arranca en el escenario del modelo. */
export type Eleccion = {
  clientes: number
  cacUsd: number
  uso: number
  pasarela: string
  conImpuesto: boolean
  fijo: 'tuyo' | 'todo'
}

const INICIAL: Eleccion = {
  clientes: ESCENARIO_DEL_MODELO.clientes,
  cacUsd: ESCENARIO_DEL_MODELO.cacUsd,
  uso: ESCENARIO_DEL_MODELO.usoDelCupo,
  pasarela: PASARELAS.find((p) => p.tasa === ESCENARIO_DEL_MODELO.pasarela)?.id ?? PASARELAS[0].id,
  conImpuesto: ESCENARIO_DEL_MODELO.impuesto > 0,
  fijo: 'tuyo',
}

/** Las opciones de un selector, con el valor del modelo adentro aunque no sea redondo. */
const conElDelModelo = (valores: number[], delModelo: number) =>
  Array.from(new Set([...valores, delModelo])).sort((a, b) => a - b)

const CLIENTES = conElDelModelo([10, 20, 50, 100, 200], INICIAL.clientes)
const CACS = conElDelModelo([0, 50, 97], INICIAL.cacUsd)
const USOS = conElDelModelo([0, 0.25, 0.5, 1], INICIAL.uso)

/** De lo elegido al escenario que entiende la función. */
export function escenarioDe(e: Eleccion): Escenario {
  return {
    clientes: e.clientes,
    cacUsd: e.cacUsd,
    usoDelCupo: e.uso,
    pasarela: PASARELAS.find((p) => p.id === e.pasarela)?.tasa ?? ESCENARIO_DEL_MODELO.pasarela,
    impuesto: e.conImpuesto ? ESCENARIO_DEL_MODELO.impuesto : 0,
    fijoMensualUsd: e.fijo === 'todo' ? fijoSiPagaTodo() : fijoDeMartin(),
  }
}

export function SuscripcionCosts({ inicial }: { inicial?: Partial<Eleccion> }) {
  const [eleccion, setEleccion] = useState<Eleccion>({ ...INICIAL, ...inicial })
  const cambiar = (c: Partial<Eleccion>) => setEleccion((e) => ({ ...e, ...c }))
  const planes = useMemo(() => {
    const escenario = escenarioDe(eleccion)
    return PLANES_PAGOS.map((p) => loQueSeVaDeUnaSuscripcion(p, escenario))
  }, [eleccion])
  const avisos = Array.from(new Set(planes.flatMap((p) => p.avisos)))
  const nombre = (p: SuscripcionPlan) => `Plan de US$${p.precioUsd}`

  const selector = (
    etiqueta: string,
    valor: string,
    alCambiar: (v: string) => void,
    opciones: { valor: string; texto: string }[],
  ) => (
    <div className="w-full lg:w-auto">
      <Select value={valor} onValueChange={alCambiar}>
        <SelectTrigger className="w-full text-sm" aria-label={etiqueta}>
          {/* El texto va como hijo: el `SelectValue` de Radix sólo lo pinta solo después de hidratar. */}
          <SelectValue>{opciones.find((o) => o.valor === valor)?.texto}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.texto}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )

  const techos = planes.map((p) => ({ p, techo: p.desdeElSegundoMesUsd }))
  const pierden = techos.filter((t) => eleccion.cacUsd > t.techo)

  return (
    <>
      {/* A dónde va cada dólar — la torta de /admin/estrategia, con el reparto de Polar */}
      <section>
        <SectionHeader
          title="Subscription breakdown"
          description="A dónde va lo que paga un cliente cada mes. La IA de texto no se resta: la paga cada negocio con su clave."
        />
        <div className="mb-4 flex flex-col items-center gap-2 lg:flex-row lg:flex-wrap">
          {selector('Clientes', String(eleccion.clientes), (v) => cambiar({ clientes: Number(v) }),
            CLIENTES.map((n) => ({ valor: String(n), texto: `${enteros(n)} clientes` })))}
          {selector('Costo de adquisición', String(eleccion.cacUsd), (v) => cambiar({ cacUsd: Number(v) }),
            CACS.map((n) => ({ valor: String(n), texto: n === 0 ? 'CAC US$0 (orgánico)' : `CAC US$${enteros(n)}` })))}
          {selector('Cuánto del cupo de video usan', String(eleccion.uso), (v) => cambiar({ uso: Number(v) }),
            USOS.map((n) => ({ valor: String(n), texto: `Video: ${pct(n)} del cupo` })))}
          {selector('Por dónde se cobra', eleccion.pasarela, (v) => cambiar({ pasarela: v }),
            PASARELAS.map((p) => ({ valor: p.id, texto: `${p.nombre} — ${pct(p.tasa)}` })))}
          {selector('Impuesto', eleccion.conImpuesto ? 'si' : 'no', (v) => cambiar({ conImpuesto: v === 'si' }), [
            { valor: 'si', texto: `Con impuesto — ${pct(ESCENARIO_DEL_MODELO.impuesto)}` },
            { valor: 'no', texto: 'Sin impuesto — hoy lo paga Leandro' },
          ])}
          {selector('Gasto fijo', eleccion.fijo, (v) => cambiar({ fijo: v === 'todo' ? 'todo' : 'tuyo' }), [
            { valor: 'tuyo', texto: `Fijo ${usd(fijoDeMartin())} (lo tuyo)` },
            { valor: 'todo', texto: `Fijo ${usd(fijoSiPagaTodo())} (todo)` },
          ])}
        </div>
        <div className="dark:border-polar-700 flex flex-col overflow-hidden rounded-2xl border border-gray-200">
          <div className="grid grid-cols-1 flex-col [clip-path:inset(1px_1px_1px_1px)] lg:grid-cols-2">
            {planes.map((p) => (
              <div
                key={p.plan}
                className="dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200 p-4"
              >
                <DistributionChart
                  title={nombre(p)}
                  total={p.precioUsd}
                  formatear={usd}
                  items={p.partes.map((parte) => ({
                    key: parte.clave,
                    label: NOMBRE_DE_PARTE[parte.clave],
                    value: parte.usd,
                    color: COLOR_DE_PARTE[parte.clave],
                  }))}
                />
              </div>
            ))}
          </div>
        </div>
        {avisos.length > 0 && <Alert variant="warning" title="Falta un dato" description={avisos.join(' · ')} />}
      </section>

      {/* El primer mes — la condición de Martín: que cada cliente deje plata el mes en que entra */}
      <section>
        <SectionHeader
          title="First month"
          description="El primer mes se paga el CAC entero. Desde el segundo, queda la ganancia más la captación."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {planes.flatMap((p) => [
            <Tarjeta
              key={`${p.plan}-primero`}
              label={`US$${p.precioUsd} · primer mes`}
              valor={usd(p.primerMesUsd)}
              tasa={p.primerMesUsd / p.precioUsd}
              pie={[`entra ${usd(p.precioUsd)}`, `CAC ${usd(p.cacUsd)} entero`]}
            />,
            <Tarjeta
              key={`${p.plan}-segundo`}
              label={`US$${p.precioUsd} · desde el 2.º mes`}
              valor={usd(p.desdeElSegundoMesUsd)}
              tasa={p.desdeElSegundoMesUsd / p.precioUsd}
              pie={['el CAC ya se pagó', 'es el techo del CAC']}
            />,
          ])}
        </div>
        <Alert
          variant={pierden.length === 0 ? 'success' : 'warning'}
          title={`Techo del CAC: ${techos.map((t) => `${usd(t.techo)} en el de ${t.p.precioUsd}`).join(' y ')}`}
          description={
            pierden.length === 0
              ? `Con un CAC de ${usd(eleccion.cacUsd)}, los dos planes dejan plata desde el primer mes.`
              : `Por arriba del techo, el cliente entra perdiendo plata y la recupera en los meses siguientes. Con un CAC de ` +
                `${usd(eleccion.cacUsd)}, ${pierden.map((t) => `el de ${t.p.precioUsd} arranca perdiendo ${usd(-t.p.primerMesUsd)}`).join(' y ')}.`
          }
        />
      </section>

      {/* Los cupos por plan — el techo de video e imagen que trae cada uno */}
      <section>
        <SectionHeader
          title="AI quota"
          description="El cupo de video e imagen de cada plan es un techo: sólo se gasta lo que el cliente genera, y no se acumula."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {planes.map((p) => (
            <Tarjeta
              key={p.plan}
              label={nombre(p)}
              valor={`${enteros(p.cupoMt)} MT`}
              pie={[`techo ${usd(p.techoIaUsd)}`, `al ${pct(eleccion.uso)}: ${usd(p.videoUsd)}`]}
            />
          ))}
        </div>
      </section>
    </>
  )
}

/** La tarjeta de «Changes» de Polar (CostsPage.tsx), con el chip en verde si deja y en rojo si pierde. */
function Tarjeta({
  label,
  valor,
  pie,
  tasa,
}: {
  label: string
  valor: string
  pie: string[]
  tasa?: number
}): ReactNode {
  const bien = tasa != null && tasa > 0
  return (
    <div className="dark:border-polar-700 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:bg-transparent">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm leading-snug font-medium dark:text-white">{label}</span>
        {tasa != null && (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              bien
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {bien ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {fmtPct(tasa * 100)}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="dark:text-polar-500 flex flex-col gap-0.5 text-xs text-gray-400">
          {pie.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        <span className="font-mono text-lg font-medium tabular-nums dark:text-white">{valor}</span>
      </div>
    </div>
  )
}

'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerUsageView.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: Polar muestra los MEDIDORES del cliente (lo que consumió de cada uno, el gráfico apilado y la tabla). Un negocio de
// MaKo no tiene medidores: tiene TABS. Cada tab es un medidor (lo consumido son las pantallas que se abrieron, con sus
// acciones y cuántas personas la usaron) y la IA es otro (sus llamadas y lo que costaron), del uso medido (`actividad_uso`, mig
// 0398) y de las llamadas anotadas en el negocio (`anthropic_usage`). Debajo, lo que NO usa: las tabs que nadie del negocio
// abrió en el rango. Se sacaron Credited, Balance, Overages y «Add credits»: MaKo no da créditos por cliente. La IA no va en el
// gráfico: se cuenta en llamadas, no en pantallas, y apilarla con las tabs sumaría dos cosas distintas.
// ⚠️ «No usa» sólo se afirma desde que se mide: antes del primer día medido no hay nada que mirar, y se dice.
// ⚠️ EL RANGO SE VE (punto 30 de la revisión del 6/11/2026): arriba a la derecha va el mismo selector que la fila Metrics de la
//    ficha (`CustomerMetricsRangeControl`), también con «Sin uso en estos días». Sin él, «en el rango» no decía cuál: desde la
//    ficha con 30 días eran 30 días, y entrando directo, toda la vida del negocio.
// Los encabezados de la tabla son «Dónde» y «Uso» (punto 27): la tabla mezcla tabs con la fila de la IA, y «Medidor» y
// «Consumido» de Polar no dicen nada en MaKo.

import { usoDelNegocio, type IaDelDia } from '@/app/admin/_polar/datos/cliente'
import type { FilaUso } from '@/lib/actividad-reglas'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import ShadowBox from '@/app/admin/_polar/atoms/ShadowBox'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import {
  DataTable,
  DataTableColumnHeader,
  type DataTableSortingState,
  Status,
  Text,
} from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import dynamic from 'next/dynamic'
import { Suspense, useMemo, useState } from 'react'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { CircleGauge as GaugeCircleIcon } from '@/app/admin/_polar/orbit/icons'
import { useCustomerMetricsParams } from './useCustomerMetricsParams'
import { CustomerMetricsRangeControl } from './CustomerMetricsRangeControl'

const StackedMeterChart = dynamic(() => import('./StackedMeterChart'))

export interface CustomerUsageViewProps {
  /** `false` = la medición del uso por pantalla no está. */
  medido: boolean
  /** El primer día medido (YYYY-MM-DD). */
  desdeMedido: string | null
  filas: Array<Pick<FilaUso, 'dia' | 'usuario' | 'tab' | 'pantallas' | 'acciones'>>
  tabs: Array<{ key: string; label: string; keys: string[] }>
  ia: IaDelDia[]
  /** El principio de la actividad del negocio (el «All Time» del rango). */
  inicio: string
}

type Columna = 'nombre' | 'consumido' | 'acciones' | 'personas' | 'costoUsd' | 'ultimo'

const unidadTxt = (n: number, unidad: 'pantallas' | 'llamadas') =>
  `${n.toLocaleString('es-AR')} ${unidad === 'pantallas' ? (n === 1 ? 'pantalla' : 'pantallas') : n === 1 ? 'llamada' : 'llamadas'}`

export const CustomerUsageView = ({
  medido,
  desdeMedido,
  filas,
  tabs,
  ia,
  inicio,
}: CustomerUsageViewProps) => {
  const { interval, desde, hasta } = useCustomerMetricsParams(inicio)
  const [sorting, setSorting] = useState<DataTableSortingState>([])

  const uso = useMemo(
    () => usoDelNegocio(filas, tabs, ia, desde, hasta, interval),
    [filas, tabs, ia, desde, hasta, interval],
  )

  const tableRows = useMemo(() => {
    const s = sorting[0]
    if (!s) return uso.medidores
    const col = s.id as Columna
    const v = (m: (typeof uso.medidores)[number]) => m[col] ?? -1
    return [...uso.medidores].sort((a, b) => {
      const x = v(a)
      const y = v(b)
      const r = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'es') : Number(x) - Number(y)
      return s.desc ? -r : r
    })
  }, [uso.medidores, sorting])

  if (!medido && uso.medidores.length === 0) {
    return (
      <EmptyState
        icon={<GaugeCircleIcon className="h-6 w-6" />}
        title="El uso todavía no se mide"
        description="Sin esa medición no se sabe qué tabs abre."
      />
    )
  }

  const medidoDesde = desdeMedido && desdeMedido > desde ? desdeMedido : null

  return (
    <Box flexDirection="column" rowGap="2xl">
      <Box justifyContent="end">
        <CustomerMetricsRangeControl inicio={inicio} />
      </Box>
      {uso.medidores.length === 0 ? (
        <EmptyState
          icon={<GaugeCircleIcon className="h-6 w-6" />}
          title="Sin uso en estos días"
          description="Nadie de este negocio abrió MaKo ni usó su IA en el rango elegido."
        />
      ) : (
        <>
          {uso.series.length > 0 && (
            <ShadowBox className="dark:bg-polar-800 flex flex-col gap-y-4 p-2">
              <div className="dark:bg-polar-900 rounded-3xl bg-white p-4">
                <Suspense fallback={<div style={{ height: 250 }} />}>
                  <StackedMeterChart
                    data={uso.serie}
                    series={uso.series}
                    interval={interval}
                    height={250}
                  />
                </Suspense>
              </div>
            </ShadowBox>
          )}
          <DataTable
            isLoading={false}
            data={tableRows}
            sorting={sorting}
            onSortingChange={setSorting}
            columns={[
              {
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Dónde" />
                ),
                accessorKey: 'nombre',
                size: 200,
                cell: ({ row }) => (
                  <div className="flex items-center gap-x-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: row.original.color }}
                    />
                    <span>{row.original.nombre}</span>
                    {row.original.key === 'ia' && (
                      <span className="dark:text-polar-500 text-gray-500">
                        Inteligencia artificial
                      </span>
                    )}
                  </div>
                ),
              },
              {
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Uso" />
                ),
                accessorKey: 'consumido',
                size: 130,
                cell: ({ row }) => <span>{unidadTxt(row.original.consumido, row.original.unidad)}</span>,
              },
              {
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Acciones" />
                ),
                accessorKey: 'acciones',
                size: 100,
                cell: ({ row }) =>
                  row.original.acciones == null ? (
                    <span className="dark:text-polar-500 text-gray-500">—</span>
                  ) : (
                    <span>{row.original.acciones.toLocaleString('es-AR')}</span>
                  ),
              },
              {
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Personas" />
                ),
                accessorKey: 'personas',
                size: 100,
                cell: ({ row }) =>
                  row.original.personas == null ? (
                    <span className="dark:text-polar-500 text-gray-500">—</span>
                  ) : (
                    <span>{row.original.personas}</span>
                  ),
              },
              {
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Costo" />
                ),
                accessorKey: 'costoUsd',
                size: 100,
                cell: ({ row }) =>
                  row.original.costoUsd == null ? (
                    <span className="dark:text-polar-500 text-gray-500">—</span>
                  ) : (
                    <span>{formatCurrency('subcent')(row.original.costoUsd * 100, 'usd')}</span>
                  ),
              },
              {
                header: ({ column }) => (
                  <DataTableColumnHeader column={column} title="Último uso" />
                ),
                accessorKey: 'ultimo',
                size: 120,
                cell: ({ row }) =>
                  row.original.ultimo ? (
                    <FormattedDateTime datetime={`${row.original.ultimo}T12:00:00`} />
                  ) : (
                    <span className="dark:text-polar-500 text-gray-500">—</span>
                  ),
              },
            ]}
          />
        </>
      )}
      {medido && (
        <Box flexDirection="column" rowGap="m">
          <Text variant="heading-xxs" as="h3">
            Sin uso
          </Text>
          <Text color="muted">
            {uso.sinUso.length === 0
              ? 'Usó todas las tabs en el rango.'
              : medidoDesde
                ? `Las tabs que nadie del negocio abrió desde que se mide (el ${new Date(`${medidoDesde}T12:00:00`).toLocaleDateString('es-AR', { dateStyle: 'medium' })}).`
                : 'Las tabs que nadie del negocio abrió en el rango.'}
          </Text>
          {uso.sinUso.length > 0 && (
            <Box flexWrap="wrap" gap="s">
              {uso.sinUso.map((t) => (
                <Status key={t.key} color="gray" size="small" status={t.label} />
              ))}
            </Box>
          )}
        </Box>
      )}
      {uso.medidores.some((m) => m.key === 'ia') && (
        <Text variant="caption" color="muted">
          No incluye Claude con la clave de MaKo.
        </Text>
      )}
    </Box>
  )
}

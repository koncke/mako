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
// «Por persona» (F169, 18/11/2026; docs/relevo/nube-admin.md: «lo que hace cada persona en la ficha de su negocio»): la misma
// tabla de Polar, con las mismas filas sumadas por quién las abrió (`usoPorPersona`) y la persona dibujada como en Members. Polar
// no la tiene: sus medidores no son de personas. Sin la IA, que no se anota por persona.

import { usoDelNegocio, usoPorPersona, type IaDelDia, type PersonaDelUso } from '@/app/admin/_polar/datos/cliente'
import type { FilaUso } from '@/lib/actividad-reglas'
import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import ShadowBox from '@/app/admin/_polar/atoms/ShadowBox'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import {
  Avatar,
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
  /** Quién es cada persona de `filas` (la tabla «Por persona»). */
  personas: PersonaDelUso[]
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
  personas,
  inicio,
}: CustomerUsageViewProps) => {
  const { interval, desde, hasta } = useCustomerMetricsParams(inicio)
  const [sorting, setSorting] = useState<DataTableSortingState>([])

  const uso = useMemo(
    () => usoDelNegocio(filas, tabs, ia, desde, hasta, interval),
    [filas, tabs, ia, desde, hasta, interval],
  )

  // «Por persona» (F169, 18/11/2026): las mismas filas y el mismo rango que la tabla de las tabs, sumadas por quién las abrió.
  const porPersona = useMemo(
    () => usoPorPersona(filas, tabs, personas, desde, hasta),
    [filas, tabs, personas, desde, hasta],
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
          {porPersona.length > 0 && (
            <Box flexDirection="column" rowGap="m">
              <Text variant="heading-xxs" as="h3">
                Por persona
              </Text>
              {/* Las columnas son las de la tabla de arriba, con la persona como la dibuja Members (MembersSection.tsx). */}
              <DataTable
                isLoading={false}
                data={porPersona}
                columns={[
                  {
                    header: 'Persona',
                    accessorKey: 'nombre',
                    size: 240,
                    cell: ({ row: { original } }) => (
                      <Box alignItems="center" gap="m">
                        <Avatar className="h-8 w-8" name={original.nombre} avatar_url={original.cara} />
                        <Box flexDirection="column" minWidth={0}>
                          <Text truncate>{original.nombre}</Text>
                          {original.email && (
                            <Text color="muted" truncate>
                              {original.email}
                            </Text>
                          )}
                        </Box>
                      </Box>
                    ),
                  },
                  {
                    header: 'Uso',
                    accessorKey: 'pantallas',
                    size: 130,
                    cell: ({ row }) => <span>{unidadTxt(row.original.pantallas, 'pantallas')}</span>,
                  },
                  {
                    header: 'Acciones',
                    accessorKey: 'acciones',
                    size: 100,
                    cell: ({ row }) => <span>{row.original.acciones.toLocaleString('es-AR')}</span>,
                  },
                  {
                    header: 'Más usada',
                    accessorKey: 'masUsada',
                    size: 160,
                    cell: ({ row }) =>
                      row.original.masUsada ? (
                        <span>{row.original.masUsada}</span>
                      ) : (
                        <span className="dark:text-polar-500 text-gray-500">—</span>
                      ),
                  },
                  {
                    header: 'Último uso',
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
            </Box>
          )}
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

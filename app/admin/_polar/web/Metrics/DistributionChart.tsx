'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Metrics/CancellationsDistributionChart.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El «Breakdown» de las cancelaciones de Polar: una barra con una franja por parte, ancha según su peso, y debajo la leyenda
// con su punto de color, su valor y el total. Polar no tiene un gráfico de anillo; éste es su gráfico de reparto, y MaKo lo
// usa para lo que se va de una suscripción (Admin › Analytics › Costs, 10/11/2026).
// MaKo:
//   · recibe las partes ya armadas (`items`) en vez de sumar los períodos de las métricas, y el título por prop;
//   · los valores son plata (`formatear`), no conteos. El clic en el valor sigue alternando entre el monto y el % (Polar);
//   · el % es contra el TOTAL que se le pasa (el precio del plan), no contra la suma de lo dibujado. Una parte negativa (una
//     ganancia que no alcanza) no se dibuja en la barra —Polar tampoco dibuja las que dan cero— y la leyenda la muestra con
//     su signo; el Total es la suma de todas, con su signo;
//   · se sacó el modal de cada motivo (`CancellationReasonModal`): acá no hay suscripciones que listar detrás de una parte, y
//     el valor que alterna monto y % es un `<button>` (en Polar, un `<span>` con `onClick`: no se alcanzaba con el teclado);
//   · `dark:text-white` en la raíz: en Polar el blanco lo hereda de su página, y en la de MaKo el texto quedaba gris.

import { useMemo, useState } from 'react'

export interface DistributionItem {
  key: string
  label: string
  value: number
  color: string
}

interface DistributionChartProps {
  title: string
  items: DistributionItem[]
  /** Contra qué se calcula el %. Si no se pasa, la suma de las partes. */
  total?: number
  formatear: (value: number) => string
  height?: number
}

interface ItemData extends DistributionItem {
  percentage: number
}

export default function DistributionChart({
  title,
  items,
  total,
  formatear,
  height = 20,
}: DistributionChartProps) {
  const { chartData, legendData, grandTotal } = useMemo(() => {
    const suma = items.reduce((sum, item) => sum + item.value, 0)
    const base = total ?? suma
    // La barra reparte sólo lo positivo, y su ancho es contra la suma de lo positivo: si los costos pasan el total, la
    // barra se llena con ellos (no se desborda).
    const positivos = items.filter((item) => item.value > 0)
    const sumaPositiva = positivos.reduce((sum, item) => sum + item.value, 0)

    const chartData =
      sumaPositiva === 0
        ? []
        : positivos.map(
            (item): ItemData => ({
              ...item,
              percentage: (item.value / sumaPositiva) * 100,
            }),
          )

    const legendData = items.map(
      (item): ItemData => ({
        ...item,
        percentage: base !== 0 ? (item.value / base) * 100 : 0,
      }),
    )

    return { chartData, legendData, grandTotal: suma }
  }, [items, total])

  const [displayMode, setDisplayMode] = useState<'count' | 'percentage'>(
    'count',
  )

  return (
    <div className="relative dark:text-white">
      <div className="p-4">
        <h3 className="text-lg">{title}</h3>
      </div>

      <div className="relative px-4 pb-4">
        <div
          className="dark:bg-polar-600 flex w-full overflow-hidden rounded-xs bg-gray-100"
          style={{ height }}
        >
          {chartData.map((item) => (
            <div
              key={item.key}
              className="relative"
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.color,
              }}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-col gap-y-2 text-sm">
          {legendData.map((item) => (
            <div
              key={item.key}
              className="flex items-center justify-start gap-2"
            >
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
              <button
                type="button"
                className="dark:text-polar-400 -m-1 ml-auto cursor-pointer p-1 text-right font-medium text-gray-500 tabular-nums"
                onClick={() =>
                  setDisplayMode((previousValue) =>
                    previousValue === 'count' ? 'percentage' : 'count',
                  )
                }
              >
                {displayMode === 'count'
                  ? formatear(item.value)
                  : `${item.percentage.toFixed(2).replace('.00', '').replace('.', ',')}%`}
              </button>
            </div>
          ))}
          <div className="dark:border-polar-600 mt-1 flex items-center justify-between gap-2 border-t border-gray-200 pt-2">
            <span className="dark:text-polar-400 font-medium text-gray-500">
              Total
            </span>
            <span className="ml-auto text-right font-medium tabular-nums">
              {formatear(grandTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

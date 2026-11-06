// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/finance/_components/balance-distribution-card.tsx.
"use client";

// «Account Allocation» de Studio → por dónde entró la plata (Stripe, Mercado Pago, Binance…). El selector de moneda de Studio
// elige acá el período: todo está en dólares (lo que entró sin su valor en dólares no suma, como en Revenue).

import * as React from "react";

import { Label, Pie, PieChart } from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/app/admin/_studio/components/ui/chart";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/app/admin/_studio/components/ui/select";
import { formatCurrency } from "@/app/admin/_studio/lib/utils";
import type { Entrada } from "@/lib/admin-ingresos-reglas";

import { desdeDe, PERIODOS, type PeriodoId, porMedio } from "../billing-vista";

const COLORES = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function BalanceDistributionCard({ entradas, hoy }: { entradas: Entrada[]; hoy: string }) {
  const [periodo, setPeriodo] = React.useState<PeriodoId>("12m");
  const porciones = React.useMemo(() => porMedio(entradas, desdeDe(periodo, hoy), hoy), [entradas, periodo, hoy]);
  const chartData = porciones.map((p, i) => ({ ...p, fill: COLORES[i % COLORES.length] }));
  const chartConfig = React.useMemo(
    () => ({ usd: { label: "Cobrado" }, ...Object.fromEntries(chartData.map((p) => [p.id, { label: p.rotulo, color: p.fill }])) }) satisfies ChartConfig,
    [chartData],
  );
  const total = porciones.reduce((a, p) => a + p.usd, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Por dónde entra</CardTitle>
        <CardAction>
          <Select onValueChange={(value) => setPeriodo(value as PeriodoId)} value={periodo}>
            <SelectTrigger className="w-36" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.rotulo}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        {chartData.length === 0 ? (
          <p className="text-muted-foreground text-sm sm:col-span-2">No entró plata en este período.</p>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="mx-auto aspect-square h-50">
              <PieChart>
                <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel className="w-52" nameKey="rotulo" />} />
                <Pie
                  cornerRadius={6}
                  data={chartData}
                  dataKey="usd"
                  innerRadius={65}
                  nameKey="rotulo"
                  outerRadius={90}
                  paddingAngle={2}
                  strokeWidth={5}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) {
                        return null;
                      }

                      return (
                        <text dominantBaseline="middle" textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                          <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy ?? 0) - 8}>
                            Total
                          </tspan>
                          <tspan
                            className="fill-foreground text-lg font-medium tabular-nums"
                            x={viewBox.cx}
                            y={(viewBox.cy ?? 0) + 14}
                          >
                            {formatCurrency(total, { noDecimals: true })}
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="flex min-w-0 flex-col gap-3">
              {chartData.map((item) => (
                <div className="grid grid-cols-[1fr_auto] items-end gap-3" key={item.id}>
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1">
                      <span aria-hidden="true" className="h-2 w-1 rounded-full" style={{ backgroundColor: item.fill }} />
                      <p className="text-muted-foreground truncate text-xs">{item.rotulo}</p>
                    </div>
                    <p className="font-medium tabular-nums">{formatCurrency(item.usd, { noDecimals: true })}</p>
                  </div>
                  <div className="font-medium tabular-nums">{item.pct}%</div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

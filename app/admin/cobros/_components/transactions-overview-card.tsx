"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/finance/_components/transactions-overview-card.tsx.

// «Spending Overview» de Studio → lo cobrado (la línea llena, como su gasto) y lo que vence (la punteada, como su ingreso):
// la punteada es lo que todavía no pasó (AGENTS.md: «lo medido y lo supuesto no se dibujan igual»). Semana, Mes y Año en el
// lugar de Weekly, Monthly y Yearly.

import * as React from "react";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/app/admin/_studio/components/ui/chart";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/app/admin/_studio/components/ui/select";
import { formatCurrency } from "@/app/admin/_studio/lib/utils";
import type { Entrada, PorCobrar } from "@/lib/admin-ingresos-reglas";

import { RANGOS, type RangoId, serieDe } from "../billing-vista";

const formatTooltipCurrency = (value: number | string) => formatCurrency(Number(value), { noDecimals: true });

const chartConfig = {
  cobrado: {
    color: "var(--chart-4)",
    label: "Cobrado",
  },
  vence: {
    color: "var(--chart-2)",
    label: "Vence",
  },
} satisfies ChartConfig;

export function TransactionsOverviewCard({ entradas, porCobrar, hoy }: { entradas: Entrada[]; porCobrar: PorCobrar[]; hoy: string }) {
  const [rango, setRango] = React.useState<RangoId>("mes");
  const chartData = React.useMemo(() => serieDe(entradas, porCobrar, rango, hoy), [entradas, porCobrar, rango, hoy]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Lo cobrado y lo que vence</CardTitle>
        <CardAction>
          <Select value={rango} onValueChange={(v) => setRango(v as RangoId)}>
            <SelectTrigger className="w-28" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {RANGOS.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.rotulo}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="h-50 w-full">
          <LineChart accessibilityLayer data={chartData} margin={{ bottom: 0, left: 0, right: 0, top: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="rotulo"
              interval="preserveStartEnd"
              minTickGap={24}
              tickLine={false}
              tickMargin={10}
              tick={{ fontSize: 12 }}
            />
            <YAxis hide axisLine={false} tickLine={false} tickMargin={10} tick={{ fontSize: 12 }} />
            <ChartTooltip
              cursor={false}
              content={({ active, payload, label }) => (
                <ChartTooltipContent
                  active={active}
                  label={label}
                  payload={payload?.map((item) => ({
                    ...item,
                    value: typeof item.value === "number" ? formatTooltipCurrency(item.value) : item.value,
                  }))}
                />
              )}
            />
            <Line
              connectNulls
              dataKey="vence"
              dot={false}
              stroke="var(--color-vence)"
              strokeDasharray="5 5"
              strokeLinecap="round"
              strokeWidth={1}
              type="linear"
            />
            <Line
              dataKey="cobrado"
              dot={false}
              stroke="var(--color-cobrado)"
              strokeLinecap="round"
              strokeWidth={3}
              type="linear"
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

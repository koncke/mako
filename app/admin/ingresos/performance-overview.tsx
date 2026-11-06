"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.

// =============================================================================
// Admin › Revenue — «Customer Activity» (Studio Admin, MIT, dashboard/default/_components/performance-overview.tsx)
// =============================================================================
// Copiado: la tarjeta, el gráfico compuesto (un área con degradé y dos líneas), la leyenda arriba a la derecha, el tooltip
// con su indicador de línea y la grilla horizontal. Lo de MaKo:
//   · los puntos son MESES (Studio dibuja cada 12 horas): lo cobrado (el área), el MRR y el MRR nuevo (las dos líneas);
//   · el selector de período anda (12, 6 o 3 meses); en Studio tiene una sola opción;
//   · «All segments» no está: MaKo no parte lo cobrado por segmento (la lista «no está en la fuente» del relevo);
//   · «View report» es «Ver cobros» y lleva a Billing.

import * as React from "react";

import { Area, CartesianGrid, ComposedChart, Line, XAxis } from "recharts";

import Link from "@/app/_ui/Link";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/app/admin/_studio/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/app/admin/_studio/components/ui/select";
import { mesTxt } from "@/lib/admin-ingresos-reglas";

import type { PuntoActividad } from "./revenue-vista";

const chartConfig = {
  cobrado: {
    label: "Cobrado",
    color: "var(--chart-1)",
  },
  mrr: {
    label: "MRR",
    color: "var(--chart-2)",
  },
  nuevoMrr: {
    label: "MRR nuevo",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

const PERIODOS = [
  { value: "12", label: "12 meses" },
  { value: "6", label: "6 meses" },
  { value: "3", label: "3 meses" },
] as const;

const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesLargo = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES_LARGOS[m - 1] ?? mes} ${y}`;
};

export function PerformanceOverview({ puntos, hoy }: { puntos: PuntoActividad[]; hoy: string }) {
  const [periodo, setPeriodo] = React.useState<string>("12");
  const chartData = puntos.slice(-Number(periodo));

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="leading-none">Actividad de clientes</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">Lo cobrado y el MRR de los últimos {periodo} meses, en dólares</span>
          <span className="@[540px]/card:hidden">Últimos {periodo} meses</span>
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger size="sm" className="w-28">
              <SelectValue placeholder="12 meses" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Período</SelectLabel>
                {PERIODOS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" asChild>
            <Link prefetch={false} href="/admin?tab=billing">
              Ver cobros
            </Link>
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-80 w-full">
          <ComposedChart data={chartData} margin={{ top: 0 }}>
            <defs>
              <linearGradient id="fillCobrado" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-cobrado)" stopOpacity={0.36} />
                <stop offset="95%" stopColor="var(--color-cobrado)" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeOpacity={0.5} />

            <XAxis
              dataKey="mes"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={48}
              tickFormatter={(value) => mesTxt(String(value), hoy)}
            />

            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  className="w-50"
                  indicator="line"
                  labelFormatter={(value) => mesLargo(String(value))}
                />
              }
            />
            <ChartLegend verticalAlign="top" content={<ChartLegendContent className="mb-5 justify-end" />} />

            <Area
              dataKey="cobrado"
              type="natural"
              fill="url(#fillCobrado)"
              stroke="var(--color-cobrado)"
              strokeWidth={1.25}
              dot={false}
              fillOpacity={1}
            />
            <Line
              dataKey="mrr"
              type="natural"
              stroke="var(--color-mrr)"
              strokeWidth={1.4}
              dot={false}
            />
            <Line
              dataKey="nuevoMrr"
              type="natural"
              stroke="var(--color-nuevoMrr)"
              strokeWidth={1.2}
              dot={false}
            />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

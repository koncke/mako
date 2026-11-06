"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/crm/_components/pipeline-activity.tsx.
// «Qualified Lead Flow» → lo que entró por la plataforma cada mes (las barras rayadas de Studio), y su recuadro «Discovery
// Calls Booked» → cuántos de los clientes activos pagan su mensualidad. El selector de Studio (30 días, trimestre, 12 meses)
// no cambiaba nada; acá elige 3 o 6 meses, lo que la vista trae. Sin plata, el gráfico lo dice y lleva a vender un plan.

import * as React from "react";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import Link from "@/app/_ui/Link";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/app/admin/_studio/components/ui/chart";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/app/admin/_studio/components/ui/empty";
import { Progress } from "@/app/admin/_studio/components/ui/progress";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/app/admin/_studio/components/ui/select";
import type { VistaClientes } from "@/lib/clientes-plataforma";

import { entradoEn, mesTxt, RANGOS, ROTULO_RANGO, type Rango, usdTxt } from "../customers-vista";

const pipelineChartConfig = {
  entro: {
    label: "Entró",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

export function PipelineActivity({ cobrado, vencido, pago }: {
  cobrado: VistaClientes["cobrado"];
  vencido: VistaClientes["vencido"];
  pago: { pagan: number; activos: number; pct: number };
}) {
  const [rango, setRango] = React.useState<Rango>("6m");
  const entrado = entradoEn(cobrado, rango);
  const data = entrado?.meses.map((m) => ({ mes: m.mes, entro: m.usd })) ?? [];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-12">
        <CardHeader>
          <CardTitle>Lo que entró por mes</CardTitle>
          <CardAction>
            <Select value={rango} onValueChange={(v) => setRango(v as Rango)}>
              <SelectTrigger size="sm" className="min-w-40" aria-label="Cuántos meses">
                <SelectValue placeholder="Elige el rango" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {RANGOS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROTULO_RANGO[r]}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {entrado ? (
              <ChartContainer config={pipelineChartConfig} className="h-72 w-full lg:col-span-8">
                <BarChart data={data} margin={{ left: 0, right: 0, top: 0, bottom: 0 }} barSize={38}>
                  <defs>
                    <pattern id="crm-qualified-pattern" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <rect width="6" height="6" fill="var(--color-entro)" fillOpacity="0.15" />
                      <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-entro)" strokeWidth="1.25" strokeOpacity="0.40" />
                    </pattern>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="0" />
                  <XAxis dataKey="mes" tickLine={false} tickMargin={10} axisLine={false} tickFormatter={(value) => mesTxt(String(value))} />
                  <YAxis hide />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        hideIndicator
                        labelFormatter={(value) => `${mesTxt(String(value))} ${String(value).slice(2, 4)}`}
                        formatter={(value) => (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="text-muted-foreground">Entró</span>
                            <span className="text-foreground font-mono font-medium tabular-nums">{usdTxt(Number(value))}</span>
                          </div>
                        )}
                      />
                    }
                  />
                  <Bar
                    dataKey="entro"
                    fill="url(#crm-qualified-pattern)"
                    radius={[8, 8, 0, 0]}
                    stroke="var(--color-entro)"
                    strokeOpacity={0.5}
                    strokeWidth={0.5}
                  />
                </BarChart>
              </ChartContainer>
            ) : (
              <Empty className="h-72 border lg:col-span-8">
                <EmptyHeader>
                  <EmptyTitle>Todavía no entró plata por MaKo.</EmptyTitle>
                  <EmptyDescription>Cuando cargues un pago o alguien pague por la pasarela, aparece aquí.</EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button asChild size="sm" variant="outline">
                    <Link href="/admin?tab=billing">Vender un plan</Link>
                  </Button>
                </EmptyContent>
              </Empty>
            )}

            <div className="flex flex-col gap-5 rounded-lg p-4 lg:col-span-4">
              <div className="flex flex-col gap-1">
                <div className="text-4xl leading-none font-medium tabular-nums">{entrado ? usdTxt(entrado.total) : "—"}</div>
                <p className="text-muted-foreground text-sm">Lo que entró por la plataforma en {ROTULO_RANGO[rango]}.</p>
                {vencido && vencido.cuotas > 0 && (
                  <p className="text-destructive text-sm">
                    {vencido.cuotas} {vencido.cuotas === 1 ? "cuota vencida" : "cuotas vencidas"} · {usdTxt(vencido.usd)}
                  </p>
                )}
              </div>

              <div className="border-border/60 flex flex-col gap-3 rounded-lg border p-3">
                <div className="text-muted-foreground text-[11px] tracking-widest uppercase">Pagan su mensualidad</div>

                <div className="flex flex-col gap-1.5">
                  <div className="text-2xl leading-none font-medium tabular-nums">
                    {pago.pagan} <span className="text-muted-foreground text-sm font-normal">{pago.pagan === 1 ? "negocio" : "negocios"}</span>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {pago.activos ? `${pago.pct}% de los clientes activos paga.` : "Todavía no hay clientes activos."}
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-0.5">
                  <Progress value={pago.pct} className="bg-chart-2/12 *:data-[slot='progress-indicator']:bg-chart-2 h-2.5" />
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-medium tabular-nums">{pago.pagan} pagan</div>
                    <div className="text-muted-foreground tabular-nums">{pago.activos} activos</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

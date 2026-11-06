// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/finance/_components/income-breakdown.tsx.
// «Income sources» de Studio → cómo entró la plata en los últimos 12 meses: todos los meses (una suscripción) o una vez.
import { Card, CardContent, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import { Separator } from "@/app/admin/_studio/components/ui/separator";
import { cn } from "cn";

import { type Porcion, usd } from "../billing-vista";

// Los tonos de las barras de Studio, uno por porción.
const TONOS = ["bg-chart-3", "bg-chart-3/75", "bg-chart-3/50"];

export function IncomeBreakdown({ porciones }: { porciones: Porcion[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Cómo entra · últimos 12 meses</CardTitle>
      </CardHeader>

      <CardContent className={cn("grid grid-cols-1 gap-1", porciones.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
        {porciones.length === 0 ? (
          <p className="text-muted-foreground text-sm">Todavía no entró plata en estos meses.</p>
        ) : (
          porciones.map((p, i) => (
            <section key={p.id} className="isolate flex gap-[0.5px]">
              <Separator
                orientation="vertical"
                className="border-muted-foreground/50 mb-1 h-auto self-auto border-l border-dashed bg-transparent"
              />
              <div className="flex min-h-24 flex-1 flex-col justify-between">
                <div className="flex min-w-0 flex-col gap-1 px-1">
                  <p className="text-muted-foreground text-xs leading-none wrap-break-word">
                    {p.rotulo} · {p.pct}%
                  </p>
                  <div className="text-lg leading-none tracking-tight">{usd(p.usd)}</div>
                </div>
                <div className={cn("-ml-0.5 h-5 rounded-sm", TONOS[i] ?? TONOS[2])} />
              </div>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}

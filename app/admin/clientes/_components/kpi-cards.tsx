// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/crm/_components/kpi-cards.tsx.
// Las cuatro tarjetas de «Pipeline Overview» con los números de los clientes de MaKo (../customers-vista.ts, `tarjetasKpi`).
// La insignia de tendencia (+12%) y el «last month» de Studio no van: MaKo no guarda cómo estaban estos números el mes pasado.

import { ArrowUpRight } from "lucide-react";

import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/app/admin/_studio/components/ui/card";

import type { TarjetaKpi } from "../customers-vista";

export function KpiCards({ tarjetas }: { tarjetas: TarjetaKpi[] }) {
  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-3xl tracking-tight">Tus clientes</h2>
        <p className="text-muted-foreground text-sm">Lo que pagan, quién está activo y quién pide atención.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tarjetas.map((t) => (
          <Card key={t.titulo}>
            <CardHeader>
              <CardDescription>{t.titulo}</CardDescription>
              <CardAction>
                <ArrowUpRight className="size-4" />
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-3xl leading-none tracking-tight tabular-nums">{t.valor}</span>
              </div>
              <p className="text-sm">
                {t.fuerte != null && (
                  <>
                    <span className="text-foreground font-medium tabular-nums">{t.fuerte}</span>{" "}
                  </>
                )}
                <span className="text-muted-foreground">{t.texto}</span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

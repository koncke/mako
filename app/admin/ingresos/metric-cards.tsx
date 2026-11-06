// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// Admin › Revenue — las cuatro tarjetas (Studio Admin, MIT, src/app/(main)/dashboard/default/_components/metric-cards.tsx).
// Copiadas: la grilla, el ícono en su cajita, el título, el número grande, la insignia con la flecha y la nota. Lo que dice
// cada una sale de `tarjetasDe` (./revenue-vista.ts). Sin contra qué comparar, la insignia no se dibuja: un «+0%» no dice nada.

import { DollarSign, TrendingDown, TrendingUp, UserPlus, Users, Waves } from "lucide-react";

import { Badge } from "@/app/admin/_studio/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";

import type { Tarjeta } from "./revenue-vista";

const ICONO = { cobrado: DollarSign, nuevos: UserPlus, pagando: Users, mrr: Waves } as const;

export function MetricCards({ tarjetas }: { tarjetas: Tarjeta[] }) {
  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs xl:grid-cols-4">
      {tarjetas.map((t) => {
        const Icono = ICONO[t.id];
        return (
          <Card key={t.id}>
            <CardHeader>
              <CardTitle>
                <div className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-lg border">
                  <Icono className="size-4" />
                </div>
              </CardTitle>
              <CardDescription>{t.titulo}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-3xl leading-none font-medium tracking-tight tabular-nums">{t.valor}</div>
                {t.cambio ? (
                  <Badge variant={t.cambio.sube ? "default" : "destructive"}>
                    {t.cambio.sube ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    {t.cambio.texto}
                  </Badge>
                ) : null}
              </div>
              <p className="text-muted-foreground text-sm">{t.nota}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

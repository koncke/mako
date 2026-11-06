// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/finance/_components/overview-kpis.tsx.
// Las cuatro cifras de arriba, con las cuentas de MaKo (billing-vista.ts → cifrasDe).
import { Badge } from "@/app/admin/_studio/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import { cn } from "cn";

import type { Cifra } from "../billing-vista";

// Los bordes de la grilla de Studio, celda por celda (dos por fila en pantallas anchas).
const BORDES = [
  "border-b xl:border-r",
  "border-b",
  "xl:border-r",
  "",
];

export function OverviewKpis({ cifras }: { cifras: Cifra[] }) {
  return (
    <div className="bg-card ring-foreground/10 overflow-hidden rounded-xl ring-1">
      <div className="grid grid-cols-1 xl:grid-cols-8">
        {cifras.map((c, i) => (
          <Card key={c.id} className={cn("border-foreground/10 gap-5 overflow-hidden rounded-none border-0 ring-0 xl:col-span-4", BORDES[i])}>
            <CardHeader>
              <CardTitle className="font-normal">{c.titulo}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end justify-between">
              <div className="flex flex-col gap-1">
                <div className="text-3xl leading-none tracking-tight">{c.valor}</div>
                <p className="text-muted-foreground text-xs">{c.detalle}</p>
              </div>
              {c.insignia &&
                (c.insignia.mala ? (
                  <Badge variant="destructive" className="bg-destructive/10 text-destructive">
                    {c.insignia.texto}
                  </Badge>
                ) : (
                  <Badge className="bg-green-500/10 text-green-700 dark:bg-green-500/15 dark:text-green-300">{c.insignia.texto}</Badge>
                ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

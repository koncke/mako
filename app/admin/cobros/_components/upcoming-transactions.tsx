// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/finance/_components/upcoming-transactions.tsx.
// «Upcoming Bills & Payments» de Studio → lo que vence en 31 días (y lo atrasado, primero), cada uno a la ficha de su cliente.
import { ChevronRight, Zap } from "lucide-react";

import Link from "@/app/_ui/Link";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/app/admin/_studio/components/ui/item";
import { getInitials } from "@/app/admin/_studio/lib/utils";

import { fechaCorta, type Proximo, usd } from "../billing-vista";

const VISIBLES = 4;

export function UpcomingTransactions({ proximos }: { proximos: Proximo[] }) {
  const vence = proximos.filter((p) => !p.atrasado);
  const atrasado = proximos.filter((p) => p.atrasado).reduce((a, p) => a + p.usd, 0);
  const total = vence.reduce((a, p) => a + p.usd, 0);
  const [entero, centavos] = total.toFixed(2).split(".");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Vence en 31 días</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="flex items-baseline text-3xl leading-none tracking-tight">
              <span className="font-normal">US$ {Number(entero).toLocaleString("es-AR")}</span>
              <span className="text-muted-foreground text-xl">,{centavos}</span>
            </h2>
            <p className="text-muted-foreground text-sm leading-none">
              <span className="text-foreground font-medium">{vence.length}</span> {vence.length === 1 ? "cobro vence" : "cobros vencen"} en los
              próximos 31 días
            </p>
          </div>
          {atrasado > 0 && (
            <div className="border-border bg-muted/70 flex w-max items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
              <Zap className="fill-primary text-primary size-4" />
              <span className="text-muted-foreground">
                Atrasado: <span className="text-foreground font-medium">{usd(Math.round(atrasado * 100) / 100)}</span>
              </span>
            </div>
          )}
        </div>

        <ItemGroup>
          {proximos.slice(0, VISIBLES).map((p) => {
            const contenido = (
              <>
                <ItemMedia>
                  <div className="bg-background grid size-9 place-items-center rounded-md border text-xs font-medium">
                    {getInitials(p.nombre).slice(0, 2)}
                  </div>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {p.nombre} · {usd(p.usd)}
                  </ItemTitle>
                  <ItemDescription className={p.atrasado ? "text-destructive" : undefined}>
                    {p.atrasado ? `Venció el ${fechaCorta(p.fecha)}` : `Vence el ${fechaCorta(p.fecha)}`}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ChevronRight className="text-muted-foreground size-5" />
                </ItemActions>
              </>
            );
            return p.ruta ? (
              <Item key={`${p.clave}:${p.fecha}`} variant="outline" size="xs" asChild>
                <Link prefetch={false} href={p.ruta}>
                  {contenido}
                </Link>
              </Item>
            ) : (
              <Item key={`${p.clave}:${p.fecha}`} variant="outline" size="xs">
                {contenido}
              </Item>
            );
          })}
          {proximos.length > VISIBLES && (
            <Link prefetch={false} href="/admin?tab=revenue" className="text-muted-foreground px-1 text-xs hover:underline">
              Y {proximos.length - VISIBLES} más en Revenue
            </Link>
          )}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}

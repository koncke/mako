// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/crm/_components/task-reminders.tsx.
// «Upcoming Meetings» → el cliente más nuevo de los últimos 30 días, sobre su línea de tiempo (el bloque abre su ficha);
// «View Calendar» → Accounts, donde se dan las altas. «Monthly Proposal Goal» → cuántos terminaron su configuración, con las
// mismas 42 barritas (../customers-vista.ts, `lineaDeNuevos` y `configuracionTerminada`).

import { cn } from "cn";
import { CalendarRange, UsersRound } from "lucide-react";

import Link from "@/app/_ui/Link";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";

import { destinoCliente, type LineaNuevos, seSumoTxt } from "../customers-vista";

const barrasTotal = 42;

export function TaskReminders({ nuevos, configuracion }: {
  nuevos: LineaNuevos;
  configuracion: { hechos: number; conocidos: number; pct: number } | null;
}) {
  const activas = configuracion ? Math.round((configuracion.hechos / configuracion.conocidos) * barrasTotal) : 0;
  const barras = Array.from({ length: barrasTotal }, (_, index) => ({ id: `config-${index + 1}`, active: index < activas }));
  const u = nuevos.ultimo;
  const izquierda = u ? Math.min(Math.max(u.pos, 0), 56) : 0;

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-8">
        <CardHeader>
          <CardTitle>Nuevos en 30 días</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <Link href="/admin?tab=accounts">
                <UsersRound data-icon="inline-start" />
                Abrir Accounts
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center justify-between text-xs tabular-nums">
              {nuevos.marcas.map((m) => (
                <div key={m} className="flex flex-col items-center gap-1">
                  <span>{m}</span>
                  <span className="bg-border h-2 w-px" />
                </div>
              ))}
            </div>

            <div className="relative h-14">
              <div className="bg-border/80 absolute inset-x-3 top-1/2 h-px -translate-y-1/2" />
              {u ? (
                <Link
                  href={destinoCliente("ficha", u.ws)}
                  className="bg-primary text-primary-foreground absolute top-2 bottom-2 flex w-[44%] items-center rounded-lg px-2 shadow-sm"
                  style={{ left: `${izquierda}%` }}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="bg-background text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
                      <CalendarRange className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-primary-foreground truncate text-xs leading-none font-medium">{u.nombre}</div>
                      <div className="text-primary-foreground/75 truncate text-[10px]">
                        {seSumoTxt(u.dias)} · {u.plan}
                        {nuevos.total > 1 ? ` · y ${nuevos.total - 1} más` : ""}
                      </div>
                    </div>
                  </div>
                </Link>
              ) : (
                <p className="text-muted-foreground absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs">
                  <span className="bg-card px-2">Nadie se sumó en los últimos 30 días.</span>
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-4">
        <CardHeader>
          <CardTitle>Configuración terminada</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <div className="flex items-end justify-between gap-3">
            <div className="text-2xl leading-none font-medium tabular-nums">
              {configuracion ? configuracion.hechos : "—"} <span className="text-muted-foreground text-base font-normal">terminaron</span>
            </div>
            <div className="text-muted-foreground text-sm tabular-nums">{configuracion ? `${configuracion.conocidos} clientes` : ""}</div>
          </div>
          <div className="flex h-10 w-full items-end gap-0.5">
            {barras.map((bar) => (
              <div key={bar.id} className="flex flex-1 justify-center">
                <div className={cn("h-10 w-1.5 rounded-full", bar.active ? "bg-muted-foreground/75" : "bg-muted-foreground/25")} />
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            {configuracion ? `${configuracion.pct}% de los clientes terminó su configuración.` : "No pude leer las configuraciones."}
          </p>
        </CardContent>
      </Card>
    </section>
  );
}

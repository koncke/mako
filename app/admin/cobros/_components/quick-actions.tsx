// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/finance/_components/quick-actions.tsx.
"use client";

// «Quick Transfer» de Studio → «Vender un plan»: el monto y «Vender», que abre el diálogo con el resto (los avatares son los
// últimos que compraron). «Shortcuts» → los atajos de Billing, cada uno a algo que existe.

import * as React from "react";

import { Banknote, ChartLine, ChevronRight, Eye, FileText, History, Plug, Receipt, Settings2 } from "lucide-react";

import Link from "@/app/_ui/Link";
import { Avatar, AvatarFallback } from "@/app/admin/_studio/components/ui/avatar";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import { Field } from "@/app/admin/_studio/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/app/admin/_studio/components/ui/input-group";
import { getInitials } from "@/app/admin/_studio/lib/utils";

type Atajo = { id: string; label: string; icon: React.ComponentType<{ className?: string }> } & ({ href: string; externo?: boolean } | { onClick: () => void });

export function QuickActions({ compradores, puedeVender, wsPlataforma, onVender, onAjustes, onVista }: {
  /** Los nombres de los últimos que compraron (sus iniciales van en la cabecera). */
  compradores: string[];
  /** Sin pasarela no se vende: el campo y el botón se apagan. */
  puedeVender: boolean;
  wsPlataforma: number;
  onVender: (monto: string) => void;
  onAjustes: () => void;
  onVista: (vista: "cobros" | "recibos") => void;
}) {
  const [monto, setMonto] = React.useState("");

  const atajos: Atajo[] = [
    { id: "vender", label: "Vender", icon: Banknote, onClick: () => (puedeVender ? onVender("") : onAjustes()) },
    { id: "cargar", label: "Cargar pago", icon: Receipt, href: "/admin?tab=billing&recibo=nuevo" },
    { id: "cobros", label: "Cobros", icon: History, onClick: () => onVista("cobros") },
    { id: "recibos", label: "Recibos", icon: FileText, onClick: () => onVista("recibos") },
    { id: "ajustes", label: "Ajustes", icon: Settings2, onClick: onAjustes },
    { id: "revenue", label: "Revenue", icon: ChartLine, href: "/admin?tab=revenue" },
    // El `?ws=` explícito: la pestaña del super admin puede estar mirando a un cliente (la pasarela es la de MaKo).
    { id: "integraciones", label: "Pasarelas", icon: Plug, href: `/integraciones?ws=${wsPlataforma}` },
    { id: "ejemplo", label: "Ver recibo", icon: Eye, href: "/api/admin/recibos/ejemplo", externo: true },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-normal">Vender un plan</CardTitle>
          {compradores.length > 0 && (
            <CardAction>
              <button type="button" className="flex items-center gap-1" onClick={() => onVista("cobros")} aria-label="Ver los cobros">
                <div className="flex -space-x-2">
                  {compradores.slice(0, 4).map((n, i) => (
                    <Avatar key={`${n}-${i}`} className="border-background size-7 border-2">
                      <AvatarFallback className="text-[10px]">{getInitials(n).slice(0, 2)}</AvatarFallback>
                    </Avatar>
                  ))}
                </div>
                <ChevronRight className="size-4" />
              </button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <Field orientation="horizontal">
            <InputGroup>
              <InputGroupAddon>
                <InputGroupText>US$</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                placeholder="0.00"
                inputMode="decimal"
                value={monto}
                disabled={!puedeVender}
                onChange={(e) => setMonto(e.target.value)}
                aria-label="Monto"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText>USD</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <Button disabled={!puedeVender} onClick={() => onVender(monto)}>
              Vender
            </Button>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">Atajos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            {atajos.map((a) => {
              const Icon = a.icon;
              return (
                <div key={a.id} className="flex flex-col items-center gap-2.5">
                  {"href" in a ? (
                    <Button variant="outline" className="size-12 rounded-full" asChild>
                      {a.externo ? (
                        <a href={a.href} target="_blank" rel="noopener noreferrer" aria-label={a.label}>
                          <Icon className="size-5" />
                        </a>
                      ) : (
                        <Link prefetch={false} href={a.href} aria-label={a.label}>
                          <Icon className="size-5" />
                        </Link>
                      )}
                    </Button>
                  ) : (
                    <Button variant="outline" className="size-12 rounded-full" onClick={a.onClick} aria-label={a.label}>
                      <Icon className="size-5" />
                    </Button>
                  )}
                  <span className="text-muted-foreground text-center text-xs">{a.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

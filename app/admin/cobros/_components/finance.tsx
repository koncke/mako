"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/finance/page.tsx.

// =============================================================================
// Admin › Billing — la página de finanzas de Studio Admin, con los cobros de MaKo (6/11/2026)
// =============================================================================
// El mismo orden de Studio: el título con la fecha, sus tres pestañas (Dashboard, Accounts y Transactions → Resumen, Cobros y
// Recibos) y, en la primera, sus tres filas de tarjetas. «Settings» abre los ajustes de cobro y «Export» baja lo cobrado.
// La pestaña viaja en `?vista=` (un link copiado abre la misma). Lo que Studio trae y MaKo no tiene («Updated 5 min ago»), se
// sacó: docs/relevo/nube-admin-copia.md.

import * as React from "react";

import { Download, Settings2 } from "lucide-react";

import { Button } from "@/app/admin/_studio/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/admin/_studio/components/ui/tabs";
import { bajarCsv } from "@/app/admin/_studio/lib/exportar";
import type { PrecioClienteAgencia } from "@/lib/agencia-cobro-reglas";
import type { Entrada, PorCobrar } from "@/lib/admin-ingresos-reglas";
import type { Pasarela } from "@/lib/cobros-tipos";
import type { Emisor } from "@/lib/recibos-reglas";

import type { CobroMako, PrecioLocalPlan } from "../actions";
import { type Aviso, type Cifra, nombreMedio, type Porcion, type Proximo } from "../billing-vista";
import type { DatosRecibos } from "../recibos-actions";
import { Ajustes } from "./ajustes";
import { BalanceDistributionCard } from "./balance-distribution-card";
import { CobrosTable } from "./cobros-table";
import { FinanceNotification } from "./finance-notification";
import { IncomeBreakdown } from "./income-breakdown";
import { OverviewKpis } from "./overview-kpis";
import { QuickActions } from "./quick-actions";
import { RecibosTable } from "./recibos-table";
import { TransactionsOverviewCard } from "./transactions-overview-card";
import { UpcomingTransactions } from "./upcoming-transactions";
import { VenderPlan } from "./vender-plan";
import { Wallet } from "./wallet";

export const VISTAS_BILLING = ["resumen", "cobros", "recibos"] as const;
export type VistaBilling = (typeof VISTAS_BILLING)[number];

export type DatosFinance = {
  fecha: string;
  hoy: string;
  vista: VistaBilling;
  wsPlataforma: number;
  /** Lo de Revenue que usa el resumen. null = no se pudo leer (el resumen lo dice; Cobros y Recibos andan igual). */
  resumen: {
    cifras: Cifra[];
    comoEntra: Porcion[];
    aviso: Aviso | null;
    entradas: Entrada[];
    porCobrar: PorCobrar[];
    proximos: Proximo[];
  } | null;
  errorResumen: React.ReactNode;
  pasarelas: Pasarela[];
  cobros: CobroMako[];
  truncado: boolean;
  recibos: DatosRecibos;
  locales: { moneda: string | null; planes: PrecioLocalPlan[] } | null;
  precio: PrecioClienteAgencia | null;
  emisor: Emisor | null;
  waSolo: boolean;
};

export function Finance(d: DatosFinance) {
  const [vista, setVista] = React.useState<VistaBilling>(d.vista);
  const [ajustes, setAjustes] = React.useState(false);
  const [vender, setVender] = React.useState<{ abierto: boolean; monto: string }>({ abierto: false, monto: "" });

  function cambiarVista(v: string) {
    const nueva = (VISTAS_BILLING as readonly string[]).includes(v) ? (v as VistaBilling) : "resumen";
    setVista(nueva);
    // La pestaña queda en la URL, sin recargar y sin tocar el resto de la query (el `?ws=` si lo hay).
    const url = new URL(window.location.href);
    if (nueva === "resumen") url.searchParams.delete("vista");
    else url.searchParams.set("vista", nueva);
    window.history.replaceState(window.history.state, "", url);
  }

  function exportar() {
    bajarCsv("lo-cobrado-por-mako.csv", [
      ["Fecha", "Cliente", "Medio", "Cada cuánto", "USD"],
      ...(d.resumen?.entradas ?? [])
        .slice()
        .reverse()
        .map((e) => [e.fecha, e.nombre, nombreMedio(e.medio), e.recurrente ? "Todos los meses" : "Una vez", e.usd ?? "sin valor en dólares"]),
    ]);
  }

  const compradores = d.cobros.filter((c) => c.estado === "pagado").map((c) => c.nombre ?? c.email ?? "").filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">Billing</h1>
        <p className="text-muted-foreground text-sm first-letter:uppercase">{d.fecha}</p>
      </div>

      <Tabs value={vista} onValueChange={cambiarVista} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="cobros">Cobros</TabsTrigger>
            <TabsTrigger value="recibos">Recibos</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" onClick={() => setAjustes(true)}>
              <Settings2 />
              Ajustes
            </Button>
            <Button size="sm" variant="outline" onClick={exportar} disabled={!d.resumen?.entradas.length}>
              <Download data-icon="inline-start" />
              Exportar
            </Button>
          </div>
        </div>

        <TabsContent value="resumen" className="flex flex-col gap-4">
          {d.resumen ? (
            <>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="xl:col-span-6">
                  <OverviewKpis cifras={d.resumen.cifras} />
                </div>

                <div className="flex flex-col gap-4 xl:col-span-6">
                  <IncomeBreakdown porciones={d.resumen.comoEntra} />
                  <FinanceNotification aviso={d.resumen.aviso} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="xl:col-span-7">
                  <TransactionsOverviewCard entradas={d.resumen.entradas} porCobrar={d.resumen.porCobrar} hoy={d.hoy} />
                </div>
                <div className="xl:col-span-5">
                  <BalanceDistributionCard entradas={d.resumen.entradas} hoy={d.hoy} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                <div className="xl:col-span-4">
                  <Wallet pasarelas={d.pasarelas} entradas={d.resumen.entradas} hoy={d.hoy} />
                </div>
                <div className="xl:col-span-4">
                  <UpcomingTransactions proximos={d.resumen.proximos} />
                </div>
                <div className="xl:col-span-4">
                  <QuickActions
                    compradores={compradores}
                    puedeVender={d.pasarelas.length > 0}
                    wsPlataforma={d.wsPlataforma}
                    onVender={(monto) => setVender({ abierto: true, monto })}
                    onAjustes={() => setAjustes(true)}
                    onVista={cambiarVista}
                  />
                </div>
              </div>
            </>
          ) : (
            d.errorResumen
          )}
        </TabsContent>

        <TabsContent value="cobros">
          <CobrosTable cobros={d.cobros} truncado={d.truncado} />
        </TabsContent>

        <TabsContent value="recibos">
          <RecibosTable inicial={d.recibos} hoy={d.hoy} />
        </TabsContent>
      </Tabs>

      <Ajustes
        abierto={ajustes}
        onAbierto={setAjustes}
        locales={d.locales}
        precio={d.precio}
        conMercadoPago={d.pasarelas.includes("mercadopago")}
        emisor={d.emisor}
        waSolo={d.waSolo}
      />
      {d.pasarelas.length > 0 && (
        <VenderPlan abierto={vender.abierto} onAbierto={(v) => setVender((x) => ({ ...x, abierto: v }))} pasarelas={d.pasarelas} montoInicial={vender.monto} />
      )}
    </div>
  );
}

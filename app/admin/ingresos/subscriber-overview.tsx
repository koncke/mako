"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.

// Admin › Revenue — la tarjeta de los clientes (Studio Admin, MIT, dashboard/default/_components/subscriber-overview.tsx).
// Copiada: el título con el número, la bajada, «Export» arriba a la derecha y la tabla. «Export» baja un CSV (en Studio
// no hace nada): lo elegido, o todos sin nada elegido.

import { Download } from "lucide-react";

import { Button } from "@/app/admin/_studio/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/admin/_studio/components/ui/card";
import { bajarCsv } from "@/app/admin/_studio/lib/exportar";

import { RecentCustomersTable } from "./recent-customers-table/table";
import type { FilaCliente } from "./revenue-vista";

export function SubscriberOverview({ clientes, hoy }: { clientes: FilaCliente[]; hoy: string }) {
  const exportar = () =>
    bajarCsv("clientes-de-mako.csv", [
      ["Cliente", "Referencia", "Estado", "Cobro", "MRR (US$)", "Pagó en total (US$)", "Primer pago", "Último pago"],
      ...clientes.map((c) => [c.name, c.ref, c.status, c.billing, c.mrr, c.totalUsd, c.joined, c.ultimo]),
    ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">
          {clientes.length} {clientes.length === 1 ? "cliente" : "clientes"}
        </CardTitle>
        <CardDescription>Lo que pagó cada uno, si está al día y su primer pago.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm" onClick={exportar}>
            <Download />
            Exportar
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <RecentCustomersTable data={clientes} hoy={hoy} />
      </CardContent>
    </Card>
  );
}

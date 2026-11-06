// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// =============================================================================
// Admin › Revenue — Studio Admin (MIT), src/app/(main)/dashboard/default/page.tsx (5/11/2026)
// =============================================================================
// Martín: «no se me refleja la cantidad de ingresos para suscripciones. ¿Cuánto es lo que me pagaron totalmente? ¿Cuánto
// me van pagando mes a mes?». Y el 5/11: «Revenue = dashboard/default: las cuatro tarjetas, el gráfico «Customer
// Activity» y la tabla de clientes con Status, Billing, Plan y Joined». Es esa página, en ese orden, con las cuentas de
// siempre (`vistaDeIngresos`, lib/admin-ingresos.ts) puestas en sus piezas por ./revenue-vista.ts.
//
// Lo que tenía la pantalla de antes y Studio no trae (los movimientos de cada mes, lo que viene a cobrar, los últimos
// pagos) no se dibuja acá: lo que viene y los pagos van a Billing, que es dashboard/finance y sí tiene esas piezas. La
// lista entera, en docs/relevo/nube-admin-copia.md («no está en la fuente»).

import { ReceiptText } from "lucide-react";

import Link from "@/app/_ui/Link";
import { ReportarASoporte } from "@/app/_ui/ReportarASoporte";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/app/admin/_studio/components/ui/empty";
import type { VistaIngresos } from "@/lib/admin-ingresos";

import { mesesVisibles } from "./ingresos-vista";
import { MetricCards } from "./metric-cards";
import { PerformanceOverview } from "./performance-overview";
import { filasDeClientes, puntosDe, tarjetasDe } from "./revenue-vista";
import { SubscriberOverview } from "./subscriber-overview";

export function Revenue({ vista }: { vista: VistaIngresos }) {
  const clientes = filasDeClientes(vista.clientes);
  const avisos = vista.avisos.length ? (
    <div role="alert" className="border-destructive/30 bg-destructive/5 text-destructive flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm">
      <span className="flex-1">No pude leer {vista.avisos.join(" y ")}: lo que ves puede quedarse corto.</span>
      <ReportarASoporte />
    </div>
  ) : null;

  if (!clientes.length) {
    return (
      <div className="@container/main flex flex-col gap-4 md:gap-6">
        {avisos}
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptText />
            </EmptyMedia>
            <EmptyTitle>Todavía no entró ningún pago</EmptyTitle>
            <EmptyDescription>Cuando cargues el pago de un cliente en su ficha del CRM, sale aquí.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild size="sm">
              <Link prefetch={false} href="/admin?tab=billing">Vender un plan</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    );
  }

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      {avisos}
      <MetricCards tarjetas={tarjetasDe(vista)} />
      <PerformanceOverview puntos={puntosDe(mesesVisibles(vista.meses))} hoy={vista.hoy} />
      <SubscriberOverview clientes={clientes} hoy={vista.hoy} />
    </div>
  );
}

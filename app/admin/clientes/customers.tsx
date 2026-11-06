// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/crm/page.tsx.
// =============================================================================
// Admin › Customers — los negocios de MaKo con la pantalla CRM de Studio Admin, y la ficha de cada uno con su perfil (6/11/2026)
// =============================================================================
// Reemplaza a app/customers/CustomersApp.tsx (la lista de ProfitWell y Baremetrics). Los datos son los de siempre
// (`vistaDeClientes`, lib/clientes-plataforma.ts) y lo que cada pieza dice sale de ./customers-vista.ts. Con `?cliente=<ws>`,
// la ficha de ese negocio (./perfil/profile.tsx) en lugar de la lista.
//
// ⚠️ EL GUARD LO PONE QUIEN LA MONTA (app/admin/page.tsx: `getSesionAdmin`): esto cruza todos los negocios a propósito.
// ⚠️ UN DATO QUE NO SE PUDO LEER SE DICE ARRIBA (`vista.avisos`), y en su lugar va «—», nunca un cero.

import { CircleAlert } from "lucide-react";

import { ReportarASoporte } from "@/app/_ui/ReportarASoporte";
import { ErrorSeccion } from "@/app/admin/_studio/error-seccion";
import type { VistaClientes } from "@/lib/clientes-plataforma";

import { configuracionTerminada, filasDeTabla, lineaDeNuevos, pagoDeActivos, tarjetasKpi } from "./customers-vista";
import { KpiCards } from "./_components/kpi-cards";
import { OpportunitiesSection } from "./_components/opportunities-section";
import { PipelineActivity } from "./_components/pipeline-activity";
import { TaskReminders } from "./_components/task-reminders";
import { Profile } from "./perfil/profile";

export function Customers({ vista, cliente, ahoraMs }: { vista: VistaClientes; cliente: number | null; ahoraMs: number }) {
  const aviso = vista.avisos.length > 0 && (
    // El `Alert` de Studio (src/components/ui/alert.tsx), con sus clases, y «Reportar a Soporte» como todo aviso de error.
    <div role="alert" className="bg-card text-card-foreground grid w-full grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-lg border px-2.5 py-2 text-left text-sm">
      <CircleAlert className="row-span-2 size-4 translate-y-0.5" />
      <div className="font-medium">Falta un dato</div>
      <div className="text-muted-foreground">No pude leer {vista.avisos.map((a) => a.split(":")[0]).join(", ")}. Lo demás es real.</div>
      <ReportarASoporte error={`Admin › Customers: ${vista.avisos.join(" · ")}`} style={{ gridColumnStart: 2, paddingTop: 4 }} />
    </div>
  );

  if (cliente != null) {
    const f = vista.filas.find((x) => x.ws === cliente);
    if (!f) return <ErrorSeccion titulo="Ese negocio no está" detalle={`No hay un negocio ${cliente} entre tus clientes.`} href="/admin?tab=customers" />;
    const motivo = vista.paraMirar.find((p) => p.ws === cliente)?.texto ?? null;
    return (
      <div className="flex flex-col gap-4" data-content-padding="false">
        {aviso && <div className="px-4 pt-4">{aviso}</div>}
        <Profile f={f} motivo={motivo} actividadLeida={vista.actividadLeida} ahoraMs={ahoraMs} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      {aviso}
      <KpiCards tarjetas={tarjetasKpi(vista)} />
      <PipelineActivity cobrado={vista.cobrado} vencido={vista.vencido} pago={pagoDeActivos(vista.filas)} />
      <TaskReminders nuevos={lineaDeNuevos(vista.filas, ahoraMs)} configuracion={configuracionTerminada(vista.filas)} />
      <OpportunitiesSection filas={filasDeTabla(vista)} />
    </div>
  );
}

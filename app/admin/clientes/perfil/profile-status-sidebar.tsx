// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/profile/_components/profile-status-sidebar.tsx.
// «Record status» → su estado y la última vez que entró alguien; «Upcoming events» → lo que viene (un pago esperando, el fin de
// lo gratis, su primer mes al 50%), de ../customers-vista.ts (`loQueViene`).

import { CalendarDays, CircleAlert, CircleCheck } from "lucide-react";

import { Separator } from "@/app/admin/_studio/components/ui/separator";
import type { FilaCliente } from "@/lib/clientes-plataforma";
import { estadoEnUnaPalabra, ultimaVezTxt } from "@/lib/clientes-plataforma-reglas";

import { loQueViene } from "../customers-vista";

export function ProfileStatusSidebar({ f, motivo, actividadLeida }: { f: FilaCliente; motivo: string | null; actividadLeida: boolean }) {
  const e = estadoEnUnaPalabra(f);
  const viene = loQueViene(f);
  const Icono = e.tono === "good" || e.tono === "info" ? CircleCheck : CircleAlert;
  return (
    <aside>
      <div className="flex flex-col gap-4">
        <h2 className="font-heading text-sm font-medium">Estado</h2>
        <div className="flex items-start gap-2">
          <Icono aria-hidden="true" className="text-muted-foreground mt-0.5 size-4" />
          <div>
            <p className="text-sm font-medium">{e.rotulo}</p>
            <p className="text-muted-foreground text-xs">{motivo ?? "Nada que mirar"}</p>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">Última vez: {actividadLeida ? ultimaVezTxt(f) : "—"}</p>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-3">
        <h2 className="font-heading text-sm font-medium">Lo que viene</h2>
        <div className="flex flex-col">
          {viene.length === 0 ? (
            <p className="text-muted-foreground py-2.5 text-xs">Nada pendiente.</p>
          ) : (
            viene.map((d, i) => (
              <div key={d.rotulo}>
                {i > 0 && <Separator />}
                <div className="flex gap-3 py-2.5">
                  <CalendarDays aria-hidden="true" className="text-muted-foreground mt-0.5 size-4" />
                  <div>
                    <p className="text-sm font-medium">{d.rotulo}</p>
                    <p className="text-muted-foreground text-xs">{d.valor}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/profile/_components/profile-time-off-details.tsx.
// La pestaña «Time off» → «Actividad»: cuándo entró alguien de su equipo, su último lead, sus leads, su agente y su
// configuración (../customers-vista.ts, `actividadDe`). «Upcoming and approvals» no va: lo que viene está en el costado.

import type { FilaCliente } from "@/lib/clientes-plataforma";

import { actividadDe } from "../customers-vista";
import { GrillaDatos } from "./grilla-datos";

export function TimeOffDetails({ f, actividadLeida }: { f: FilaCliente; actividadLeida: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="font-heading text-base font-medium">Su uso</h2>
      <GrillaDatos datos={actividadDe(f, actividadLeida)} />
    </div>
  );
}

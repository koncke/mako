// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/profile/_components/profile-overview.tsx.
// «About» → cómo está; «Work details» → sus datos; «Reporting line» (su jefe) → su agencia, sólo si es cliente de una. El botón
// «Org chart» no va: MaKo no tiene un organigrama de agencias y clientes.

import { Avatar, AvatarFallback } from "@/app/admin/_studio/components/ui/avatar";
import { Separator } from "@/app/admin/_studio/components/ui/separator";
import { getInitials } from "@/app/admin/_studio/lib/utils";
import type { FilaCliente } from "@/lib/clientes-plataforma";

import { comoEstaTxt, datosDeResumen } from "../customers-vista";
import { GrillaDatos } from "./grilla-datos";

export function ProfileOverview({ f, motivo, ahoraMs }: { f: FilaCliente; motivo: string | null; ahoraMs: number }) {
  const deAgencia = f.segmentos.includes("de-agencia");
  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-medium">Cómo está</h2>
        <p className="text-muted-foreground text-sm">{comoEstaTxt(f, motivo)}</p>
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-medium">Datos</h2>
        <GrillaDatos datos={datosDeResumen(f, ahoraMs)} />
      </div>

      {deAgencia && (
        <>
          <Separator className="my-4" />
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-heading text-base leading-none font-medium">Su agencia</h2>
              <p className="text-muted-foreground text-sm">Lo atiende su agencia, con su propia cuenta.</p>
            </div>
            <div className="flex items-center gap-3 py-3">
              <Avatar size="lg">
                <AvatarFallback>{getInitials(f.agencia ?? "Agencia").slice(0, 2)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{f.agencia ?? "Una agencia"}</p>
                <p className="text-muted-foreground text-xs">Agencia</p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}

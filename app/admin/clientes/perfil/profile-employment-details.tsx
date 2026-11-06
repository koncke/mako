// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/profile/_components/profile-employment-details.tsx.
// La pestaña «Employment» → «Plan y cobro»: «Role and organization» → su plan y lo que paga; «Contract details» → su cobro.
// «Work arrangement» (lugar, horario, horas) no va: un negocio no tiene esos datos.

import { Separator } from "@/app/admin/_studio/components/ui/separator";
import type { FilaCliente } from "@/lib/clientes-plataforma";

import { datosDeCobro, datosDePlan } from "../customers-vista";
import { GrillaDatos } from "./grilla-datos";

export function EmploymentDetails({ f }: { f: FilaCliente }) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-medium">Su plan</h2>
        <GrillaDatos datos={datosDePlan(f)} />
      </div>

      <Separator className="my-4" />

      <div className="flex flex-col gap-2">
        <h2 className="font-heading text-base font-medium">Su cobro</h2>
        <GrillaDatos datos={datosDeCobro(f)} />
      </div>
    </>
  );
}

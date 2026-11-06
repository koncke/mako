// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/profile/_components/profile-header.tsx.
// La cabecera de la ficha de un negocio. El anillo de «92% Complete» → su configuración (lleno si la terminó; vacío si no o si
// no se pudo leer); las insignias → su estado en una palabra, su plan, su grupo y desde cuándo es cliente. Los botones:
// «Email» → «Administrar» (Accounts: su plan, su equipo y su acceso) y «Edit profile» → «Entrar a su cuenta», la acción
// principal. El menú «⋯» de Studio («View as employee», «Deactivate profile») no va: entrar ya es el botón de al lado, y
// pausar o borrar una cuenta se hace en Accounts.

import { BadgeCheck, LogIn, Pencil } from "lucide-react";

import Link from "@/app/_ui/Link";
import { Avatar, AvatarFallback } from "@/app/admin/_studio/components/ui/avatar";
import { Badge } from "@/app/admin/_studio/components/ui/badge";
import { Button } from "@/app/admin/_studio/components/ui/button";
import { getInitials } from "@/app/admin/_studio/lib/utils";
import type { FilaCliente } from "@/lib/clientes-plataforma";
import { estadoEnUnaPalabra, nombreDePlan } from "@/lib/clientes-plataforma-reglas";

import { destinoCliente, fechaLarga, grupoTxt } from "../customers-vista";

export function ProfileHeader({ f }: { f: FilaCliente }) {
  const e = estadoEnUnaPalabra(f);
  const lleno = f.onboardingHecho === true ? 100 : 0;
  return (
    <div className="flex flex-col gap-5 px-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="grid size-18 shrink-0 place-items-center sm:size-23">
          <span className="sr-only">{f.onboardingHecho === true ? "Terminó su configuración" : "No terminó su configuración"}</span>
          <svg aria-hidden="true" className="col-start-1 row-start-1 size-full -rotate-90" viewBox="0 0 100 100">
            <circle
              className="fill-none stroke-green-500 dark:stroke-green-600"
              cx="50"
              cy="50"
              pathLength="100"
              r="46"
              strokeDasharray={`${lleno} 100`}
              strokeLinecap="round"
              strokeWidth="2.5"
            />
          </svg>
          <Avatar className="col-start-1 row-start-1 size-16 after:border-0 sm:size-20">
            <AvatarFallback>{getInitials(f.nombre).slice(0, 2)}</AvatarFallback>
          </Avatar>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-heading truncate text-xl leading-6 font-semibold tracking-tight sm:text-2xl sm:leading-7">{f.nombre}</h1>
            <p className="text-muted-foreground truncate text-sm leading-5">
              Negocio {f.ws} · {nombreDePlan(f.capa)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {f.onboardingHecho === false && (
              <Badge className="rounded-sm border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300" variant="secondary">
                Configuración sin terminar
              </Badge>
            )}
            {e.tono === "good" ? (
              <Badge className="rounded-sm bg-green-600 text-white" variant="default">
                <BadgeCheck data-icon="inline-start" />
                {e.rotulo}
              </Badge>
            ) : (
              <Badge
                className={
                  e.tono === "bad"
                    ? "border-destructive/20 bg-destructive/10 text-destructive rounded-sm"
                    : e.tono === "warn"
                      ? "rounded-sm border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "rounded-sm"
                }
                variant="secondary"
              >
                {e.rotulo}
              </Badge>
            )}
            <Badge className="rounded-sm" variant="outline">
              {grupoTxt(f)}
            </Badge>
            <Badge className="rounded-sm" variant="outline">
              Desde el {fechaLarga(f.creado)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button size="sm" asChild variant="outline">
          <Link href={destinoCliente("administrar", f.ws)}>
            <Pencil data-icon="inline-start" />
            Administrar
          </Link>
        </Button>
        <Button size="sm" asChild>
          {/* Navegación dura: entrar a la cuenta de otro cambia de negocio entero (su barra, su cromo). */}
          <a href={destinoCliente("entrar", f.ws)}>
            <LogIn data-icon="inline-start" />
            Entrar a su cuenta
          </a>
        </Button>
      </div>
    </div>
  );
}

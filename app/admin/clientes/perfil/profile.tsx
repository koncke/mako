// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN. Original: src/app/(main)/dashboard/profile/page.tsx.
// La ficha de un negocio (`/admin?tab=customers&cliente=<ws>`), con el layout del perfil de Studio: la miga de pan (que vuelve a
// Customers), la cabecera y las pestañas. Las seis de Studio → tres: Resumen (Overview, con su costado), Plan y cobro
// (Employment) y Actividad (Time off). Personal, Compensation y Documents no van: un negocio no tiene esos datos en MaKo.

import Link from "@/app/_ui/Link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/app/admin/_studio/components/ui/breadcrumb";
import { Separator } from "@/app/admin/_studio/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/admin/_studio/components/ui/tabs";
import type { FilaCliente } from "@/lib/clientes-plataforma";

import { EmploymentDetails } from "./profile-employment-details";
import { ProfileHeader } from "./profile-header";
import { ProfileOverview } from "./profile-overview";
import { ProfileStatusSidebar } from "./profile-status-sidebar";
import { TimeOffDetails } from "./profile-time-off-details";

export function Profile({ f, motivo, actividadLeida, ahoraMs }: { f: FilaCliente; motivo: string | null; actividadLeida: boolean; ahoraMs: number }) {
  return (
    <div className="flex flex-col gap-4 py-4" data-content-padding="false">
      <Breadcrumb className="px-4">
        <BreadcrumbList>
          <BreadcrumbItem>
            <span>Admin</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/admin?tab=customers">Customers</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <span>{f.nombre}</span>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Ficha</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <ProfileHeader f={f} />

      <Tabs className="min-h-0 flex-1 gap-0" defaultValue="resumen">
        <div className="touch-pan-x scrollbar-none overflow-x-auto overscroll-x-contain border-y">
          <TabsList className="w-max min-w-full justify-start gap-4 px-4 *:data-[slot=tabs-trigger]:flex-none" variant="line">
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="plan">Plan y cobro</TabsTrigger>
            <TabsTrigger value="actividad">Actividad</TabsTrigger>
          </TabsList>
        </div>

        <div className="px-4 md:px-6">
          <TabsContent value="resumen">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_auto_18rem]">
              <div className="py-4 lg:pr-6">
                <ProfileOverview f={f} motivo={motivo} ahoraMs={ahoraMs} />
              </div>
              <Separator className="hidden lg:block" orientation="vertical" />
              <div className="py-4 lg:pl-6">
                <ProfileStatusSidebar f={f} motivo={motivo} actividadLeida={actividadLeida} />
              </div>
            </div>
          </TabsContent>

          <TabsContent className="py-4" value="plan">
            <EmploymentDetails f={f} />
          </TabsContent>

          <TabsContent className="py-4" value="actividad">
            <TimeOffDetails f={f} actividadLeida={actividadLeida} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

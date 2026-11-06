// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// =============================================================================
// Admin (/admin) — el shell de Studio Admin: sidebar, cabecera y el lugar de cada sección (5/11/2026)
// =============================================================================
// Studio Admin (MIT), src/app/(main)/dashboard/layout.tsx y src/app/layout.tsx: el `SidebarProvider` con su ancho, el
// sidebar plegable a íconos, la cabecera pegada arriba con el botón del sidebar, la búsqueda, el modo y la cuenta, y el
// contenido centrado hasta `max-w-screen-2xl` con su relleno. Son las preferencias por defecto de Studio («sidebar»,
// «icon», «centered», «sticky», Geist). Lo de MaKo:
//   · todo va adentro de `.sa`, la raíz donde viven los tokens de Studio (studio-theme.css), con su contenedor de portales;
//   · el personalizador de la plantilla (los presets, las letras, el layout) y el menú de GitHub del autor no están: son de
//     la demo de Studio, no de un admin (la lista «no está en la fuente» del relevo);
//   · lo que se pega a la ventana descuenta la barra de «Viendo a X» (`--barra-agencia`, AGENTS.md).

import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { cn } from "cn";

import { Separator } from "@/app/admin/_studio/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/app/admin/_studio/components/ui/sidebar";
import { Toaster } from "@/app/admin/_studio/components/ui/sonner";
import { TooltipProvider } from "@/app/admin/_studio/components/ui/tooltip";
import { geistSa } from "@/app/admin/_studio/fonts";
import { ID_PORTAL_SA } from "@/app/admin/_studio/portal";

import { AccountSwitcher } from "./account-switcher";
import { AppSidebar } from "./app-sidebar";
import type { CuentaSa } from "./cuenta";
import { SearchDialog } from "./search-dialog";
import { ThemeSwitcher } from "./theme-switcher";

export async function AdminShell({ children, cuenta, esperan }: Readonly<{ children: ReactNode; cuenta: CuentaSa; esperan: string | null }>) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <div className={cn("sa min-w-0 flex-1", geistSa.variable)}>
      <TooltipProvider>
        <SidebarProvider
          defaultOpen={defaultOpen}
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 68)",
            } as React.CSSProperties
          }
        >
          <AppSidebar cuenta={cuenta} esperan={esperan} />
          <SidebarInset
            className={cn(
              "*:mx-auto *:w-full *:max-w-screen-2xl",
              "peer-data-[variant=inset]:border",
              "[--dashboard-header-height:--spacing(12)]",
              "min-w-0 overflow-x-clip",
            )}
          >
            <header
              className={cn(
                "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
                "bg-background/50 sticky top-[var(--barra-agencia,0px)] z-50 overflow-hidden rounded-t-[inherit] backdrop-blur-md",
              )}
            >
              <div className="flex w-full items-center justify-between px-4 lg:px-6">
                <div className="flex items-center gap-1 lg:gap-2">
                  <SidebarTrigger className="-ml-1" />
                  <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4 data-[orientation=vertical]:self-center"
                  />
                  <SearchDialog />
                </div>
                <div className="flex items-center gap-2">
                  <ThemeSwitcher />
                  <AccountSwitcher users={[{ id: "yo", name: cuenta.name, email: cuenta.email, avatar: cuenta.avatar, role: "Super admin" }]} />
                </div>
              </div>
            </header>
            {/* Pages can set data-content-padding="false" to render full-bleed app layouts. */}
            <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-4 has-data-[content-padding=false]:p-0 md:p-6 md:has-data-[content-padding=false]:p-0">{children}</div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster />
        <div id={ID_PORTAL_SA} />
      </TooltipProvider>
    </div>
  );
}

"use client";
// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.

// Studio Admin (MIT), src/app/(main)/dashboard/_components/sidebar/app-sidebar.tsx, copiado.
// MaKo: el sidebar va con las preferencias por defecto de Studio («sidebar», plegable a íconos) y sin el personalizador
// de la plantilla; el logo y el nombre son los de MaKo; la tarjeta del pie dice lo que espera a Martín.

import Link from "@/app/_ui/Link";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/app/admin/_studio/components/ui/sidebar";

import { AppLogo } from "./app-logo";
import type { CuentaSa } from "./cuenta";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { sidebarItems } from "./sidebar-items";
import { SupportCard } from "./support-card";

export function AppSidebar({
  cuenta,
  esperan,
  ...props
}: React.ComponentProps<typeof Sidebar> & { cuenta: CuentaSa; esperan: string | null }) {
  return (
    <Sidebar {...props} variant="sidebar" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link prefetch={false} href="/admin">
                <AppLogo />
                <span className="text-base font-semibold">MaKo Admin</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={sidebarItems} />
      </SidebarContent>
      <SidebarFooter>
        <SupportCard texto={esperan} />
        <NavUser user={cuenta} />
      </SidebarFooter>
    </Sidebar>
  );
}

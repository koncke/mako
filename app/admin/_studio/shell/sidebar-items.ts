// Aviso de licencia de Studio Admin (MIT): lib/avisos/LICENSE-STUDIO-ADMIN.
// =============================================================================
// Las secciones de Admin en el sidebar de Studio Admin (src/navigation/sidebar/sidebar-items.ts, MIT)
// =============================================================================
// Mismo tipo y mismos íconos que Studio: cada sección de MaKo lleva el ícono de la pantalla de Studio que porta
// (Revenue = Default, Billing = Finance, Customers = CRM, Activity = Analytics, Errors = Infrastructure, Users = Users).
// Los dos grupos son los de Studio («Dashboards» y «Pages»), en español. Las demás pantallas de Studio no son de MaKo.
//
// ⚠️ LA URL ES LA DE SIEMPRE (`/admin?tab=…`): está en marcadores, mails y avisos (AGENTS.md → «Retirar una RUTA»).
//    La sale de `rutaPestanaAdmin` (app/admin/pestanas-reglas.ts), nunca escrita a mano.

import { Banknote, ChartBar, Gauge, LayoutDashboard, type LucideIcon, Server, Users } from "lucide-react"

import { type PestanaBarra, rutaPestanaAdmin } from "@/app/admin/pestanas-reglas"

export type NavBadge = "new" | "updated" | "soon"

export interface NavSubItem {
  id: string
  title: string
  url: string
  icon?: LucideIcon
  badge?: NavBadge
  disabled?: boolean
  newTab?: boolean
}

interface NavItemBase {
  id: string
  title: string
  icon?: LucideIcon
  badge?: NavBadge
  disabled?: boolean
  newTab?: boolean
}

export interface NavMainLinkItem extends NavItemBase {
  url: string
  /** MaKo: la sección (`?tab=`) que marca el ítem como activo. Studio lo decide por la ruta; acá la ruta es una sola. */
  tab: PestanaBarra
  subItems?: never
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[]
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem

export interface NavGroup {
  id: string
  label?: string
  items: NavMainItem[]
}

const item = (tab: PestanaBarra, title: string, icon: LucideIcon): NavMainLinkItem => ({ id: tab, title, url: rutaPestanaAdmin(tab), icon, tab })

export const sidebarItems: NavGroup[] = [
  {
    id: "paneles",
    label: "Paneles",
    items: [
      item("revenue", "Revenue", LayoutDashboard),
      item("billing", "Billing", Banknote),
      item("customers", "Customers", ChartBar),
      item("activity", "Activity", Gauge),
      item("errors", "Errors", Server),
    ],
  },
  {
    id: "paginas",
    label: "Páginas",
    items: [item("users", "Users", Users)],
  },
]

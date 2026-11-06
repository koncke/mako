// =============================================================================
// /admin — la tab Admin del super admin, copiada del dashboard de Polar (polarsource/polar, Apache-2.0) (6/11/2026)
// =============================================================================
// Martín, 6/11/2026, textual: «borres todo… copia por completo… no es solamente el diseño, es también las
// funcionalidades… cómo distribuyen cada página… seas criterioso». La fuente es UNA: el dashboard de Polar
// (clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/), su layout, su barra y sus páginas, portadas archivo
// por archivo en app/admin/_polar (el porqué y lo que se sacó: docs/investigacion-admin.md y docs/relevo/nube-admin-polar.md).
//
// La barra de Polar, en el orden que pidió Martín: Overview · Customers · Analytics · Sales · Products · Finance · Settings.
// Sin la barra de arriba, el logo, el selector de organización ni la cuenta del pie: el perfil y el modo oscuro viven en
// la barra de MaKo, a la izquierda.
//
// ⚠️ Es un grupo de rutas (`(polar)`): las otras subrutas de /admin (/admin/dev, /admin/ui, /admin/approvals,
//    /admin/operaciones…) son otras tabs del super admin y NO llevan este layout.
// ⚠️ SÓLO EL SUPER ADMIN (app/admin/_polar/datos/guarda.ts), acá y en cada página.

import type { ReactNode } from 'react'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { indiceDeBusqueda } from '@/app/admin/_polar/datos/busqueda'
import { AdminShell } from '@/app/admin/_polar/AdminShell'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await exigirSuperAdmin()
  const indice = await indiceDeBusqueda().catch(() => ({ negocios: [], personas: [] }))
  return <AdminShell indice={indice}>{children}</AdminShell>
}

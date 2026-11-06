// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/layout.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// En Polar este layout es el permiso `analytics:read` (OrganizationPermissionGuard). En MaKo, Analytics cruza todos los
// negocios: SÓLO EL SUPER ADMIN. Cada página lo vuelve a preguntar antes de leer (al navegar adentro, el layout no corre).

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'

export default async function Layout({ children }: { children: React.ReactNode }) {
  await exigirSuperAdmin()
  return <>{children}</>
}

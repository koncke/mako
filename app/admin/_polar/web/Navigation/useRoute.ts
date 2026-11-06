'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Navigation/useRoute.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// Sin el contexto de la organización: Admin es una sola.

import { useDashboardRoutes } from '../Dashboard/navigation'

export const useRoute = () => {
  const dashboardRoutes = useDashboardRoutes(true)
  const currentRoute = dashboardRoutes.find((r) => r.isActive)
  const currentSubRoute = currentRoute?.subs?.find((r) => 'isActive' in r && r.isActive)
  return { currentRoute, currentSubRoute }
}

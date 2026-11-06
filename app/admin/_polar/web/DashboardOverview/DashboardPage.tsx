'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/(home)/DashboardPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Overview, la portada. La misma página de Polar: el título con sus «quick actions», los banners de lo que espera,
// dos filas de widgets y la sección Metrics. Es una vista PURA: todo llega armado por props desde app/admin/(polar)/page.tsx
// (así se puede capturar con app/admin/_polar/datos/ejemplo/resumen.ts). Lo que cambió, cada cosa con su porqué:
//   · el título: Polar pone el avatar y el nombre de la organización arriba de «Overview»; Admin es la plataforma (no hay
//     organización), así que queda «Overview» con las quick actions al lado;
//   · `PlanUpsell` (vender el plan de Polar) y `OrganizationStatusBanner` (el alta de la organización en Polar, su checklist
//     de onboarding) no son de MaKo: en su lugar van los banners de lo que espera a Martín (EsperaBanners.tsx);
//     `DisputesBanner` es el molde de esos banners;
//   · `AccountWidget` (el saldo de la cuenta de Polar y sus payouts) y `GrossMarginWidget` (ingresos menos costos
//     atribuibles) se sacaron sin dejar el hueco: MaKo no tiene una cuenta con saldo ni el costo de IA de la plataforma
//     atribuible por negocio (lib/costos-ia.ts). Cada fila queda con los dos widgets que hay, en dos columnas.

import { OverviewQuickActions } from '@/app/admin/_polar/web/DashboardOverview/OverviewQuickActions'
import { OverviewSection } from '@/app/admin/_polar/web/DashboardOverview/OverviewSection'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { ActivityWidget } from '@/app/admin/_polar/web/Widgets/ActivityWidget'
import RevenueWidget from '@/app/admin/_polar/web/Widgets/RevenueWidget'
import { CustomerRiskWidget } from '@/app/admin/_polar/web/Widgets/CustomerRiskWidget'
import { TopCustomersWidget } from '@/app/admin/_polar/web/Widgets/TopCustomersWidget'
import type { IndiceBusqueda } from '@/app/admin/_polar/datos/busqueda-tipos'
import type { ResumenAdmin } from '@/app/admin/_polar/datos/resumen'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { Children, PropsWithChildren } from 'react'
import { twMerge } from 'tailwind-merge'
import { EsperaBanners } from './EsperaBanners'

const cellClassName =
  'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200'

// Polar las arma de a tres (`lg:grid-cols-3`). Con los widgets que MaKo puede llenar, la fila mide lo que trae: sin una
// celda vacía. Las clases van escritas enteras (Tailwind no ve una clase armada con un número).
const COLUMNAS: Record<number, string> = { 1: 'lg:grid-cols-1', 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3' }

const WidgetRow = ({ children }: PropsWithChildren) => (
  <div className="dark:border-polar-700 overflow-hidden rounded-xl border border-gray-200">
    <div className={twMerge('-mr-px -mb-px grid grid-cols-1', COLUMNAS[Children.count(children)] ?? 'lg:grid-cols-3')}>
      {children}
    </div>
  </div>
)

const OverviewTitle = ({ indice }: { indice: IndiceBusqueda }) => (
  <Box alignItems="center" justifyContent="between" columnGap="m" flexGrow={1}>
    <Text as="h1" variant="heading-xs" weight="medium">
      Overview
    </Text>
    <OverviewQuickActions indice={indice} />
  </Box>
)

interface OverviewPageProps {
  resumen: ResumenAdmin
  indice: IndiceBusqueda
}

export default function OverviewPage({ resumen, indice }: OverviewPageProps) {
  return (
    <DashboardBody
      className="gap-y-8 md:gap-y-16"
      title={<OverviewTitle indice={indice} />}
    >
      <EsperaBanners esperan={resumen.esperan} avisos={resumen.avisos} />
      <div className="flex flex-col gap-y-10">
        <WidgetRow>
          <RevenueWidget className={cellClassName} ingresos={resumen.ingresos} />
          <ActivityWidget className={cellClassName} actividad={resumen.actividad} />
        </WidgetRow>
        <WidgetRow>
          <TopCustomersWidget className={cellClassName} top={resumen.top} />
          <CustomerRiskWidget className={cellClassName} riesgo={resumen.riesgo} />
        </WidgetRow>
      </div>

      <OverviewSection ingresos={resumen.ingresos} />
    </DashboardBody>
  )
}

'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/(home)/DashboardPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Overview, la portada. La misma página de Polar: el título con sus «quick actions», los banners de lo que espera,
// dos filas de widgets y la sección Metrics. Es una vista PURA: todo llega armado por props desde app/admin/(polar)/page.tsx
// (así se puede capturar con app/admin/_polar/datos/ejemplo/resumen.ts). Lo que cambió, cada cosa con su porqué:
//   · el título: Polar pone el avatar y el nombre de la organización arriba de «Overview»; Admin es la plataforma (no hay
//     organización), así que queda «Overview» con las quick actions al lado;
//   · `PlanUpsell` (vender el plan de Polar) y `OrganizationStatusBanner` (el alta de la organización en Polar, su checklist
//     de onboarding) no son de MaKo: en su lugar va lo que espera a Martín (EsperaBanners.tsx), UNA lista chica con una fila
//     por espera; el contracargo (el `DisputesBanner` de Polar) va primero (revisión del Cerebro del 6/11/2026, 28 y 38);
//   · `AccountWidget` («Available balance», el saldo de la cuenta de Polar y sus payouts) es «Por cobrar»: los próximos
//     cobros de MaKo (decidido el 6/11/2026: MaKo no tiene saldo para retirar, y sin esa tarjeta la grilla queda con un
//     hueco). `GrossMarginWidget` es «AI margin»: lo cobrado contra el gasto de IA por API de MaKo (el de toda la
//     plataforma: no se reparte por negocio), sin los costos fijos. Las dos filas son de tres, como en Polar, en su orden.

import { OverviewQuickActions } from '@/app/admin/_polar/web/DashboardOverview/OverviewQuickActions'
import { OverviewSection } from '@/app/admin/_polar/web/DashboardOverview/OverviewSection'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { AccountWidget } from '@/app/admin/_polar/web/Widgets/AccountWidget'
import { ActivityWidget } from '@/app/admin/_polar/web/Widgets/ActivityWidget'
import RevenueWidget from '@/app/admin/_polar/web/Widgets/RevenueWidget'
import { CustomerRiskWidget } from '@/app/admin/_polar/web/Widgets/CustomerRiskWidget'
import { GrossMarginWidget } from '@/app/admin/_polar/web/Widgets/GrossMarginWidget'
import { TopCustomersWidget } from '@/app/admin/_polar/web/Widgets/TopCustomersWidget'
import type { IndiceBusqueda } from '@/app/admin/_polar/datos/busqueda-tipos'
import type { ResumenAdmin } from '@/app/admin/_polar/datos/resumen'
import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { PropsWithChildren } from 'react'
import { EsperaBanners } from './EsperaBanners'

const cellClassName =
  'dark:border-polar-700 border-t-0 border-r border-b border-l-0 border-gray-200'

const WidgetRow = ({ children }: PropsWithChildren) => (
  <div className="dark:border-polar-700 overflow-hidden rounded-xl border border-gray-200">
    <div className="-mr-px -mb-px grid grid-cols-1 lg:grid-cols-3">
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
          <AccountWidget className={cellClassName} porCobrar={resumen.porCobrar} />
        </WidgetRow>
        <WidgetRow>
          <TopCustomersWidget className={cellClassName} top={resumen.top} />
          <CustomerRiskWidget className={cellClassName} riesgo={resumen.riesgo} />
          <GrossMarginWidget className={cellClassName} margen={resumen.margen} />
        </WidgetRow>
      </div>

      <OverviewSection ingresos={resumen.ingresos} />
    </DashboardBody>
  )
}

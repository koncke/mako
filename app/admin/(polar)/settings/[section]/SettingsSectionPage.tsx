'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/settings/[section]/SettingsSectionPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ LO QUE SE SACÓ: las secciones de Polar que MaKo no llena (web/Settings/settingsSections.ts), el aviso de sandbox de
//    Customer Notifications, el «Managed as code» y el permiso `organization:manage` (Admin entero es del super admin, y
//    cada acción vuelve a preguntar `getSesionAdmin()`).

import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import OrganizationCustomerEmailSettings from '@/app/admin/_polar/web/Settings/OrganizationCustomerEmailSettings'
import OrganizationPaymentSettings from '@/app/admin/_polar/web/Settings/OrganizationPaymentSettings'
import { SETTINGS_SECTIONS, type SettingsSectionSlug } from '@/app/admin/_polar/web/Settings/settingsSections'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { Alert } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import type { DatosNotificaciones, DatosPagos } from '@/app/admin/_polar/datos/ajustes'

type Props =
  | { section: 'payments'; pagos: DatosPagos }
  | { section: 'customer-notifications'; notificaciones: DatosNotificaciones }

const SectionContent = (props: Props) => {
  switch (props.section) {
    case 'payments':
      return <OrganizationPaymentSettings datos={props.pagos} />
    case 'customer-notifications':
      return props.notificaciones.ok ? (
        <OrganizationCustomerEmailSettings emisor={props.notificaciones.emisor} waSolo={props.notificaciones.waSolo} />
      ) : (
        <Box flexDirection="column" rowGap="s">
          <Alert variant="danger" title="No pude leer cómo le llega el recibo" description={props.notificaciones.error} />
          <ReportarASoporte error={props.notificaciones.error} />
        </Box>
      )
  }
}

export default function SettingsSectionPage(props: Props) {
  const section: SettingsSectionSlug = props.section
  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-md)!" title={SETTINGS_SECTIONS[section].title}>
      <Box flexDirection="column" rowGap="2xl">
        <SectionContent {...props} />
      </Box>
    </DashboardBody>
  )
}

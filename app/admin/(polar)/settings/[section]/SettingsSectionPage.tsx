'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/settings/[section]/SettingsSectionPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ LO QUE SE SACÓ: las secciones de Polar que MaKo no llena (web/Settings/settingsSections.ts), el aviso de sandbox de
//    Customer Notifications, el «Managed as code» y el permiso `organization:manage` (Admin entero es del super admin, y
//    cada acción vuelve a preguntar `getSesionAdmin()`).

import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import OrganizationCustomerEmailSettings from '@/app/admin/_polar/web/Settings/OrganizationCustomerEmailSettings'
import OrganizationPaymentSettings from '@/app/admin/_polar/web/Settings/OrganizationPaymentSettings'
import { MembersSection } from '@/app/admin/_polar/web/Customer/CustomerPage/MembersSection'
import type { LecturaMiembros } from '@/app/admin/_polar/datos/cliente-server'
import { SETTINGS_SECTIONS, type SettingsSectionSlug } from '@/app/admin/_polar/web/Settings/settingsSections'
import { Alert } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import type { DatosNotificaciones, DatosPagos } from '@/app/admin/_polar/datos/ajustes'

type Props =
  | { section: 'members'; miembros: LecturaMiembros; negocios: Array<{ ws: number; nombre: string }> | null }
  | { section: 'payments'; pagos: DatosPagos }
  | { section: 'customer-notifications'; notificaciones: DatosNotificaciones }

const SectionContent = (props: Props) => {
  switch (props.section) {
    // Las personas de la plataforma (punto 25): las mismas piezas que Members de la ficha, con lo suyo (`destino="plataforma"`:
    // «Agregar persona» suma un admin de MaKo, y la columna «Tipo» dice de qué lado está cada una).
    case 'members':
      return props.miembros.ok ? (
        <MembersSection
          miembros={props.miembros.miembros}
          destino="plataforma"
          negocios={props.negocios}
          sinTitulo
          vacio={{ titulo: 'Sin personas', texto: 'Nadie de MaKo tiene cuenta.' }}
        />
      ) : (
        <Alert variant="danger" title="No pude leer las personas de MaKo" description={props.miembros.error} />
      )
    case 'payments':
      return <OrganizationPaymentSettings datos={props.pagos} />
    case 'customer-notifications':
      return props.notificaciones.ok ? (
        <OrganizationCustomerEmailSettings emisor={props.notificaciones.emisor} waSolo={props.notificaciones.waSolo} />
      ) : (
        <Alert variant="danger" title="No pude leer cómo le llega el recibo" description={props.notificaciones.error} />
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

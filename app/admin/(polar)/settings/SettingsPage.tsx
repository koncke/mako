'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/settings/SettingsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ LO QUE SE SACÓ: «Delete organization» (la zona de peligro: la plataforma no se borra desde acá), el permiso de
//    `organization:manage` (Admin entero es del super admin) y el salto de los anclas viejos (`LEGACY_SETTINGS_HASHES`).

import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import OrganizationProfileSettings from '@/app/admin/_polar/web/Settings/OrganizationProfileSettings'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { Alert } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import type { DatosGeneral } from '@/app/admin/_polar/datos/ajustes'

export default function ClientPage({ datos }: { datos: DatosGeneral }) {
  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-md)!" title="General">
      <Box flexDirection="column" rowGap="2xl">
        {datos.ok ? (
          <OrganizationProfileSettings emisor={datos.emisor} />
        ) : (
          <Box flexDirection="column" rowGap="s">
            <Alert variant="danger" title="No pude leer los datos del recibo" description={datos.error} />
            <ReportarASoporte error={datos.error} />
          </Box>
        )}
      </Box>
    </DashboardBody>
  )
}

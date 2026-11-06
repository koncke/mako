'use client'

// Copiado de polarsource/polar (Apache-2.0), /tmp/claude-0/-home-user-mako/52beedef-99d8-5d17-8f21-3a599afd3cce/scratchpad/H/settings/SettingsPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import AccessRestricted from '@/app/admin/_polar/web/Finance/AccessRestricted'
import { DashboardBody } from '@/app/admin/_polar/web/Layout/DashboardLayout'
import OrganizationDeleteSettings from '@/app/admin/_polar/web/Settings/OrganizationDeleteSettings'
import OrganizationProfileSettings from '@/app/admin/_polar/web/Settings/OrganizationProfileSettings'
import {
  getSettingsSection,
  LEGACY_SETTINGS_HASHES,
} from '@/app/admin/_polar/web/Settings/settingsSections'
import { useHasPermission } from '@/hooks/permissions'
import { schemas } from '@/app/admin/_polar/datos/polar-tipos'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function ClientPage({
  organization: org,
}: {
  organization: schemas['Organization']
}) {
  const router = useRouter()
  const canManageOrganization = useHasPermission(org.id, 'organization:manage')

  useEffect(() => {
    const section = LEGACY_SETTINGS_HASHES[window.location.hash.slice(1)]
    if (section && getSettingsSection(section, org)) {
      router.replace(`/dashboard/${org.slug}/settings/${section}`)
    }
  }, [router, org])

  return (
    <DashboardBody wrapperClassName="max-w-(--breakpoint-md)!" title="General">
      <Box flexDirection="column" rowGap="2xl">
        <OrganizationProfileSettings
          organization={org}
          readOnly={!canManageOrganization}
        />
        <Box id="danger" flexDirection="column">
          {canManageOrganization ? (
            <OrganizationDeleteSettings organization={org} />
          ) : (
            <AccessRestricted message="You don't have permission to delete this organization." />
          )}
        </Box>
      </Box>
    </DashboardBody>
  )
}

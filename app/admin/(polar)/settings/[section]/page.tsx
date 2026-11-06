// Copiado de polarsource/polar (Apache-2.0), /tmp/claude-0/-home-user-mako/52beedef-99d8-5d17-8f21-3a599afd3cce/scratchpad/H/settings/[section]/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import {
  getSettingsSection,
  SettingsSectionSlug,
} from '@/app/admin/_polar/web/Settings/settingsSections'
import { getServerSideAPI } from '@/app/admin/_polar/web/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/app/admin/_polar/web/utils/organization'
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SettingsSectionPage from './SettingsSectionPage'

export async function generateMetadata(props: {
  params: Promise<{ organization: string; section: string }>
}): Promise<Metadata> {
  const { section } = await props.params
  return {
    title: getSettingsSection(section)?.title ?? 'Settings', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string; section: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  if (!getSettingsSection(params.section, organization)) {
    notFound()
  }

  return (
    <SettingsSectionPage
      organization={organization}
      section={params.section as SettingsSectionSlug}
    />
  )
}

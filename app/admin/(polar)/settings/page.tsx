// Copiado de polarsource/polar (Apache-2.0), /tmp/claude-0/-home-user-mako/52beedef-99d8-5d17-8f21-3a599afd3cce/scratchpad/H/settings/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { getServerSideAPI } from '@/app/admin/_polar/web/utils/client/serverside'
import { getOrganizationBySlugOrNotFound } from '@/app/admin/_polar/web/utils/organization'
import { Metadata } from 'next'
import SettingsPage from './SettingsPage'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Settings', // " | Polar is added by the template"
  }
}

export default async function Page(props: {
  params: Promise<{ organization: string }>
}) {
  const params = await props.params
  const api = await getServerSideAPI()
  const organization = await getOrganizationBySlugOrNotFound(
    api,
    params.organization,
  )

  return <SettingsPage organization={organization} />
}

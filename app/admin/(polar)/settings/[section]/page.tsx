// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/settings/[section]/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Settings › Payments y Customer Notifications (/admin/settings/<sección>). Una sección que MaKo no tiene es un 404,
// como en Polar. ⚠️ SÓLO EL SUPER ADMIN, en la primera línea y antes de leer. Cada sección lee sólo lo suyo.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerAjustesNotificaciones, leerAjustesPagos } from '@/app/admin/_polar/datos/ajustes-server'
import { getSettingsSection } from '@/app/admin/_polar/web/Settings/settingsSections'
import SettingsSectionPage from './SettingsSectionPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(props: { params: Promise<{ section: string }> }): Promise<Metadata> {
  const { section } = await props.params
  return {
    title: getSettingsSection(section)?.title ?? 'Settings',
  }
}

export default async function Page(props: { params: Promise<{ section: string }> }) {
  await exigirSuperAdmin()
  const { section } = await props.params

  if (section === 'payments') {
    return <SettingsSectionPage section="payments" pagos={await leerAjustesPagos()} />
  }
  if (section === 'customer-notifications') {
    return <SettingsSectionPage section="customer-notifications" notificaciones={await leerAjustesNotificaciones()} />
  }
  notFound()
}

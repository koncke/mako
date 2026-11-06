// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/settings/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Settings › General (/admin/settings): quién emite los recibos de MaKo. ⚠️ SÓLO EL SUPER ADMIN, en la primera
// línea y antes de leer.

import type { Metadata } from 'next'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerAjustesGeneral } from '@/app/admin/_polar/datos/ajustes-server'
import SettingsPage from './SettingsPage'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Settings',
  }
}

export default async function Page() {
  await exigirSuperAdmin()
  const datos = await leerAjustesGeneral()
  return <SettingsPage datos={datos} />
}

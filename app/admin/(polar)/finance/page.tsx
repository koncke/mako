// /admin/finance → /admin/finance/income, como en Polar (su next.config.js: `/dashboard/:organization/finance` →
// `…/finance/income`). Acá es una página que redirige: la configuración de Next del repo no es de Admin.
// ⚠️ SÓLO EL SUPER ADMIN, en la primera línea (aunque no lea nada: es la regla de cada page.tsx de Admin).

import { redirect } from 'next/navigation'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { rutaConWs } from '@/lib/workspace'

export const dynamic = 'force-dynamic'

export default async function Page() {
  await exigirSuperAdmin()
  redirect(await rutaConWs('/admin/finance/income'))
}

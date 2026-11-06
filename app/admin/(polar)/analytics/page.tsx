// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// /admin/analytics no tiene pantalla propia: como en Polar, lleva a Metrics y conserva la query entera.
// ⚠️ SÓLO EL SUPER ADMIN (también acá: la página corre aunque el layout ya haya preguntado).

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { RedirectType, redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[]>>
}) {
  await exigirSuperAdmin()
  const searchParams = await props.searchParams

  // Preserve search params
  const urlSearchParams = new URLSearchParams()
  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => urlSearchParams.append(key, v))
    } else {
      urlSearchParams.append(key, value)
    }
  })

  const queryString = urlSearchParams.toString()
  redirect(
    `/admin/analytics/metrics${queryString ? `?${queryString}` : ''}`,
    RedirectType.replace,
  )
}

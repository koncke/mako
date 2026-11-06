// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/products/checkout-links/layout.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Products › Checkout Links: la barra con los links de «Vender un plan» a la izquierda y el link elegido a la
// derecha (MasterDetailLayout de Polar). ⚠️ SÓLO EL SUPER ADMIN, antes de leer: este layout lee los cobros de la plataforma.
// El guard de permisos de Polar (`OrganizationPermissionGuard products:read`) es eso mismo.

import type { PropsWithChildren } from 'react'
import { CheckoutLinkListSidebar } from '@/app/admin/_polar/web/CheckoutLinks/CheckoutLinkListSidebar'
import { MasterDetailLayout } from '@/app/admin/_polar/web/Layout/MasterDetailLayout'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerCheckoutLinks } from '@/app/admin/_polar/datos/productos-server'

export const dynamic = 'force-dynamic'

export default async function Layout(props: PropsWithChildren) {
  await exigirSuperAdmin()
  const datos = await leerCheckoutLinks().catch((e: unknown) => ({ error: e instanceof Error ? e.message : 'No pude leer los links.' }))

  return (
    <MasterDetailLayout listView={<CheckoutLinkListSidebar datos={datos} />} wrapperClassName="max-w-(--breakpoint-sm)!">
      {props.children}
    </MasterDetailLayout>
  )
}

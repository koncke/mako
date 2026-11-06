// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/(home)/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// /admin — Admin › Overview, la portada (la de Polar). Lo que Polar pide en el navegador con un hook por widget, acá lo lee
// este server de una vez (app/admin/_polar/datos/resumen-server.ts) y la vista lo recibe armado
// (app/admin/_polar/web/DashboardOverview/DashboardPage.tsx).
//
// ⚠️ SÓLO EL SUPER ADMIN, en la primera línea y antes de leer nada (cruza todos los negocios).
// ⚠️ LOS LINKS VIEJOS: `/admin?tab=…` viaja en mails ya mandados, marcadores y otras pantallas. Va a su sección nueva antes
//    de leer (`destinoDeTabViejo`, con test). `?ws=` no se lee: el negocio va en el path (/admin/customers/<ws>).

import { redirect } from 'next/navigation'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { destinoDeTabViejo } from '@/app/admin/_polar/datos/resumen'
import { leerResumenDeAdmin } from '@/app/admin/_polar/datos/resumen-server'
import { indiceDeBusqueda } from '@/app/admin/_polar/datos/busqueda'
import OverviewPage from '@/app/admin/_polar/web/DashboardOverview/DashboardPage'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'Overview' }

export default async function Page(props: {
  searchParams: Promise<{ tab?: string | string[]; cliente?: string | string[]; cuenta?: string | string[] }>
}) {
  await exigirSuperAdmin()
  const destino = destinoDeTabViejo(await props.searchParams)
  if (destino) redirect(destino)
  const [resumen, indice] = await Promise.all([
    leerResumenDeAdmin(),
    indiceDeBusqueda().catch(() => ({ negocios: [], personas: [] })),
  ])
  return <OverviewPage resumen={resumen} indice={indice} />
}

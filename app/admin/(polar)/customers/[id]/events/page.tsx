// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/[customerId]/events/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Customers › <negocio> › Events YA NO ES UNA PÁGINA (6/11/2026). En Polar, quien tiene `analytics:read` (el super admin
// siempre) va de la ficha a Analytics › Events filtrado por el cliente (`buildCustomerEventsPath`), y ésa es la única lista de
// eventos: acá también (app/admin/_polar/datos/eventos.ts). Esta ruta queda para que un link viejo o guardado siga andando:
// valida el negocio como las otras páginas de la ficha (404 si no es un id, no existe o es la plataforma) y redirige.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { negocioONotFound } from '@/app/admin/_polar/datos/cliente-server'
import { rutaDeEventosDelNegocio } from '@/app/admin/_polar/datos/cliente'
import { redirect, RedirectType } from 'next/navigation'

export const dynamic = 'force-dynamic'

type CustomerPageParams = { id: string }

export default async function Page(props: {
  params: Promise<CustomerPageParams>
}) {
  await exigirSuperAdmin()
  const params = await props.params
  const { ws } = await negocioONotFound(params.id)
  redirect(rutaDeEventosDelNegocio(ws), RedirectType.replace)
}

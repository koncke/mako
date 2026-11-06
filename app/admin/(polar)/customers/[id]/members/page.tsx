// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/[customerId]/members/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Customers › <negocio> › Members: SUS PERSONAS. Es el único lugar de Admin donde se ven y se gestionan (las de la plataforma,
// en Settings › Members). Polar contesta 404 a un Customer que no es `team`: todo negocio de MaKo tiene su equipo. Los negocios
// a los que se puede mudar a alguien son los de la lista de Customers (la misma lectura del layout).

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerMiembros, leerNegociosParaMudar, metadataDeNegocio, negocioONotFound } from '@/app/admin/_polar/datos/cliente-server'
import { CustomerMembers } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerMembers'
import { CustomerPageShell } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerPageShell'
import { Alert } from '@/app/admin/_polar/orbit'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type CustomerPageParams = { id: string }

export async function generateMetadata(props: {
  params: Promise<CustomerPageParams>
}): Promise<Metadata> {
  await exigirSuperAdmin()
  return metadataDeNegocio((await props.params).id, 'Members')
}

export default async function Page(props: {
  params: Promise<CustomerPageParams>
}) {
  await exigirSuperAdmin()
  const params = await props.params
  const { ws, cabecera } = await negocioONotFound(params.id)
  const [lectura, negocios] = await Promise.all([leerMiembros(ws), leerNegociosParaMudar()])

  return (
    <CustomerPageShell key={ws} negocio={cabecera}>
      {lectura.ok ? (
        <CustomerMembers ws={ws} miembros={lectura.miembros} negocios={negocios} />
      ) : (
        <Alert variant="danger" title="No pude leer sus personas" description={lectura.error} />
      )}
    </CustomerPageShell>
  )
}

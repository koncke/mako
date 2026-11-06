// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/[customerId]/events/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Customers › <negocio> › Events: lo que pasó en el negocio (sus pagos, lo que hizo MaKo, sus errores y sus reportes).

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerEventos, leerInicio, metadataDeNegocio, negocioONotFound } from '@/app/admin/_polar/datos/cliente-server'
import { CustomerEventsView } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerEventsView'
import { CustomerPageShell } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerPageShell'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type CustomerPageParams = { id: string }

export async function generateMetadata(props: {
  params: Promise<CustomerPageParams>
}): Promise<Metadata> {
  await exigirSuperAdmin()
  return metadataDeNegocio((await props.params).id, 'Events')
}

export default async function Page(props: {
  params: Promise<CustomerPageParams>
}) {
  await exigirSuperAdmin()
  const params = await props.params
  const { ws, cabecera, alta, avisos } = await negocioONotFound(params.id)
  const [eventos, inicio] = await Promise.all([leerEventos(ws), leerInicio(ws, alta.creado)])

  return (
    <CustomerPageShell key={ws} negocio={cabecera} avisos={[...avisos, ...eventos.avisos]}>
      <CustomerEventsView eventos={eventos.eventos} inicio={inicio} />
    </CustomerPageShell>
  )
}

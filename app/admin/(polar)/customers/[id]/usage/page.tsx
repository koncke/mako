// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/[customerId]/usage/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Customers › <negocio> › Usage: qué tabs usa y cuáles no, y sus llamadas de IA (Polar: sus medidores).

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerInicio, leerUso, metadataDeNegocio, negocioONotFound } from '@/app/admin/_polar/datos/cliente-server'
import { CustomerPageShell } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerPageShell'
import { CustomerUsageView } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerUsageView'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type CustomerPageParams = { id: string }

export async function generateMetadata(props: {
  params: Promise<CustomerPageParams>
}): Promise<Metadata> {
  await exigirSuperAdmin()
  return metadataDeNegocio((await props.params).id, 'Usage')
}

export default async function Page(props: {
  params: Promise<CustomerPageParams>
}) {
  await exigirSuperAdmin()
  const params = await props.params
  const { ws, cabecera, alta, avisos } = await negocioONotFound(params.id)
  const [uso, inicio] = await Promise.all([leerUso(ws), leerInicio(ws, alta.creado)])

  return (
    <CustomerPageShell key={ws} negocio={cabecera} avisos={[...avisos, ...uso.avisos]}>
      <CustomerUsageView
        medido={uso.medido}
        desdeMedido={uso.desde}
        filas={uso.filas}
        tabs={uso.tabs}
        ia={uso.ia}
        inicio={inicio}
      />
    </CustomerPageShell>
  )
}

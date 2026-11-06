// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/[customerId]/page.tsx
// (y getCustomer.ts, que vive en app/admin/_polar/datos/cliente-server.ts). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: Customers › <negocio> › Overview. Un Customer de Polar es un NEGOCIO; su id va en el path y es el número del
// workspace (nunca `?ws=`). Lo que Polar pide con hooks desde el navegador se lee acá y viaja armado.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerInicio, leerResumen, metadataDeNegocio, negocioONotFound } from '@/app/admin/_polar/datos/cliente-server'
import { CustomerOverview } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerOverview'
import { CustomerPageShell } from '@/app/admin/_polar/web/Customer/CustomerPage/CustomerPageShell'
import { Metadata } from 'next'

export const dynamic = 'force-dynamic'

type CustomerPageParams = { id: string }

export async function generateMetadata(props: {
  params: Promise<CustomerPageParams>
}): Promise<Metadata> {
  await exigirSuperAdmin()
  return metadataDeNegocio((await props.params).id)
}

export default async function Page(props: {
  params: Promise<CustomerPageParams>
}) {
  await exigirSuperAdmin()
  const params = await props.params
  const { ws, cabecera, alta, avisos } = await negocioONotFound(params.id)
  const [resumen, inicio] = await Promise.all([leerResumen(ws), leerInicio(ws, alta.creado)])

  return (
    <CustomerPageShell key={ws} negocio={cabecera} avisos={[...avisos, ...resumen.avisos]}>
      <CustomerOverview
        negocio={cabecera}
        alta={alta}
        inicio={inicio}
        pedidos={resumen.pedidos}
        mrrUsd={resumen.mrrUsd}
        suscripciones={resumen.suscripciones}
        conexiones={resumen.conexiones}
        computadoras={resumen.computadoras}
        eventos={resumen.eventos}
      />
    </CustomerPageShell>
  )
}

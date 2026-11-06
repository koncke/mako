// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/customers/layout.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: la lista de la izquierda son los NEGOCIOS (los workspaces, sin el de la plataforma), leídos acá en el server y
// pasados a la lista armados (Polar los pide de a páginas desde el navegador). La ficha de cada uno
// (customers/[id]/…) se dibuja adentro de este layout. Sin el guard de permisos de Polar: entra sólo el super admin.

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerClientes } from '@/app/admin/_polar/datos/clientes-server'
import { listaDeClientes } from '@/app/admin/_polar/datos/clientes'
import { CustomerListSidebar } from '@/app/admin/_polar/web/Customer/CustomerListSidebar'
import { MasterDetailLayout } from '@/app/admin/_polar/web/Layout/MasterDetailLayout'
import { PropsWithChildren } from 'react'

export const dynamic = 'force-dynamic'

export default async function Layout(props: PropsWithChildren) {
  await exigirSuperAdmin()
  const lectura = await leerClientes()

  return (
    <MasterDetailLayout
      listView={
        <CustomerListSidebar
          customers={lectura.ok ? listaDeClientes(lectura.datos.filas) : null}
          error={lectura.ok ? null : lectura.error}
        />
      }
    >
      {props.children}
    </MasterDetailLayout>
  )
}

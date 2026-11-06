'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomersSubnav.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: sin la organización (Admin es UNA: la plataforma) ni el permiso `analytics:read` (acá entra sólo el super admin,
// que ve Cost Drivers siempre).

import { RUTA_CUSTOMERS } from '@/app/admin/_polar/datos/clientes'
import { Subnav, SubnavItem } from '@/app/admin/_polar/orbit'
import Link from '@/app/_ui/Link'
import { usePathname } from 'next/navigation'

export const CustomersSubnav = () => {
  const pathname = usePathname()
  const base = RUTA_CUSTOMERS

  const items = [
    { label: 'Overview', href: base },
    { label: 'Top Customers', href: `${base}/top` },
    { label: 'At Risk', href: `${base}/at-risk` },
    { label: 'Cost Drivers', href: `${base}/cost-drivers` },
  ]

  return (
    <Subnav label="Secciones de Customers">
      {items.map(({ label, href }) => (
        <SubnavItem key={href} active={pathname === href}>
          <Link href={href}>{label}</Link>
        </SubnavItem>
      ))}
    </Subnav>
  )
}

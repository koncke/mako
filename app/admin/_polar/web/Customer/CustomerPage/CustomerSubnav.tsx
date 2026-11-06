'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerSubnav.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «Members» siempre (Polar la muestra sólo a un Customer de tipo `team`: todo negocio de MaKo tiene su equipo). «Events»
// es la subpágina del negocio (Polar, con `analytics:read`, lleva a Analytics › Events filtrado por el cliente: en Admin el
// super admin siempre puede, y la de acá ya es la del negocio).

import { Subnav, SubnavItem } from '@/app/admin/_polar/orbit'
import { rutaDeFicha } from '@/app/admin/_polar/datos/cliente'
import Link from '@/app/_ui/Link'
import { usePathname, useSearchParams } from 'next/navigation'
import { CUSTOMER_METRICS_QUERY_PARAMS } from './useCustomerMetricsParams'

interface CustomerSubnavProps {
  ws: number
}

export const CustomerSubnav = ({ ws }: CustomerSubnavProps) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const items = [
    { label: 'Overview', href: rutaDeFicha(ws) },
    { label: 'Usage', href: rutaDeFicha(ws, 'usage') },
    { label: 'Events', href: rutaDeFicha(ws, 'events') },
    { label: 'Members', href: rutaDeFicha(ws, 'members') },
  ]

  const metricsParams = new URLSearchParams()
  for (const key of CUSTOMER_METRICS_QUERY_PARAMS) {
    const value = searchParams.get(key)
    if (value) {
      metricsParams.set(key, value)
    }
  }
  const query = metricsParams.size > 0 ? `?${metricsParams.toString()}` : ''

  return (
    <Subnav label="Secciones del negocio">
      {items.map(({ label, href }) => (
        <SubnavItem key={href} active={pathname === href}>
          <Link href={`${href}${query}`}>{label}</Link>
        </SubnavItem>
      ))}
    </Subnav>
  )
}

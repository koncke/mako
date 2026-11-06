'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerSubnav.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «Members» siempre (Polar la muestra sólo a un Customer de tipo `team`: todo negocio de MaKo tiene su equipo). «Events»
// es la rama de Polar con `analytics:read` (que el super admin siempre tiene): un link EXTERNO a Analytics › Events filtrado por
// el negocio (`rutaDeEventosDelNegocio`, el `buildCustomerEventsPath` de Polar), sin la query del rango de las métricas.

import { Subnav, SubnavItem } from '@/app/admin/_polar/orbit'
import { rutaDeEventosDelNegocio, rutaDeFicha } from '@/app/admin/_polar/datos/cliente'
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
    {
      label: 'Events',
      href: rutaDeEventosDelNegocio(ws),
      external: true,
    },
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
      {items.map(({ label, href, external }) => (
        <SubnavItem key={href} active={pathname === href}>
          <Link href={external ? href : `${href}${query}`}>{label}</Link>
        </SubnavItem>
      ))}
    </Subnav>
  )
}

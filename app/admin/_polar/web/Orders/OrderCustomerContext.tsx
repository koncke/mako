'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerContextView.tsx (con su ContextCard y
// su DetailRow, de components/Shared/). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «el cliente» de un pedido es el NEGOCIO (su cuenta de MaKo) o, si no tiene cuenta, su ficha del CRM de la plataforma.
// «View Customer» lleva a Customers › <negocio> (donde viven su plan, sus personas y lo demás); sin cuenta, a su ficha del CRM.
// Sin «Cumulative Revenue» ni las suscripciones del cliente: la plata vive en Overview y Analytics, y las suscripciones en Sales ›
// Subscriptions (cada dato en un lugar, lo pidió Martín).

import Link from '@/app/_ui/Link'
import type { ClienteVenta } from '@/app/admin/_polar/datos/ventas'
import ShadowBox from '@/app/admin/_polar/atoms/ShadowBox'
import { Avatar, Button } from '@/app/admin/_polar/orbit'
import type { PropsWithChildren, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

const ContextCard = ({ children }: PropsWithChildren) => (
  <ShadowBox className="dark:border-polar-800 flex flex-col gap-4 border-gray-200 bg-white p-6 md:shadow-xs lg:rounded-2xl">{children}</ShadowBox>
)

const DetailRow = ({ label, value, valueClassName = '' }: { label: string; value: ReactNode; valueClassName?: string }) => (
  <div className="flex flex-col text-sm md:flex-row md:items-baseline md:justify-between md:gap-4">
    <h3 className="dark:text-polar-500 flex-none truncate text-gray-500 md:basis-24">{label}</h3>
    <span
      className={twMerge(
        'dark:md:hover:bg-polar-800 group flex flex-1 flex-row flex-nowrap items-center justify-between gap-x-2 rounded-md transition-colors duration-75 md:px-2.5 md:py-1 hover:md:bg-gray-100',
        value ? '' : 'dark:text-polar-500 text-gray-500',
        valueClassName,
      )}
    >
      {value ?? '—'}
    </span>
  </div>
)

/** A dónde lleva «Ver el cliente»: Customers › <negocio>, o su ficha del CRM de la plataforma (`?ws=` de la plataforma). */
export const rutaDelCliente = (c: ClienteVenta, plataforma: number | null): string | null =>
  c.ws != null ? `/admin/customers/${c.ws}` : c.leadId != null && plataforma != null ? `/crm/${c.leadId}?ws=${plataforma}` : null

export const OrderCustomerContext = ({ customer, plataforma }: { customer: ClienteVenta; plataforma: number | null }) => {
  const ruta = rutaDelCliente(customer, plataforma)
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto">
      <ContextCard>
        <div className="flex flex-row items-center gap-4">
          <Avatar avatar_url={null} name={customer.nombre || '—'} className="size-12 text-sm" />
          <div className="flex flex-col items-start">
            <span>{customer.nombre || '—'}</span>
            {customer.email && <div className="dark:text-polar-500 text-sm text-gray-500">{customer.email}</div>}
          </div>
        </div>
        {ruta && (
          <Link href={ruta} className="flex flex-row items-center gap-4">
            <Button className="w-full" size="lg" variant="secondary">
              {customer.ws != null ? 'Ver el cliente' : 'Ver su ficha del CRM'}
            </Button>
          </Link>
        )}
      </ContextCard>
      <ContextCard>
        <div className="flex flex-col gap-3 md:gap-0">
          <DetailRow label="Cuenta" value={customer.ws != null ? `Workspace ${customer.ws}` : 'Sin cuenta en MaKo'} valueClassName="font-mono text-xs" />
          <DetailRow label="Nombre" value={customer.nombre} />
          <DetailRow label="Email" value={customer.email} />
          {customer.ws != null && <DetailRow label="Entrar" value={<Link href={`/inicio?ws=${customer.ws}`} className="text-blue-500 hover:underline">Abrir su MaKo</Link>} />}
        </div>
      </ContextCard>
    </div>
  )
}

'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/CheckoutLinks/CheckoutLinkPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El cuerpo de un Checkout Link: el link para copiar y lo que tiene. ⚠️ LO QUE SE SACÓ: la pestaña «Embed» (el script de
// checkout embebido de Polar: MaKo no tiene uno) y, con ella, las pestañas «Link | Embed» y el «Dark Mode». ⚠️ Un link de
// MaKo deja de servir cuando se paga o se anula: entonces, en vez del link, se dice en qué quedó (no está en Polar: un link
// de Polar es reusable).

import CopyToClipboardInput from '@/app/admin/_polar/atoms/CopyToClipboardInput'
import { Text } from '@/app/admin/_polar/orbit'
import Link from '@/app/_ui/Link'
import type { Pasarela } from '@/lib/cobros-tipos'
import { ESTADO_LINK, type LinkDeVenta, type ProductoMako } from '@/app/admin/_polar/datos/productos'
import { CheckoutLinkForm } from './CheckoutLinkForm'

interface CheckoutLinkPageProps {
  checkoutLink: LinkDeVenta
  productos: ProductoMako[]
  pasarelas: Pasarela[]
  monedaMp: string | null
}

export const CheckoutLinkPage = ({ checkoutLink, productos, pasarelas, monedaMp }: CheckoutLinkPageProps) => {
  return (
    <div className="flex w-full flex-col gap-8">
      {checkoutLink.url ? (
        <CopyToClipboardInput value={checkoutLink.url} buttonLabel="Copiar" className="bg-white" ariaLabel="Link de pago" />
      ) : (
        <Text color="muted">
          {ESTADO_LINK[checkoutLink.estado].rotulo}: este link ya no se puede pagar.
          {checkoutLink.cuenta && (
            <>
              {' '}
              Su cuenta es{' '}
              <Link href={`/admin/customers/${checkoutLink.cuenta.ws}`} className="underline hover:no-underline">
                {checkoutLink.cuenta.nombre ?? `la cuenta ${checkoutLink.cuenta.ws}`}
              </Link>
              .
            </>
          )}
        </Text>
      )}

      <CheckoutLinkForm checkoutLink={checkoutLink} productos={productos} pasarelas={pasarelas} monedaMp={monedaMp} onClose={() => {}} />
    </div>
  )
}

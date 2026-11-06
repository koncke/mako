'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Layout/MasterDetailIndex.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ Vive en CheckoutLinks/ (y no en Layout/) porque lo usa sólo el índice de Checkout Links. `MOBILE_MEDIA_QUERY` es el de
//    clients/apps/web/src/utils/mobile.ts, copiado acá: en el teléfono el índice muestra la lista; en la computadora salta
//    al primer link, como Polar.

import { redirect } from 'next/navigation'

const MOBILE_MEDIA_QUERY = '(max-width: 768px)'

export const MasterDetailIndex = ({ redirectTo }: { redirectTo: string }) => {
  const isBrowser = typeof window !== 'undefined'
  const isDesktop = isBrowser && !window.matchMedia(MOBILE_MEDIA_QUERY).matches

  if (isDesktop) {
    redirect(redirectTo)
  }

  return null
}

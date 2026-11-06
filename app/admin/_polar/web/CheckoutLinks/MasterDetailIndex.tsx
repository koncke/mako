'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Layout/MasterDetailIndex.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ Vive en CheckoutLinks/ (y no en Layout/) porque lo usa sólo el índice de Checkout Links. `MOBILE_MEDIA_QUERY` es el de
//    clients/apps/web/src/utils/mobile.ts, copiado acá: en el teléfono el índice muestra la lista; en la computadora salta
//    al primer link, como Polar.
// ⚠️ EL SALTO VA EN UN EFECTO, NO EN EL RENDER (6/11/2026). Polar llama a `redirect()` mientras dibuja: en el server no hay
//    `window` y devuelve null, y en el navegador el mismo componente TIRA durante la hidratación. React descarta lo que vino
//    del server y vuelve a dibujar el árbol entero en el cliente, con los <script> del layout raíz de MaKo adentro (el tema),
//    y la consola marca «Encountered a script tag while rendering React component». Con el efecto, la hidratación coincide
//    (null y null) y el salto es una navegación más, con el router de la casa (preserva el `?ws=`, que acá no hay).

import { useEffect } from 'react'
import { useRouter } from '@/app/_ui/Link'

const MOBILE_MEDIA_QUERY = '(max-width: 768px)'

/** A dónde salta el índice: al primer link en la computadora; en el teléfono a ningún lado (se ve la lista). */
export const destinoDelIndice = (redirectTo: string, esTelefono: boolean): string | null => (esTelefono ? null : redirectTo)

export const MasterDetailIndex = ({ redirectTo }: { redirectTo: string }) => {
  const router = useRouter()

  useEffect(() => {
    const destino = destinoDelIndice(redirectTo, window.matchMedia(MOBILE_MEDIA_QUERY).matches)
    if (destino) router.replace(destino)
  }, [redirectTo, router])

  return null
}

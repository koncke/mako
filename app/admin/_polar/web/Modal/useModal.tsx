// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Modal/useModal.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { useState } from 'react'

export const useModal = (initialShown: boolean = false) => {
  const [isShown, setIsShown] = useState<boolean>(initialShown)
  const toggle = () => setIsShown(!isShown)
  const show = () => setIsShown(true)
  const hide = () => setIsShown(false)
  return {
    isShown,
    toggle,
    show,
    hide,
  }
}

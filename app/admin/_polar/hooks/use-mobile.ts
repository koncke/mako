// Copiado de polarsource/polar (Apache-2.0), clients/packages/ui/src/hooks/use-mobile.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import * as React from 'react'

const MOBILE_BREAKPOINT = 768

const mobileQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

const subscribe = (onChange: () => void) => {
  const mediaQuery = window.matchMedia(mobileQuery)
  mediaQuery.addEventListener('change', onChange)
  return () => mediaQuery.removeEventListener('change', onChange)
}

const getSnapshot = () => window.matchMedia(mobileQuery).matches
const getServerSnapshot = () => false

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

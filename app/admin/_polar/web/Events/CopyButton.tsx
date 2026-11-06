'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Events/CopyButton.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el `useSafeCopy` de Polar (copia y avisa con un toast si el navegador no deja) es `navigator.clipboard` directo; si
// no deja copiar, el botón no cambia a «Copiado» (no se miente que copió).

import { Button } from '@/app/admin/_polar/orbit'
import { Check, Copy } from '@/app/admin/_polar/orbit/icons'
import { useEffect, useState } from 'react'

const COPIED_DURATION_MS = 1500

export const CopyButton = ({
  value,
  label = 'Copiar',
}: {
  value: string
  label?: string
}) => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timeout = setTimeout(() => setCopied(false), COPIED_DURATION_MS)
    return () => clearTimeout(timeout)
  }, [copied])

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-6 w-6 [&_svg]:size-3!"
      aria-label={copied ? 'Copiado' : label}
      title={copied ? 'Copiado' : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
        } catch {
          setCopied(false)
        }
      }}
    >
      {copied ? (
        <Check className="dark:text-polar-500 text-gray-400" />
      ) : (
        <Copy />
      )}
    </Button>
  )
}

'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Events/EventDetailField.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ReactNode } from 'react'
import { CopyButton } from './CopyButton'

export const Field = ({
  label,
  copyValue,
  children,
}: {
  label: string
  copyValue?: string
  children: ReactNode
}) => (
  <div className="group">
    <Box alignItems="center" gap="m" minHeight={26}>
      <Box width={96} flexShrink={0}>
        <Text color="muted">{label}</Text>
      </Box>
      <Box minWidth={0} flexGrow={1}>
        {children}
      </Box>
      {copyValue && (
        <div className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100">
          <CopyButton value={copyValue} label={`Copiar ${label.toLowerCase()}`} />
        </div>
      )}
    </Box>
  </div>
)

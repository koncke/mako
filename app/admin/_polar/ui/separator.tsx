'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/packages/ui/src/components/ui/separator.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { Separator as SeparatorPrimitive } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/app/admin/_polar/lib/utils'

const Separator = ({
  ref,
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      'bg-border shrink-0',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className,
    )}
    {...props}
  />
)
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }

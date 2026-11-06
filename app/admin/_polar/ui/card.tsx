// Copiado de polarsource/polar (Apache-2.0), clients/packages/ui/src/components/ui/card.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import * as React from 'react'

import { cn } from '@/app/admin/_polar/lib/utils'

const Card = ({
  ref,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.RefObject<HTMLDivElement>
}) => (
  <div
    ref={ref}
    className={cn(
      'bg-card text-card-foreground rounded-lg border shadow-xs',
      className,
    )}
    {...props}
  />
)
Card.displayName = 'Card'

const CardHeader = ({
  ref,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.RefObject<HTMLDivElement>
}) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-6', className)}
    {...props}
  />
)
CardHeader.displayName = 'CardHeader'

const CardContent = ({
  ref,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  ref?: React.RefObject<HTMLDivElement>
}) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
CardContent.displayName = 'CardContent'

export { Card, CardContent, CardHeader }

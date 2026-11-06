// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/WidgetContainer.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { PropsWithChildren, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'

interface WidgetContainerProps {
  title: string
  headline?: ReactNode
  action?: ReactNode
  className?: string
}

export const WidgetContainer = ({
  title,
  headline,
  action,
  className,
  children,
}: PropsWithChildren<WidgetContainerProps>) => {
  return (
    <div
      className={twMerge('flex h-82 flex-col gap-6 overflow-hidden', className)}
    >
      <Box
        flexShrink={0}
        flexDirection="column"
        rowGap="s"
        paddingHorizontal="xl"
        paddingTop="xl"
      >
        <Box alignItems="center" justifyContent="between" columnGap="m">
          <Box minWidth={0}>
            <Text as="h3" truncate>
              {title}
            </Text>
          </Box>
          <Box flexShrink={0}>{action}</Box>
        </Box>
        {headline}
      </Box>
      <div className="flex flex-1 flex-col overflow-y-auto px-6">
        {children}
      </div>
    </div>
  )
}

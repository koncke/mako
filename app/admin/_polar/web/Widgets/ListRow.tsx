// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/ListRow.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { Box } from '@/app/admin/_polar/orbit/components/Box'
import Link from '@/app/_ui/Link'
import { PropsWithChildren } from 'react'

export const ListRow = ({
  href,
  children,
}: PropsWithChildren<{ href?: string }>) => {
  const row = (
    <Box
      alignItems="baseline"
      justifyContent="between"
      columnGap="m"
      paddingVertical="s"
      borderTopWidth={1}
      borderStyle="solid"
      borderColor="border-secondary"
    >
      {children}
    </Box>
  )

  return href ? (
    <Link href={href} className="hover:opacity-60">
      {row}
    </Link>
  ) : (
    row
  )
}

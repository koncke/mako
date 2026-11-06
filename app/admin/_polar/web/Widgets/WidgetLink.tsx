// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/WidgetLink.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ArrowRight } from '@/app/admin/_polar/orbit/icons'
import Link from '@/app/_ui/Link'

export const WidgetLink = ({ href }: { href: string }) => (
  <Link href={href} className="hover:opacity-60">
    <Box alignItems="center" columnGap="xs" color="text-secondary">
      <Text color="muted">Ver todo</Text>
      <ArrowRight className="h-3.5 w-3.5" />
    </Box>
  </Link>
)

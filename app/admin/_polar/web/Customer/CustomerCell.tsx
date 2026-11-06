// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Customer/CustomerCell.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { Avatar, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'

interface CustomerCellProps {
  name?: string | null
  email?: string | null
  avatarUrl?: string | null
}

export const CustomerCell = ({ name, email, avatarUrl }: CustomerCellProps) => {
  const display = name ?? email ?? '-'
  return (
    <Box alignItems="center" columnGap="m" minWidth={0}>
      <Avatar
        className="h-8 w-8"
        avatar_url={avatarUrl ?? null}
        name={display}
      />
      <Box flexDirection="column" minWidth={0}>
        <Text truncate>{display}</Text>
        {name && email ? (
          <Text truncate color="muted" variant="caption">
            {email}
          </Text>
        ) : null}
      </Box>
    </Box>
  )
}

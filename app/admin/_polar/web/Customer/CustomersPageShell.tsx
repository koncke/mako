'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomersPageShell.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: sin la organización (la subnav no la necesita).

import { MasterDetailLayoutContent } from '@/app/admin/_polar/web/Layout/MasterDetailLayout'
import { CHART_RANGES, ChartRange } from '@/app/admin/_polar/web/utils/metrics'
import { SegmentedControl, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { PropsWithChildren } from 'react'
import { CustomersSubnav } from './CustomersSubnav'

interface CustomersPageShellProps extends PropsWithChildren {
  range?: ChartRange
  onRangeChange?: (range: ChartRange) => void
}

export const CustomersPageShell = ({
  range,
  onRangeChange,
  children,
}: CustomersPageShellProps) => (
  <MasterDetailLayoutContent
    header={
      <Box
        height="2rem"
        display="flex"
        flexDirection="row"
        alignItems="center"
        justifyContent="between"
        rowGap="xl"
        width="100%"
      >
        <Text variant="heading-xs" as="h1">
          Customers
        </Text>
        {range && onRangeChange ? (
          <SegmentedControl
            options={(
              Object.entries(CHART_RANGES) as [ChartRange, string][]
            ).map(([value, label]) => ({ value, label }))}
            value={range}
            onChange={onRangeChange}
          />
        ) : null}
      </Box>
    }
  >
    <Box flexDirection="column" rowGap="2xl">
      <CustomersSubnav />
      {children}
    </Box>
  </MasterDetailLayoutContent>
)

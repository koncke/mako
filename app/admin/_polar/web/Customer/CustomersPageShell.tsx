'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomersPageShell.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: sin la organización (la subnav no la necesita).

import { MasterDetailLayoutContent } from '@/app/admin/_polar/web/Layout/MasterDetailLayout'
import type { ChartRange } from '@/app/admin/_polar/web/utils/metrics'
import { SegmentedControl, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { PropsWithChildren } from 'react'
import { CustomersSubnav } from './CustomersSubnav'
import { OPCIONES_DE_RANGO } from './rangos'

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
      // MaKo: Polar fija el alto (`height="2rem"`) y deja el título y el selector en un renglón. En el teléfono no entran juntos
      // y el selector se salía del panel (la página se corría de costado): acá el renglón envuelve y el selector baja debajo del
      // título; en la computadora se ven igual que en Polar. Las opciones, de ./rangos.ts («Todo» en vez de «Desde siempre»).
      <Box
        minHeight="2rem"
        display="flex"
        flexDirection="row"
        flexWrap="wrap"
        alignItems="center"
        justifyContent="between"
        columnGap="l"
        rowGap="m"
        width="100%"
        minWidth={0}
      >
        <Text variant="heading-xs" as="h1">
          Customers
        </Text>
        {range && onRangeChange ? (
          <SegmentedControl
            options={[...OPCIONES_DE_RANGO]}
            value={range}
            onChange={onRangeChange}
            className="max-w-full whitespace-nowrap"
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

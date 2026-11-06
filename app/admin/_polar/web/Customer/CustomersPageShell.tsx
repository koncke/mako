'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomersPageShell.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: sin la organización (la subnav no la necesita), y el título y los rangos en dos renglones en el teléfono.

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
      // ⚠️ En el teléfono va en dos renglones: los cinco rangos («Desde siempre · 12m · 3m · 30d · Hoy») al lado del título se
      //    salían por la derecha a 390 px (capturas del 6/11/2026). En la computadora, el renglón de 2rem de Polar.
      <Box
        height={{ base: 'auto', md: '2rem' }}
        display="flex"
        flexDirection={{ base: 'column', md: 'row' }}
        alignItems={{ base: 'start', md: 'center' }}
        justifyContent="between"
        rowGap="m"
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

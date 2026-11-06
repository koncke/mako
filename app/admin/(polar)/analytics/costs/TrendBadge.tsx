'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/costs/TrendBadge.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/admin/_polar/orbit'
import FormattedInterval from '@/app/admin/_polar/atoms/FormattedInterval'
import { ArrowDownRight, ArrowUpRight, Minus } from '@/app/admin/_polar/orbit/icons'
import { fmtPct } from './utils'

interface TrendBadgeProps {
  delta: number
  pct: number
  currentStart: Date
  currentEnd: Date
  prevStart: Date
  prevEnd: Date
}

export function TrendBadge({
  delta,
  pct,
  currentStart,
  currentEnd,
  prevStart,
  prevEnd,
}: TrendBadgeProps) {
  const isUp = delta > 0
  const isDown = delta < 0
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Box
          as="span"
          display="inline-flex"
          width="fit-content"
          alignItems="center"
          columnGap="xs"
          paddingHorizontal="s"
          borderRadius="full"
          cursor="default"
          backgroundColor={
            isUp
              ? 'background-danger'
              : isDown
                ? 'background-success'
                : 'background-card'
          }
          color={
            isUp ? 'text-danger' : isDown ? 'text-success' : 'text-tertiary'
          }
        >
          {isUp ? (
            <ArrowUpRight className="size-3" />
          ) : isDown ? (
            <ArrowDownRight className="size-3" />
          ) : (
            <Minus className="size-3" />
          )}
          <Text as="span" variant="label" color="inherit" tabularNums>
            {fmtPct(pct)}
          </Text>
        </Box>
      </TooltipTrigger>
      <TooltipContent className="flex flex-col gap-1">
        <Text as="span" variant="default">
          <FormattedInterval
            startDatetime={currentStart}
            endDatetime={currentEnd}
            hideCurrentYear={false}
          />
        </Text>
        <Text as="span" variant="default" color="muted">
          contra{' '}
          <FormattedInterval
            startDatetime={prevStart}
            endDatetime={prevEnd}
            hideCurrentYear={false}
          />
        </Text>
      </TooltipContent>
    </Tooltip>
  )
}

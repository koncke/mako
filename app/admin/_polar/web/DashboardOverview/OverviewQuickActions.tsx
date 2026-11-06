'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/DashboardOverview/OverviewQuickActions.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: quedan «Metrics» (Analytics › Metrics) y la búsqueda (el mismo ⌘K de la barra, con el índice que lee el server).
// «Payouts» de Polar lleva a Finance › Payouts, que MaKo no tiene (se sacó de la barra): se sacó acá también.

import { OmniSearch } from '@/app/admin/_polar/web/Search/OmniSearch'
import type { IndiceBusqueda } from '@/app/admin/_polar/datos/busqueda-tipos'
import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ChartNoAxesColumn, Search } from '@/app/admin/_polar/orbit/icons'
import Link from '@/app/_ui/Link'
import { ReactNode, useState } from 'react'

const QuickAction = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) => (
  <Tooltip>
    <TooltipTrigger asChild>{children}</TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
)

const QuickLink = ({
  label,
  href,
  icon,
}: {
  label: string
  href: string
  icon: ReactNode
}) => (
  <QuickAction label={label}>
    <Link
      href={href}
      aria-label={label}
      className="dark:hover:bg-polar-700 focus-visible:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-full text-black transition-colors hover:bg-gray-200 focus-visible:ring-2 focus-visible:outline-none dark:text-white"
    >
      {icon}
    </Link>
  </QuickAction>
)

export const OverviewQuickActions = ({ indice }: { indice: IndiceBusqueda }) => {
  const [searchOpen, setSearchOpen] = useState(false)
  const base = '/admin'

  return (
    <Box alignItems="center" columnGap="s">
      <QuickLink
        label="Metrics"
        href={`${base}/analytics/metrics`}
        icon={<ChartNoAxesColumn className="h-4 w-4" />}
      />
      <QuickAction label="Buscar">
        <Button
          size="icon"
          variant="secondary"
          className="h-8 w-8"
          aria-label="Buscar"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
      </QuickAction>
      <OmniSearch open={searchOpen} onOpenChange={setSearchOpen} indice={indice} />
    </Box>
  )
}

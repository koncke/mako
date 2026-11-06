// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Events/EventLogSkeleton.tsx (y el
// `SkeletonBar` de EventDetailSkeleton.tsx). Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la lista llega del server entera, así que esto se ve sólo hasta que la pantalla se monta en el navegador (el rango
// «últimos N días» se calcula con la hora de quien mira, no con la del server). El esqueleto del detalle se sacó: el detalle
// ya tiene todo cuando se abre.

import { Box } from '@/app/admin/_polar/orbit/components/Box'

export const SkeletonBar = ({
  width,
  height = 12,
}: {
  width: number | string
  height?: number
}) => (
  <div className="animate-pulse">
    <Box
      width={width}
      height={height}
      borderRadius="s"
      backgroundColor="background-card"
    />
  </div>
)

const ROWS = [
  [140, 90],
  [180, 70],
  [120, 100],
  [200, 80],
  [160, 60],
  [110, 90],
  [190, 70],
  [150, 100],
  [130, 80],
  [170, 60],
  [140, 90],
  [180, 70],
]

export const EventLogSkeleton = () => (
  <Box flexDirection="column" aria-busy="true">
    {ROWS.map(([eventWidth, customerWidth], index) => (
      <Box
        key={`mobile-${index}`}
        display={{ base: 'flex', md: 'none' }}
        flexDirection="column"
        gap="s"
        paddingHorizontal="m"
        paddingVertical="s"
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <SkeletonBar width={eventWidth} height={14} />
        <SkeletonBar width={customerWidth + 60} height={12} />
      </Box>
    ))}
    {ROWS.map(([eventWidth, customerWidth], index) => (
      <Box
        key={index}
        display={{ base: 'none', md: 'flex' }}
        alignItems="center"
        gap="l"
        paddingHorizontal="m"
        paddingVertical="s"
        minHeight={37}
        borderBottomWidth={1}
        borderStyle="solid"
        borderColor="border-secondary"
      >
        <Box width={128} flexShrink={0}>
          <SkeletonBar width={104} height={14} />
        </Box>
        <Box flexGrow={2} flexBasis={0} minWidth={120}>
          <SkeletonBar width={eventWidth} height={14} />
        </Box>
        <Box flexGrow={1} flexBasis={0} minWidth={0}>
          <SkeletonBar width={customerWidth} height={14} />
        </Box>
        <Box width={72} flexShrink={0} />
        <Box width={88} flexShrink={0} />
      </Box>
    ))}
  </Box>
)

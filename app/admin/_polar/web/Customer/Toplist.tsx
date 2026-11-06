// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Shared/Toplist.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: vive en Customer/ porque en Polar sólo lo usan las listas de Customers. `ToplistSkeleton` es lo que se ve mientras
// la lista no se puede contar (lo que depende del rango se cuenta en el navegador, con su reloj y su zona).

import { Text, type TextColor } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import Link from '@/app/_ui/Link'
import { PropsWithChildren, ReactNode } from 'react'

export const ToplistHeader = ({
  title,
  caption,
}: {
  title: ReactNode
  caption?: ReactNode
}) => (
  <Box
    alignItems="baseline"
    columnGap="m"
    paddingBottom="l"
    borderBottomWidth={1}
    borderStyle="solid"
    borderColor="border-primary"
  >
    {/* MaKo: el nombre de la sección no se parte («At / Risk» en dos renglones) y la bajada es la que cede: se acomoda al
        lado y, si no entra, baja de renglón, como en la referencia de Polar. */}
    <Text variant="body" as="h2" wrap="nowrap" style={{ flexShrink: 0 }}>
      {title}
    </Text>
    {caption ? (
      <Text color="muted" variant="body" style={{ minWidth: 0 }}>
        {caption}
      </Text>
    ) : null}
  </Box>
)

// Rows carry `m` horizontal padding for their hover surface; the negative
// margin offsets it so row content aligns with the section title above.
export const Toplist = ({ children }: PropsWithChildren) => (
  <div className="-mx-3">
    <Box as="ul" flexDirection="column">
      {children}
    </Box>
  </div>
)

export interface ToplistItemProps extends PropsWithChildren {
  href?: string
}

export const ToplistItem = ({ href, children }: ToplistItemProps) => {
  const row = (
    <Box
      alignItems="center"
      columnGap="m"
      paddingHorizontal="m"
      paddingVertical="s"
      borderRadius="s"
      backgroundColor={{ hover: 'background-card' }}
      transitionProperty="colors"
      transitionDuration="instant"
    >
      {children}
    </Box>
  )
  return (
    <Box as="li" flexDirection="column">
      {href ? <Link href={href}>{row}</Link> : row}
    </Box>
  )
}

export const ToplistText = ({
  primary,
  secondary,
}: {
  primary: ReactNode
  secondary?: ReactNode
}) => (
  <Box flexDirection="column" flex={1} minWidth={0}>
    <Text truncate>{primary}</Text>
    {secondary ? (
      <Text truncate color="muted" variant="caption">
        {secondary}
      </Text>
    ) : null}
  </Box>
)

export const ToplistValue = ({
  value,
  caption,
  captionColor = 'muted',
}: {
  value: ReactNode
  caption?: ReactNode
  captionColor?: TextColor
}) => (
  // MaKo: el monto y su leyenda no ceden ni se parten (el nombre de la izquierda es el que se corta con «…»).
  <Box flexDirection="column" alignItems="end" flexShrink={0}>
    <Text wrap="nowrap">{value}</Text>
    {caption ? (
      <Text color={captionColor} variant="caption" wrap="nowrap">
        {caption}
      </Text>
    ) : null}
  </Box>
)

export const ToplistSkeleton = ({ rows = 3 }: { rows?: number }) => (
  <div className="-mx-3 animate-pulse">
    <Box flexDirection="column">
      {Array.from({ length: rows }).map((_, index) => (
        <Box
          key={index}
          alignItems="center"
          columnGap="m"
          paddingHorizontal="m"
          paddingVertical="m"
        >
          <Box
            width={32}
            height={32}
            borderRadius="full"
            backgroundColor="background-card"
            flexShrink={0}
          />
          <Box flexDirection="column" rowGap="xs" flex={1}>
            <Box
              height={14}
              width="40%"
              borderRadius="s"
              backgroundColor="background-card"
            />
            <Box
              height={10}
              width="55%"
              borderRadius="s"
              backgroundColor="background-card"
            />
          </Box>
          <Box flexDirection="column" rowGap="xs" alignItems="end">
            <Box
              height={14}
              width={56}
              borderRadius="s"
              backgroundColor="background-card"
            />
            <Box
              height={10}
              width={40}
              borderRadius="s"
              backgroundColor="background-card"
            />
          </Box>
        </Box>
      ))}
    </Box>
  </div>
)

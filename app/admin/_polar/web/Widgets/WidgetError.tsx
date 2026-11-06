'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Widgets/WidgetError.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «Retry» vuelve a pedir la página (el server lee de nuevo: en MaKo no hay un `refetch` de React Query), y lleva el
// «Reportar a Soporte» de todo aviso de error (AGENTS.md), con el motivo que dio la lectura.

import { Button, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'

export const WidgetError = ({
  title,
  detail,
  onRetry,
}: {
  title: string
  /** Por qué no se pudo (lo que contestó la lectura). */
  detail?: string
  onRetry: () => void
}) => (
  <Box
    flex={1}
    flexDirection="column"
    justifyContent="end"
    alignItems="start"
    rowGap="s"
    paddingBottom="xl"
  >
    <Text>{title}</Text>
    {detail && (
      <Text color="muted" truncate={2}>
        {detail}
      </Text>
    )}
    <Box alignItems="center" columnGap="s">
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Reintentar
      </Button>
      <ReportarASoporte error={detail ? `${title}: ${detail}` : title} />
    </Box>
  </Box>
)

'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Widgets/ActivityWidget.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: «lo último que pasó» son los pagos que entraron (lib/admin-ingresos.ts) y lo que hizo MaKo (lib/actividad.ts); el
// armado, en app/admin/_polar/datos/resumen.ts (`actividadReciente`). Polar los pedía con `useEvents` y `useEventTypeStats`
// y cambiaba el día a la medianoche con un timer: acá lo lee el server en cada carga, con el día de la plataforma.

import { Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { useRouter } from '@/app/_ui/Link'
import type { Actividad, Lectura } from '@/app/admin/_polar/datos/resumen'
import { ListRow } from './ListRow'
import { WidgetContainer } from './WidgetContainer'
import { WidgetError } from './WidgetError'
import { WidgetLink } from './WidgetLink'

const WIDGET_TITLE = 'Activity'

interface ActivityWidgetProps {
  className?: string
  actividad: Lectura<Actividad>
}

export const ActivityWidget = ({ className, actividad }: ActivityWidgetProps) => {
  const router = useRouter()
  const rows = actividad.ok ? actividad.datos.filas : []
  const todaysCount = actividad.ok ? `${actividad.datos.hoy.toLocaleString('es-AR')}${actividad.datos.hoyMas ? '+' : ''}` : null

  return (
    <WidgetContainer
      title={WIDGET_TITLE}
      headline={
        <Box alignItems="baseline" columnGap="m">
          <Text variant="heading-m" weight="book">
            {todaysCount ?? '–'}
          </Text>
          <Text color="muted">{actividad.ok && actividad.datos.hoy === 1 ? 'evento hoy' : 'eventos hoy'}</Text>
        </Box>
      }
      action={<WidgetLink href="/admin/analytics/events" />}
      className={className}
    >
      {!actividad.ok ? (
        <WidgetError title="No pude leer la actividad" detail={actividad.error} onRetry={() => router.refresh()} />
      ) : rows.length === 0 ? (
        <Box
          flex={1}
          flexDirection="column"
          justifyContent="end"
          rowGap="xs"
          paddingBottom="xl"
        >
          <Text>Todavía no hay actividad</Text>
          <Text color="muted">
            Los pagos que entran y lo que hace MaKo en cada negocio aparecen aquí.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="column" paddingBottom="m">
          {rows.map((row) => (
            <ListRow key={row.id} href={row.href ?? undefined}>
              <Box alignItems="baseline" columnGap="s" minWidth={0}>
                <Text truncate>{row.titulo}</Text>
                {row.detalle && (
                  <Text color="muted" truncate>
                    {row.detalle}
                  </Text>
                )}
              </Box>
              <Text color="muted" tabularNums>
                {row.cuando}
              </Text>
            </ListRow>
          ))}
        </Box>
      )}
    </WidgetContainer>
  )
}

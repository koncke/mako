// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/events/rangePresets.ts. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los rangos cortos de Polar, en español. El que abre por default NO es «los últimos 30 minutos»: Polar lo elige
// porque sus clientes mandan miles de eventos por hora; en MaKo los eventos son pagos, errores y sesiones, y media hora
// casi siempre estaría vacía. Abre en los últimos 3 meses (uno de los rangos de siempre, `dateRangeIntervals`).

import { DateRangeInterval } from '@/app/admin/_polar/web/Metrics/DateRangePicker'
import { subDays, subHours, subMinutes } from 'date-fns'

export const DEFAULT_RANGE = 'last3Months'

export const recentRangeIntervals = (now: Date): DateRangeInterval[] => [
  {
    slug: 'last30Minutes',
    label: 'Últimos 30 minutos',
    value: [subMinutes(now, 30), now],
  },
  { slug: 'lastHour', label: 'Última hora', value: [subHours(now, 1), now] },
  {
    slug: 'last12Hours',
    label: 'Últimas 12 horas',
    value: [subHours(now, 12), now],
  },
  { slug: 'lastDay', label: 'Último día', value: [subDays(now, 1), now] },
  { slug: 'last3Days', label: 'Últimos 3 días', value: [subDays(now, 3), now] },
]

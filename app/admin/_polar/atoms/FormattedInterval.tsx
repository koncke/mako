// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/packages/ui/src/components/atoms/FormattedInterval.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: la cuenta vive en ./intervalo.ts (pura, con test): en español va el orden del español («1–6 nov 2026»), no el del
// inglés de Polar («1 nov – 6, 2026»).

import { useMemo } from 'react'
import { formatearIntervalo } from './intervalo'

interface FormattedIntervalProps {
  startDatetime: Date | string
  endDatetime: Date | string
  locale?: string
  hideCurrentYear?: boolean
}

const FormattedInterval: React.FC<FormattedIntervalProps> = ({
  startDatetime,
  endDatetime,
  locale = 'es',
  hideCurrentYear = true,
}) => {
  const formatted = useMemo(
    () => formatearIntervalo(startDatetime, endDatetime, { locale, hideCurrentYear }),
    [startDatetime, endDatetime, locale, hideCurrentYear],
  )

  return <>{formatted}</>
}

export default FormattedInterval

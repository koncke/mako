// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Shared/AmountLabel.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ Vive en Products/ y no en Shared/: lo usa sólo el precio de un plan. `amount` va en CENTAVOS, como en Polar (MaKo
//    guarda dólares: quien llama multiplica por 100). Los intervalos, en español (Polar escribe «/ mo», «/ yr»).

import { formatCurrency } from '@/app/admin/_polar/lib/currency'
import { useMemo } from 'react'

export type RecurringInterval = 'day' | 'week' | 'month' | 'year'

interface AmountLabelProps {
  amount: number
  currency: string
  interval?: RecurringInterval
  intervalCount?: number | null
  oneTime?: boolean
  verbose?: boolean
  unit?: string
}

const AmountLabel: React.FC<AmountLabelProps> = ({ amount, currency, interval, intervalCount, oneTime, verbose, unit }: AmountLabelProps) => {
  const intervalDisplay = useMemo(() => {
    if (!interval) {
      return verbose && oneTime ? ' pago único' : ''
    }
    const prefix = intervalCount && intervalCount > 1 ? ` cada ${intervalCount}` : ''

    switch (interval) {
      case 'day':
        return ` /${prefix} ${intervalCount && intervalCount > 1 ? 'días' : 'día'}`
      case 'week':
        return ` /${prefix} ${intervalCount && intervalCount > 1 ? 'semanas' : 'semana'}`
      case 'month':
        return ` /${prefix} ${intervalCount && intervalCount > 1 ? 'meses' : 'mes'}`
      case 'year':
        return ` /${prefix} ${intervalCount && intervalCount > 1 ? 'años' : 'año'}`
      default:
        return ``
    }
  }, [interval, intervalCount, oneTime, verbose])

  return (
    <span className="inline-flex flex-row items-baseline gap-x-1">
      {formatCurrency('compact')(amount, currency)}
      <span className="text-[max(12px,0.5em)]">
        {unit && ` / ${unit}`}
        {intervalDisplay}
      </span>
    </span>
  )
}

export default AmountLabel

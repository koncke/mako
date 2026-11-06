// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Subscriptions/SubscriptionStatusSelect.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { ESTADOS_SUSCRIPCION, type FiltroEstadoSuscripcion } from '@/app/admin/_polar/datos/ventas'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/app/admin/_polar/orbit'
import React from 'react'
import { subscriptionStatusDisplayNames } from './utils'

const esFiltro = (v: string): v is FiltroEstadoSuscripcion => v === 'any' || (ESTADOS_SUSCRIPCION as readonly string[]).includes(v)

interface SubscriptionStatusSelectProps {
  value: FiltroEstadoSuscripcion
  onChange: (value: FiltroEstadoSuscripcion) => void
}

const SubscriptionStatusSelect: React.FC<SubscriptionStatusSelectProps> = ({ value, onChange }) => {
  return (
    <Select value={value} onValueChange={(v) => onChange(esFiltro(v) ? v : 'any')}>
      <SelectTrigger>
        <SelectValue placeholder="Elige un estado" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">
          <span className="whitespace-nowrap">Cualquier estado</span>
        </SelectItem>
        <SelectSeparator />
        {ESTADOS_SUSCRIPCION.map((status) => (
          <React.Fragment key={status}>
            <SelectGroup>
              <SelectItem value={status}>{subscriptionStatusDisplayNames[status]}</SelectItem>
            </SelectGroup>
          </React.Fragment>
        ))}
      </SelectContent>
    </Select>
  )
}

export default SubscriptionStatusSelect

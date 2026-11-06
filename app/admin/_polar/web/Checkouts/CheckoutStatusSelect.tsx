// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/CheckoutStatusSelect/CheckoutStatusSelect.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { ESTADOS_CHECKOUT, esEstadoCheckout, type EstadoCheckout } from '@/app/admin/_polar/datos/ventas'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/app/admin/_polar/orbit'
import React from 'react'
import { CheckoutStatusDisplayTitle } from './CheckoutStatus'

interface CheckoutStatusSelectProps {
  value: EstadoCheckout | null
  onChange: (value: EstadoCheckout | null) => void
}

const CheckoutStatusSelect: React.FC<CheckoutStatusSelectProps> = ({ value, onChange }) => {
  return (
    <Select value={value ?? 'any'} onValueChange={(v) => onChange(esEstadoCheckout(v) ? v : null)}>
      <SelectTrigger>
        <SelectValue placeholder="Elige un estado" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">
          <span className="whitespace-nowrap">Cualquier estado</span>
        </SelectItem>
        <SelectSeparator />
        {ESTADOS_CHECKOUT.map((status) => (
          <SelectItem key={status} value={status}>
            {CheckoutStatusDisplayTitle[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default CheckoutStatusSelect

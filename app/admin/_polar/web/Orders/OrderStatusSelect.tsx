// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Orders/OrderStatus.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { ESTADOS_PEDIDO, esEstadoPedido, type EstadoPedido } from '@/app/admin/_polar/datos/ventas'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/app/admin/_polar/orbit'
import React from 'react'
import { OrderStatusDisplayTitle } from './OrderStatus'

interface OrderStatusSelectProps {
  value: EstadoPedido | null
  onChange: (value: EstadoPedido | null) => void
}

const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({
  value,
  onChange,
}) => {
  return (
    <Select
      value={value ?? 'any'}
      onValueChange={(value) =>
        onChange(esEstadoPedido(value) ? value : null)
      }
    >
      <SelectTrigger>
        <SelectValue placeholder="Elige un estado" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="any">
          <span className="whitespace-nowrap">Cualquier estado</span>
        </SelectItem>
        <SelectSeparator />
        {ESTADOS_PEDIDO.map((status) => (
          <SelectItem key={status} value={status}>
            {OrderStatusDisplayTitle[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export default OrderStatusSelect

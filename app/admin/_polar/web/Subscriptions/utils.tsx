// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Subscriptions/utils.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: los estados que MaKo llena (Activa, Atrasada, Cortada), con los colores de Polar.

import { ROTULO_ESTADO_SUSCRIPCION, type EstadoSuscripcionVenta } from '@/app/admin/_polar/datos/ventas'
import type { PillColor } from '@/app/admin/_polar/orbit'

export const subscriptionStatusDisplayNames: { [key in EstadoSuscripcionVenta]: string } = ROTULO_ESTADO_SUSCRIPCION

export const getSubscriptionStatusColor = (status: EstadoSuscripcionVenta, isEnding = false): PillColor => {
  switch (status) {
    case 'active':
      return isEnding ? 'yellow' : 'green'
    case 'past_due':
      return 'yellow'
    case 'canceled':
      return 'red'
    default:
      return 'gray'
  }
}

const STATUS_BORDER_COLOR: Record<PillColor, string> = {
  green: 'border-emerald-500',
  yellow: 'border-yellow-500',
  red: 'border-red-500',
  blue: 'border-blue-500',
  gray: 'dark:border-polar-500 border-gray-500',
  purple: 'border-purple-500',
}

export const getSubscriptionStatusBorderColor = (status: EstadoSuscripcionVenta, isEnding = false): string =>
  STATUS_BORDER_COLOR[getSubscriptionStatusColor(status, isEnding)]

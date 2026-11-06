'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/subscriptions/SubscriptionFilters.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el estado y el rango de fechas (en qué fecha empezó). Sin el producto, sin «se corta al final del período» (MaKo no lo
// guarda) y sin el FilterPopover del teléfono (los dos filtros entran en el ancho).

import SubscriptionStatusSelect from '@/app/admin/_polar/web/Subscriptions/SubscriptionStatusSelect'
import { DateRangeSelect } from '@/app/admin/_polar/web/Orders/DateRangeSelect'
import type { FiltroEstadoSuscripcion, Intervalo } from '@/app/admin/_polar/datos/ventas'
import { FileDownloadOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import React from 'react'

interface SubscriptionFiltersProps {
  status: FiltroEstadoSuscripcion
  onStatusSelect: (value: FiltroEstadoSuscripcion) => void
  intervalo: Intervalo
  onDateChange: (value: Intervalo) => void
  onExport: () => void
}

const SubscriptionFilters: React.FC<SubscriptionFiltersProps> = ({ status, onStatusSelect, intervalo, onDateChange, onExport }) => {
  return (
    <Box
      flexDirection={{ base: 'column', md: 'row' }}
      alignItems={{ base: 'stretch', md: 'center' }}
      justifyContent="between"
      gap="l"
    >
      <Box display="flex" flexWrap="wrap" alignItems="center" gap="l" width={{ base: '100%', md: 'auto' }}>
        <Box display="block">
          <SubscriptionStatusSelect value={status} onChange={onStatusSelect} />
        </Box>
        <DateRangeSelect value={intervalo} onChange={onDateChange} />
      </Box>
      <Button onClick={onExport} className="flex w-full flex-row items-center md:w-auto" variant="secondary" wrapperClassNames="gap-x-2">
        <FileDownloadOutlined fontSize="inherit" />
        <Text>Exportar</Text>
      </Button>
    </Box>
  )
}

export default SubscriptionFilters

'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/sales/SalesFilters.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: sin el selector de producto (un pago de MaKo no tiene producto del catálogo) ni el FilterPopover del teléfono (los dos
// filtros entran en el ancho). El rango de fechas, con los intervalos de Polar. «Cargar pago» va al lado de «Export»: lo pidió
// Martín; sin el libro de recibos (falta la migración, o no se pudo leer), el botón no se dibuja y se dice por qué.

import OrderStatusSelect from '@/app/admin/_polar/web/Orders/OrderStatusSelect'
import { DateRangeSelect } from '@/app/admin/_polar/web/Orders/DateRangeSelect'
import type { EstadoPedido, Intervalo } from '@/app/admin/_polar/datos/ventas'
import type { EstadoLibro } from '@/app/admin/_polar/datos/ventas-server'
import { FileDownloadOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import React from 'react'

interface SalesFiltersProps {
  status: EstadoPedido | null
  onStatusSelect: (value: EstadoPedido | null) => void
  intervalo: Intervalo
  onDateChange: (value: Intervalo) => void
  onExport: () => void
  onCargarPago?: () => void
  libro: EstadoLibro
}

const SalesFilters: React.FC<SalesFiltersProps> = ({
  status,
  onStatusSelect,
  intervalo,
  onDateChange,
  onExport,
  onCargarPago,
  libro,
}) => {
  return (
    <Box
      flexDirection={{ base: 'column', md: 'row' }}
      alignItems={{ base: 'stretch', md: 'center' }}
      justifyContent="between"
      gap="l"
    >
      <Box
        display="flex"
        flexWrap="wrap"
        alignItems="center"
        gap="m"
        width={{ base: '100%', md: 'auto' }}
      >
        <Box
          width={{ base: '100%', sm: 'auto' }}
          minWidth={{ sm: 160 }}
          maxWidth={{ md: 200 }}
          flexGrow={{ sm: 1, md: 0 }}
        >
          <OrderStatusSelect value={status} onChange={onStatusSelect} />
        </Box>
        <DateRangeSelect value={intervalo} onChange={onDateChange} />
      </Box>
      <Box display="flex" flexWrap="wrap" alignItems="center" gap="m">
        {libro.estado === 'falta-migracion' && <Text color="muted">Los recibos todavía no están listos: falta aplicar la migración 0397.</Text>}
        <Button
          onClick={onExport}
          className="flex w-full flex-row items-center md:w-auto"
          variant="secondary"
          wrapperClassNames="gap-x-2"
        >
          <FileDownloadOutlined fontSize="inherit" />
          <Text>Exportar</Text>
        </Button>
        {onCargarPago && (
          <Button onClick={onCargarPago} className="w-full md:w-auto">
            Cargar pago
          </Button>
        )}
      </Box>
    </Box>
  )
}

export default SalesFilters

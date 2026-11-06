'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/finance/(wide)/income/IncomePageHeader.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El botón «Exportar» de la cabecera de Income (el «Export» de Polar, con el mismo nombre que el de Sales › Orders). Recibe los
// movimientos en vez de la cuenta de Polar (`useOrganizationAccount`): el archivo se arma en el navegador con lo que la página
// ya tiene.

import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import ExportTransactionsModal from '@/app/admin/_polar/web/Transactions/ExportTransactionsModal'
import { Button, Text } from '@/app/admin/_polar/orbit'
import { FileDownloadOutlined } from '@/app/admin/_polar/orbit/icons'
import { twMerge } from 'tailwind-merge'
import type { MovimientoIngreso } from '@/app/admin/_polar/datos/finanzas'

export function IncomePageHeader({ filas, hoy, className }: { filas: MovimientoIngreso[]; hoy: string; className?: string }) {
  const { isShown: isExportModalShown, show: showExportModal, hide: hideExportModal } = useModal()

  return (
    <>
      <Button
        onClick={showExportModal}
        className={twMerge('flex w-full flex-row items-center md:w-auto', className)}
        variant="secondary"
        wrapperClassNames="gap-x-2"
      >
        <FileDownloadOutlined fontSize="inherit" />
        <Text>Exportar</Text>
      </Button>
      <ExportTransactionsModal filas={filas} hoy={hoy} isShown={isExportModalShown} hide={hideExportModal} />
    </>
  )
}

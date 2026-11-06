'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerPageShell.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: arriba el nombre del negocio y, en gris, su número (Polar pone el email del cliente: un negocio no tiene uno propio; el
// de sus personas vive en Members). Debajo de la subnav, lo que no se pudo leer (`avisos`): lo que se muestra puede quedarse
// corto, y se dice.

import { MasterDetailLayoutContent } from '@/app/admin/_polar/web/Layout/MasterDetailLayout'
import type { NegocioCabecera } from '@/app/admin/_polar/datos/cliente'
import { Alert, Text } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { PropsWithChildren } from 'react'
import { CustomerHeader } from './CustomerHeader'
import { CustomerSubnav } from './CustomerSubnav'

interface CustomerPageShellProps extends PropsWithChildren {
  negocio: NegocioCabecera
  /** Lo que no se pudo leer para esta página. */
  avisos?: readonly string[]
}

export const CustomerPageShell = ({
  negocio,
  avisos = [],
  children,
}: CustomerPageShellProps) => {
  return (
    <MasterDetailLayoutContent
      header={
        <>
          <Box flexDirection="column">
            <Text variant="heading-xs" as="h1">
              {negocio.nombre || '—'}
            </Text>
            <Text variant="heading-xs" color="muted">
              {`Negocio #${negocio.ws}`}
            </Text>
          </Box>

          <CustomerHeader negocio={negocio} />
        </>
      }
    >
      <Box flexDirection="column" rowGap="3xl">
        <CustomerSubnav ws={negocio.ws} />
        {avisos.length > 0 && (
          <Alert
            variant="warning"
            title="Puede faltar algo"
            description={`No se pudo leer: ${avisos.join('; ')}.`}
          />
        )}
        {children}
      </Box>
    </MasterDetailLayoutContent>
  )
}

'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerMembers.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: todo negocio tiene su equipo (Polar dibuja esto sólo para un Customer `team`). Las personas llegan del server; Polar
// pide también sus suscripciones y pedidos para leer los lugares (seats) de cada miembro: MaKo no vende lugares por persona,
// así que no hace falta. Sin personas, el estado vacío de Polar: lo que falta, en una frase.

import type { MiembroNegocio } from '@/app/admin/_polar/datos/cliente'
import { PeopleAltOutlined } from '@/app/admin/_polar/orbit/icons'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import { MembersSection } from './MembersSection'

interface CustomerMembersProps {
  miembros: MiembroNegocio[]
}

export const CustomerMembers = ({ miembros }: CustomerMembersProps) => {
  if (miembros.length === 0) {
    return (
      <EmptyState
        icon={<PeopleAltOutlined fontSize="medium" />}
        title="Sin personas"
        description="Este negocio no tiene a nadie con cuenta: nadie puede entrar."
      />
    )
  }

  return <MembersSection miembros={miembros} />
}

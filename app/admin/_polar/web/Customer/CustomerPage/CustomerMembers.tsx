'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerMembers.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: todo negocio tiene su equipo (Polar dibuja esto sólo para un Customer `team`). Las personas llegan del server; Polar
// pide también sus suscripciones y pedidos para leer los lugares (seats) de cada miembro: MaKo no vende lugares por persona,
// así que no hace falta. Sin personas, el estado vacío de Polar lo dibuja MembersSection, con «Agregar persona» a la vista
// (sin eso, a un negocio sin nadie no había cómo sumarle a alguien).

import type { MiembroNegocio } from '@/app/admin/_polar/datos/cliente'
import { MembersSection } from './MembersSection'

interface CustomerMembersProps {
  ws: number
  miembros: MiembroNegocio[]
  /** Los negocios a los que se puede mudar a alguien. `null` = no se pudieron leer. */
  negocios: ReadonlyArray<{ ws: number; nombre: string }> | null
}

export const CustomerMembers = ({ ws, miembros, negocios }: CustomerMembersProps) => (
  <MembersSection
    miembros={miembros}
    destino={{ ws }}
    negocios={negocios}
    vacio={{ titulo: 'Sin personas', texto: 'Este negocio no tiene a nadie con cuenta: nadie puede entrar.' }}
  />
)

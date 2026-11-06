'use client'

// La raíz de Admin: el layout de Polar (app/admin/_polar/web/Layout/DashboardLayout.tsx) con su búsqueda ⌘K (OmniSearch).
// Es un componente de cliente porque la búsqueda se pasa como función; el índice lo lee el server (app/admin/(polar)/layout.tsx).

import type { ReactNode } from 'react'
import DashboardLayout from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { OmniSearch } from '@/app/admin/_polar/web/Search/OmniSearch'
import type { IndiceBusqueda } from '@/app/admin/_polar/datos/busqueda-tipos'

export function AdminShell({ children, indice }: { children: ReactNode; indice: IndiceBusqueda }) {
  return (
    <DashboardLayout search={({ open, onOpenChange }) => <OmniSearch open={open} onOpenChange={onOpenChange} indice={indice} />}>
      {children}
    </DashboardLayout>
  )
}

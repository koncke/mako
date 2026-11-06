'use client'

// La raíz de Admin: el layout de Polar (app/admin/_polar/web/Layout/DashboardLayout.tsx) con su búsqueda ⌘K (OmniSearch).
// Es un componente de cliente porque la búsqueda se pasa como función; el índice lo lee el server (app/admin/(polar)/layout.tsx).
//
// ⚠️ EL LazyMotion ES OBLIGATORIO. Los layouts de Polar animan con `m.div` (el componente liviano de motion), y `m` sólo anima
// adentro de un `LazyMotion`: sin él todo se queda en su estado inicial, `opacity: 0`, y Admin se ve EN BLANCO sin un error.
// Polar lo monta en su raíz (clients/apps/web/src/app/providers.tsx, `PolarMotionProvider`); acá va en la raíz de Admin.
// Lo fija tests/admin-polar-arreglos.test.ts.

import type { ReactNode } from 'react'
import { domAnimation, LazyMotion } from 'motion/react'
import DashboardLayout from '@/app/admin/_polar/web/Layout/DashboardLayout'
import { OmniSearch } from '@/app/admin/_polar/web/Search/OmniSearch'
import type { IndiceBusqueda } from '@/app/admin/_polar/datos/busqueda-tipos'

export function AdminShell({ children, indice }: { children: ReactNode; indice: IndiceBusqueda }) {
  return (
    <LazyMotion features={domAnimation}>
    <DashboardLayout search={({ open, onOpenChange }) => <OmniSearch open={open} onOpenChange={onOpenChange} indice={indice} />}>
      {children}
    </DashboardLayout>
    </LazyMotion>
  )
}

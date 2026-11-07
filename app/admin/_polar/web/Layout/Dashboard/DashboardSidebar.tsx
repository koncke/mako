'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Layout/Dashboard/DashboardSidebar.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ LO QUE SE SACÓ, por pedido de Martín (6/11/2026: «sin barra superior, sin logo, sin selector de organización y sin
//    cuenta en el pie: /admin usa la barra de MaKo que ya existe a la izquierda, y ésa es el ÚNICO lugar del perfil y del
//    modo oscuro»): el logotipo de Polar, las notificaciones, el banner de sandbox o impersonación, el aviso de los planes
//    de Polar, el botón de soporte, el link a su documentación y el menú de la organización y de la cuenta del pie.
//    Queda lo que es de la navegación: el botón de búsqueda (abre el ⌘K, OmniSearch), la barra de secciones y la de Settings.

import { Search } from '@/app/admin/_polar/orbit/icons'
import { Button } from '@/app/admin/_polar/orbit'
import { Sidebar, SidebarContent, SidebarHeader } from '@/app/admin/_polar/atoms/Sidebar'
import { m } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { OrganizationNavigation, SettingsNavigationHeader, useIsSettingsPath } from './DashboardNavigation'

export const DashboardSidebar = ({ search }: { search?: (o: { open: boolean; onOpenChange: (v: boolean) => void }) => ReactNode }) => {
  const [searchOpen, setSearchOpen] = useState(false)
  const isSettingsPath = useIsSettingsPath()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // MaKo: `toLowerCase` como la búsqueda de la barra de MaKo (BuscadorNav): con Bloq Mayús o Shift llega «K», y sin esto
      // ese Ctrl K se lo quedaba la de MaKo. Va en `document`, que corre antes que el `window` de aquélla, y el preventDefault le
      // dice que no abra la suya: en Admin, el atajo abre SÓLO ésta.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader className="flex flex-row items-center justify-end md:pt-3.5">
        <m.div className="flex flex-row items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
          <Button className="relative size-8! p-0" variant="ghost" onClick={() => setSearchOpen(true)} aria-label="Buscar">
            <Search size={16} aria-hidden="true" />
          </Button>
        </m.div>
      </SidebarHeader>
      {isSettingsPath && (
        <div className="px-2 pt-2">
          <SettingsNavigationHeader />
        </div>
      )}
      <SidebarContent className="gap-4 px-2 py-2">
        {search?.({ open: searchOpen, onOpenChange: setSearchOpen })}
        <m.div className="flex flex-col items-center gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }}>
          <OrganizationNavigation />
        </m.div>
      </SidebarContent>
    </Sidebar>
  )
}

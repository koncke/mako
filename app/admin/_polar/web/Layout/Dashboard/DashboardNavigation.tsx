'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Layout/Dashboard/DashboardNavigation.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// En MaKo no hay organización (Admin es la plataforma), ni la navegación de catálogo ni la de la cuenta (el perfil vive en
// la barra de MaKo): quedan la estándar y la de Settings, con su «← Settings».

import { ArrowBack } from '@/app/admin/_polar/orbit/icons'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/app/admin/_polar/atoms/Sidebar'
import Link from '@/app/_ui/Link'
import { twMerge } from 'tailwind-merge'
import { usePathname } from 'next/navigation'
import { BASE, useGeneralRoutes, useOrganizationRoutes } from '../../Dashboard/navigation'
import { useSettingsRouteGroups } from '../../Dashboard/navigationSettings'
import { NavList } from './NavList'

export const useIsSettingsPath = () => {
  const pathname = usePathname() ?? ''
  return pathname.startsWith(`${BASE}/settings`)
}

export const SettingsNavigationHeader = () => (
  <SidebarMenu>
    <BackLink href={BASE} title="Settings" />
  </SidebarMenu>
)

export const OrganizationNavigation = () => {
  if (useIsSettingsPath()) {
    return <SettingsNavigation />
  }
  return <StandardOrganizationNavigation />
}

const StandardOrganizationNavigation = () => {
  const routes = [...useGeneralRoutes(), ...useOrganizationRoutes()]
  return <NavList routes={routes} navType="organization" />
}

const BackLink = ({ href, title, className }: { href: string; title: string; className?: string }) => {
  const { isMobile, setOpenMobile } = useSidebar()
  return (
    <SidebarMenuItem className={twMerge('flex flex-row items-center gap-2', className)}>
      <SidebarMenuButton tooltip="Volver al panel" asChild>
        <Link
          href={href}
          className="dark:hover:bg-polar-900! flex flex-row items-center gap-4 rounded-lg px-2 text-black transition-colors duration-75 hover:bg-white! dark:text-white"
          onClick={() => {
            if (isMobile) setOpenMobile(false)
          }}
        >
          <span className="flex flex-col items-center justify-center overflow-visible rounded-full bg-transparent text-[15px]">
            <ArrowBack fontSize="inherit" />
          </span>
          <span>{title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

const SettingsNavigation = () => {
  const groups = useSettingsRouteGroups()
  return (
    <div className="flex w-full flex-col gap-6">
      {groups.map((group, index) => (
        <div key={group.title} className="flex w-full flex-col gap-2">
          {index > 0 && <span className="dark:text-polar-500 px-2 text-xs font-medium text-gray-400">{group.title}</span>}
          <NavList routes={group.routes} navType="organization" />
        </div>
      ))}
    </div>
  )
}

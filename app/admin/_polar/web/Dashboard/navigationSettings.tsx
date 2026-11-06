'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Dashboard/navigationSettings.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

// ⚠️ En MaKo, Settings es de la plataforma (Admin es UNA organización): de los grupos de Polar quedan los que MaKo llena.
//    Organization › General (los datos que salen en cada recibo) y Members (las personas de la plataforma, segundo como en
//    Polar: punto 25 de la revisión del 6/11/2026), y Payments › Payments y Customer Notifications (los interruptores de
//    cobros: precios en la moneda de Mercado Pago, el precio del cliente de agencia, el recibo por WhatsApp). Lo demás de Polar
//    (Billing, SSO, Domains, Webhooks, Developers, Account…) no tiene un dato de MaKo detrás: se sacó sin dejar hueco
//    (docs/relevo/nube-admin-polar.md).


import { Mail, Settings2, Users, Wallet } from '@/app/admin/_polar/orbit/icons'
import { useMemo } from 'react'
import { BASE, Route, RouteWithActive, useResolveRoutes } from './navigation'

export type SettingsRouteGroup = {
  readonly title: string
  readonly routes: RouteWithActive[]
}

type SettingsGroupDefinition = {
  readonly title: string
  readonly routes: Route[]
}

const base = `${BASE}/settings`

/** Los grupos de la barra de Settings (exportado para los tests: el orden es el de Polar, con Members segundo). */
export const settingsGroupsList = (): SettingsGroupDefinition[] => [
  {
    title: 'Organization',
    routes: [
      { id: 'settings-general', title: 'General', link: base, icon: <Settings2 size="1em" />, if: true, checkIsActive: (path) => path === base },
      { id: 'settings-members', title: 'Members', link: `${base}/members`, icon: <Users size="1em" />, if: true },
    ],
  },
  {
    title: 'Payments',
    routes: [
      { id: 'settings-payments', title: 'Payments', link: `${base}/payments`, icon: <Wallet size="1em" />, if: true },
      { id: 'settings-customer-notifications', title: 'Customer Notifications', link: `${base}/customer-notifications`, icon: <Mail size="1em" />, if: true },
    ],
  },
]


const settingsRoutesList = (): Route[] => settingsGroupsList().flatMap((group) => group.routes)

export const useSettingsRoutes = (): RouteWithActive[] => useResolveRoutes(settingsRoutesList)

export const useSettingsRouteGroups = (): SettingsRouteGroup[] => {
  const routes = useSettingsRoutes()
  return useMemo(() => {
    const routesById = new Map(routes.map((route) => [route.id, route]))
    return settingsGroupsList()
      .map((group) => ({
        title: group.title,
        routes: group.routes.flatMap((route) => {
          const resolved = routesById.get(route.id)
          return resolved ? [resolved] : []
        }),
      }))
      .filter((group) => group.routes.length > 0)
  }, [routes])
}

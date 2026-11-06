'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Dashboard/navigation.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// LAS RUTAS DE ADMIN. Es la misma barra de Polar con el orden que pidió Martín (6/11/2026): Overview · Customers ·
// Analytics · Sales · Products · Finance · Settings, y las subpáginas de Polar que MaKo puede llenar. Lo que Polar tiene y
// MaKo no (Discounts, Benefits, Meters, Payouts, Taxes, Account) se sacó sin dejar hueco: docs/relevo/nube-admin-polar.md.
// La organización de Polar no existe acá (Admin es UNA: la plataforma), así que las rutas cuelgan de /admin.

import {
  AllInclusiveOutlined,
  AttachMoneyOutlined,
  GavelOutlined,
  HiveOutlined,
  LinkOutlined,
  PeopleAltOutlined,
  ShoppingBagOutlined,
  ShoppingCart,
  SpaceDashboardOutlined,
  TrendingUpFilled as TrendingUp,
  TuneOutlined,
} from '@/app/admin/_polar/orbit/icons'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

export const BASE = '/admin'

export type SubRoute = {
  readonly title: string
  readonly link: string
  readonly icon?: React.ReactNode
  readonly if?: boolean | (() => boolean)
  readonly extra?: React.ReactNode
}

export type Route = {
  readonly id: string
  readonly title: string
  readonly icon?: React.ReactElement
  readonly link: string
  readonly if: boolean | undefined
  readonly subs?: SubRoute[]
  readonly selectedExactMatchOnly?: boolean
  readonly selectedMatchFallback?: boolean
  readonly checkIsActive?: (currentPath: string) => boolean
  readonly extra?: React.ReactNode
  readonly trailing?: React.ReactNode
}

export type SubRouteWithActive = SubRoute & { readonly isActive: boolean }

export type RouteWithActive = Route & {
  readonly isActive: boolean
  readonly subs?: SubRouteWithActive[]
}

const applySubRouteIsActive = (path: string, parentRoute?: Route): ((r: SubRoute) => SubRouteWithActive) => {
  return (r: SubRoute): SubRouteWithActive => {
    let isActive = r.link === path

    if (!isActive && path.startsWith(r.link)) {
      if (parentRoute?.link !== r.link) {
        isActive = true
      } else if (parentRoute.subs) {
        const hasMoreSpecificMatch = parentRoute.subs.some(
          (sub) => sub !== r && sub.link !== r.link && path.startsWith(sub.link),
        )
        isActive = !hasMoreSpecificMatch
      }
    }

    return { ...r, isActive }
  }
}

const applyIsActive = (path: string): ((r: Route) => RouteWithActive) => {
  return (r: Route): RouteWithActive => {
    let isActive = false
    if (r.checkIsActive !== undefined) {
      isActive = r.checkIsActive(path)
    } else {
      // Fallback
      isActive = Boolean(path && path.startsWith(r.link))
    }
    const subs = r.subs ? r.subs.map(applySubRouteIsActive(path, r)) : undefined
    return { ...r, isActive, subs }
  }
}

export const useResolveRoutes = (routesResolver: () => Route[], allowAll?: boolean): RouteWithActive[] => {
  const path = usePathname() ?? BASE
  return useMemo(() => {
    return (
      routesResolver()
        .filter((o) => allowAll || o.if)
        // Filter out child routes if they have an if-function and it evaluates to false
        .map((route) => {
          if (route.subs && Array.isArray(route.subs)) {
            return {
              ...route,
              subs: route.subs.filter(
                (child) => typeof child.if === 'undefined' || (typeof child.if === 'function' ? child.if() : child.if),
              ),
            }
          }
          return route
        })
        .map(applyIsActive(path))
    )
  }, [path, allowAll, routesResolver])
}

export const useDashboardRoutes = (allowAll?: boolean): RouteWithActive[] => {
  return useResolveRoutes(dashboardRoutesList, allowAll)
}

export const useGeneralRoutes = (allowAll?: boolean): RouteWithActive[] => {
  return useResolveRoutes(generalRoutesList, allowAll)
}

export const useOrganizationRoutes = (allowAll?: boolean): RouteWithActive[] => {
  return useResolveRoutes(organizationRoutesList, allowAll)
}

// internals below

export const generalRoutesList = (): Route[] => [
  {
    id: 'home',
    title: 'Overview',
    icon: <SpaceDashboardOutlined fontSize="inherit" />,
    link: BASE,
    checkIsActive: (currentRoute: string) => currentRoute === BASE,
    if: true,
  },
  {
    id: 'customers',
    title: 'Customers',
    icon: <PeopleAltOutlined fontSize="inherit" />,
    link: `${BASE}/customers`,
    checkIsActive: (currentRoute: string): boolean => currentRoute.startsWith(`${BASE}/customers`),
    if: true,
  },
  {
    id: 'analytics',
    title: 'Analytics',
    icon: <TrendingUp fontSize="inherit" />,
    link: `${BASE}/analytics`,
    if: true,
    subs: [
      { title: 'Metrics', link: `${BASE}/analytics/metrics` },
      { title: 'Events', link: `${BASE}/analytics/events` },
      { title: 'Costs', link: `${BASE}/analytics/costs` },
    ],
  },
  {
    id: 'org-sales',
    title: 'Sales',
    icon: <ShoppingBagOutlined fontSize="inherit" />,
    link: `${BASE}/sales`,
    checkIsActive: (currentRoute: string): boolean => currentRoute.startsWith(`${BASE}/sales`),
    if: true,
    subs: [
      { title: 'Orders', link: `${BASE}/sales`, icon: <ShoppingBagOutlined fontSize="inherit" /> },
      { title: 'Subscriptions', link: `${BASE}/sales/subscriptions`, icon: <AllInclusiveOutlined fontSize="inherit" /> },
      { title: 'Checkouts', link: `${BASE}/sales/checkouts`, icon: <ShoppingCart /> },
      { title: 'Disputes', link: `${BASE}/sales/disputes`, icon: <GavelOutlined fontSize="inherit" /> },
    ],
  },
  {
    id: 'new-products',
    title: 'Products',
    icon: <HiveOutlined fontSize="inherit" />,
    link: `${BASE}/products`,
    checkIsActive: (currentRoute: string): boolean => currentRoute.startsWith(`${BASE}/products`),
    if: true,
    subs: [
      { title: 'Catalogue', link: `${BASE}/products`, icon: <HiveOutlined fontSize="inherit" /> },
      { title: 'Checkout Links', link: `${BASE}/products/checkout-links`, icon: <LinkOutlined fontSize="inherit" /> },
    ],
  },
]

const orgFinanceSubRoutesList = (): SubRoute[] => [{ title: 'Income', link: `${BASE}/finance/income` }]

export const organizationRoutesList = (): Route[] => [
  {
    id: 'finance',
    title: 'Finance',
    link: `${BASE}/finance`,
    icon: <AttachMoneyOutlined fontSize="inherit" />,
    if: true,
    subs: orgFinanceSubRoutesList(),
  },
  {
    id: 'settings',
    title: 'Settings',
    link: `${BASE}/settings`,
    icon: <TuneOutlined fontSize="inherit" />,
    if: true,
  },
]

export const dashboardRoutesList = (): Route[] => [...generalRoutesList(), ...organizationRoutesList()]

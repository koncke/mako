'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerListSidebar.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: un Customer es un NEGOCIO (un workspace). La lista entera llega del server (app/admin/(polar)/customers/layout.tsx):
// son decenas, así que la búsqueda, el filtro y el orden se hacen en memoria (`filtrarClientes`) y no hace falta el scroll
// infinito de Polar. Lo que Polar guarda en la URL con `nuqs` (query, sorting, filter) se guarda igual, sin ir al server.
// El renglón no lleva email: las personas de un negocio viven sólo en su ficha › Members (Martín, 6/11/2026). En la segunda
// línea, donde Polar pone el email, va lo que dice ⌘K del negocio: su plan y si está pausado, y si es cliente de una agencia,
// de cuál («De Agencia Faro · MaKo Pro · Pausado»; `detalleDeNegocio`, revisión del Cerebro del 6/11/2026, punto 35): un
// negocio pausado se veía igual a uno activo y para saber el plan había que abrirlo. El filtro «Inactivos» es «Pausados».
// «Export Customers» arma el CSV en el navegador con lib/csv-celda.ts (Polar lo baja de su API).
// Dos cosas de MaKo que Polar no tiene (decisiones del Cerebro, 6/11/2026), sin cambiar lo que se ve:
//   · el filtro «De agencias» en el mismo menú de filtros (`FILTROS`, ./datos/clientes.ts): los clientes de una agencia no
//     salen en «Todos» (no son clientes de MaKo) y con ese filtro se ven, con su agencia al principio de la segunda línea;
//   · el clic derecho de la casa en cada negocio (Ver ficha · Entrar a su cuenta · Administrar, ./menu-contextual-negocios.ts),
//     lo mismo que el «⋮» de su ficha sin abrirla.

import { CreateCustomerModal } from '@/app/admin/_polar/web/Customer/CreateCustomerModal'
import { InlineModal } from '@/app/admin/_polar/orbit'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { cambiarQuery } from '@/app/admin/_polar/web/Customer/useClientSidePagination'
import {
  FILTROS,
  ROTULO_FILTRO,
  RUTA_CUSTOMERS,
  filasDeExportacion,
  filtrarClientes,
  filtroDeParam,
  ordenDeParam,
  rutaDeNegocio,
  type ClienteDeLista,
  type FiltroLista,
  type OrdenLista,
} from '@/app/admin/_polar/datos/clientes'
import type { OpcionesAlta } from '@/app/admin/_polar/datos/alta'
import { detalleDeNegocio } from '@/app/admin/_polar/datos/busqueda-tipos'
import { armarCsv } from '@/lib/csv-celda'
import { useMenuContextual } from '@/app/_ui/useMenuContextual'
import { MenuContextual } from '@/app/_ui/MenuContextual'
import { destinoNegocio, itemsNegocio, type IdOpcionNegocio } from './menu-contextual-negocios'

import {
  AddOutlined,
  ArrowDownward,
  ArrowUpward,
  CheckOutlined,
  FilterList,
  MoreVert,
  SearchFilled as Search,
} from '@/app/admin/_polar/orbit/icons'
import { Alert, Avatar } from '@/app/admin/_polar/orbit'
import { Button } from '@/app/admin/_polar/orbit'
import { Input } from '@/app/admin/_polar/orbit'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/admin/_polar/ui/dropdown-menu'
import Link, { useRouter } from '@/app/_ui/Link'
import { usePathname, useSearchParams } from 'next/navigation'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface CustomerListSidebarProps {
  customers: ClienteDeLista[] | null
  /** El motivo por el que no se pudo leer la lista. */
  error?: string | null
  /** Los planes del alta (el «+»: el único formulario de alta de Admin, app/admin/_polar/datos/alta.ts). */
  opciones: OpcionesAlta
}

export const CustomerListSidebar: React.FC<CustomerListSidebarProps> = ({
  customers: todos,
  error,
  opciones,
}) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [sorting, setSortingState] = useState<OrdenLista>(() =>
    ordenDeParam(searchParams.get('sorting')),
  )
  const [query, setQueryState] = useState<string>(
    () => searchParams.get('query') ?? '',
  )
  const [activeFilter, setActiveFilterState] = useState<FiltroLista>(() =>
    filtroDeParam(searchParams.get('filter')),
  )

  const setSorting = (v: OrdenLista) => {
    setSortingState(v)
    cambiarQuery({ sorting: v === '-created_at' ? null : v })
  }
  const setQuery = (v: string) => {
    setQueryState(v)
    cambiarQuery({ query: v })
  }
  const setActiveFilter = (v: FiltroLista) => {
    setActiveFilterState(v)
    cambiarQuery({ filter: v === 'all' ? null : v })
  }

  const customers = useMemo(
    () =>
      filtrarClientes(todos ?? [], {
        query,
        sorting,
        filter: activeFilter,
      }),
    [todos, query, sorting, activeFilter],
  )

  const {
    show: showCreateCustomerModal,
    hide: hideCreateCustomerModal,
    isShown: isCreateCustomerModalOpen,
  } = useModal()

  const onExport = useCallback(() => {
    const texto = armarCsv(filasDeExportacion(customers))
    const url = URL.createObjectURL(
      new Blob([texto], { type: 'text/csv;charset=utf-8' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `negocios-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [customers])

  const selectedCustomerId = useMemo(() => {
    const parts = pathname.split('/')
    const customerIndex = parts.indexOf('customers')
    if (customerIndex !== -1 && parts[customerIndex + 1]) {
      return parts[customerIndex + 1]
    }
    return null
  }, [pathname])

  const withQuerystring = useCallback(
    (href: string) => {
      const queryString = new URLSearchParams()

      for (const [key, value] of searchParams.entries()) {
        if (['query', 'sorting', 'filter'].includes(key)) {
          queryString.append(key, value)
        }
      }

      if (queryString.toString().length === 0) {
        return href
      }

      return `${href}?${queryString.toString()}`
    },
    [searchParams],
  )

  const menu = useMenuContextual<ClienteDeLista>()
  const onElegirDelMenu = (id: string) => {
    const negocio = menu.abierto?.de
    if (!negocio) return
    const destino = destinoNegocio(id as IdOpcionNegocio, negocio.ws, rutaDeNegocio)
    // «Entrar a su cuenta» cambia de cuenta: una navegación dura, como el <a> del «⋮» de la ficha.
    if (id === 'entrar') window.location.href = destino
    else router.push(id === 'ficha' ? withQuerystring(destino) : destino)
  }

  return (
    <>
      <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
        <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
          <Link href={withQuerystring(RUTA_CUSTOMERS)}>Customers</Link>
          <div className="flex flex-row items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  className="h-6 w-6"
                  variant="ghost"
                  aria-label="Filtrar"
                >
                  <FilterList fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {FILTROS.map((f) => (
                  <DropdownMenuItem key={f} onClick={() => setActiveFilter(f)}>
                    <CheckOutlined
                      className={twMerge(
                        'h-4 w-4',
                        activeFilter !== f && 'invisible',
                      )}
                    />
                    <span>{ROTULO_FILTRO[f]}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label={
                sorting === 'created_at'
                  ? 'Los más viejos primero'
                  : 'Los más nuevos primero'
              }
              onClick={() =>
                setSorting(
                  sorting === '-created_at' ? 'created_at' : '-created_at',
                )
              }
            >
              {sorting === 'created_at' ? (
                <ArrowUpward fontSize="small" />
              ) : (
                <ArrowDownward fontSize="small" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  aria-label="Más opciones"
                >
                  <MoreVert fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onExport} disabled={!todos}>
                  Exportar negocios
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              size="icon"
              className="h-6 w-6"
              aria-label="Nuevo negocio"
              onClick={showCreateCustomerModal}
            >
              <AddOutlined fontSize="small" />
            </Button>
          </div>
        </div>
        <div className="flex flex-row items-center gap-3 px-4 py-2">
          <div className="flex flex-1 flex-row items-center gap-3">
            <div className="dark:bg-polar-800 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
              <Search
                fontSize="inherit"
                className="dark:text-polar-500 text-gray-500"
              />
            </div>
            <Input
              className="w-full rounded-none border-none bg-transparent p-0 shadow-none! ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 dark:bg-transparent"
              placeholder="Buscar negocios"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="dark:divide-polar-800 flex h-full grow flex-col divide-y divide-gray-50 overflow-y-auto">
          {error || !todos ? (
            <div className="p-4">
              <Alert
                variant="danger"
                title="No pude leer los negocios"
                description={error ?? undefined}
                actions={[
                  { text: 'Reintentar', onClick: () => router.refresh() },
                ]}
              />
            </div>
          ) : customers.length === 0 && todos.length > 0 ? (
            <div className="dark:text-polar-500 px-4 py-8 text-center text-sm text-gray-500">
              Ningún negocio coincide con la búsqueda.
            </div>
          ) : (
            customers.map((customer) => (
              <Link
                key={customer.ws}
                href={withQuerystring(rutaDeNegocio(customer.ws))}
                {...menu.propsDe(customer)}
                className={twMerge(
                  'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                  selectedCustomerId === String(customer.ws) &&
                    'dark:bg-polar-800 bg-gray-100',
                )}
              >
                <div className="flex flex-row items-center gap-3 px-4 py-3">
                  <Avatar
                    className="h-8 w-8"
                    avatar_url={null}
                    name={customer.nombre}
                  />
                  <div className="flex min-w-0 flex-col">
                    <div className="w-full truncate text-sm">
                      {customer.nombre}
                    </div>
                    <div className="dark:text-polar-500 w-full truncate text-xs text-gray-500">
                      {detalleDeNegocio({
                        plan: customer.plan,
                        pausado: !customer.activo,
                        deAgencia: customer.deAgencia,
                        agencia: customer.agencia,
                      })}
                    </div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
      {menu.abierto && (
        <MenuContextual key={menu.abierto.n} porDedo={menu.abierto.porDedo}
          punto={{ x: menu.abierto.x, y: menu.abierto.y }}
          items={itemsNegocio()}
          etiqueta={`Acciones de ${menu.abierto.de.nombre}`}
          onCerrar={menu.cerrar}
          onElegir={onElegirDelMenu}
        />
      )}
      <InlineModal
        isShown={isCreateCustomerModalOpen}
        hide={hideCreateCustomerModal}
        modalContent={
          <CreateCustomerModal
            onClose={hideCreateCustomerModal}
            onCreated={() => router.refresh()}
            opciones={opciones}
          />
        }
      />
    </>
  )
}

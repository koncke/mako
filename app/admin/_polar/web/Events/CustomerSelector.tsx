'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Customer/CustomerSelector.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el «customer» de un evento es el NEGOCIO (un cliente de MaKo), y los que se ofrecen son los que aparecen en algún
// evento leído (no se piden por páginas a una API: `negocios` llega con la lista). Vive en web/Events y no en web/Customer:
// es el filtro de esta pantalla.

import type { NegocioEvento } from '@/app/admin/_polar/datos/eventos'
import { normalizar } from '@/app/admin/_polar/datos/eventos'
import { Close, SearchFilled as Search } from '@/app/admin/_polar/orbit/icons'
import { Avatar } from '@/app/admin/_polar/orbit'
import { Button } from '@/app/admin/_polar/orbit'
import { Input } from '@/app/admin/_polar/orbit'
import { List, ListItem } from '@/app/admin/_polar/orbit'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/app/admin/_polar/ui/popover'
import { useCallback, useMemo, useRef, useState } from 'react'

interface CustomerSelectorProps {
  negocios: readonly NegocioEvento[]
  selectedCustomerIds: number[] | null
  onSelectCustomerIds: (customerIds: number[] | null) => void
}

export const CustomerSelector = ({
  negocios,
  selectedCustomerIds,
  onSelectCustomerIds,
}: CustomerSelectorProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const allCustomers = useMemo(() => {
    const q = normalizar(query.trim())
    return q ? negocios.filter((n) => normalizar(n.nombre).includes(q)) : negocios
  }, [negocios, query])

  const selectedCustomerIdSet = new Set(selectedCustomerIds)

  const selectedCustomers = useMemo(
    () =>
      (selectedCustomerIds ?? []).flatMap((id) => {
        const customer = negocios.find((candidate) => candidate.ws === id)
        return customer ? [customer] : [{ ws: id, nombre: `Negocio ${id}` }]
      }),
    [negocios, selectedCustomerIds],
  )

  const handleToggleCustomer = useCallback(
    (customerId: number) => {
      if (selectedCustomerIds?.includes(customerId)) {
        const resto = selectedCustomerIds.filter((id) => id !== customerId)
        onSelectCustomerIds(resto.length ? resto : null)
      } else {
        onSelectCustomerIds([...(selectedCustomerIds ?? []), customerId])
      }

      inputRef.current?.blur()
    },
    [selectedCustomerIds, onSelectCustomerIds],
  )

  const handleBlur = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <div className="flex flex-col gap-y-2" onBlur={handleBlur}>
      <h3 className="text-sm">Negocios</h3>
      <Popover open={open}>
        <PopoverTrigger asChild>
          <div>
            <Input
              ref={inputRef}
              placeholder="Buscar"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              onFocus={() => setOpen(true)}
              preSlot={<Search fontSize="small" />}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="overflow-hidden p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            e.preventDefault()
          }}
          onPointerDownOutside={(e) => {
            e.preventDefault()
          }}
        >
          <div className="max-h-80 overflow-y-auto font-sans">
            {allCustomers.length > 0 ? (
              <List size="small" className="rounded-md border-0">
                {allCustomers.map((customer) => (
                  <ListItem
                    key={customer.ws}
                    size="small"
                    className="flex flex-row items-center gap-3 p-3"
                    selected={selectedCustomerIdSet.has(customer.ws)}
                    onSelect={(e) => {
                      e.preventDefault()
                      handleToggleCustomer(customer.ws)
                    }}
                  >
                    <div className="flex flex-row items-center gap-3">
                      <Avatar
                        className="size-7"
                        avatar_url={null}
                        name={customer.nombre}
                      />
                      <div className="flex flex-col">
                        <div className="w-full truncate text-sm">
                          {customer.nombre}
                        </div>
                      </div>
                    </div>
                  </ListItem>
                ))}
              </List>
            ) : (
              <div className="dark:text-polar-500 flex w-full items-center justify-center py-8 text-sm text-gray-500">
                {query ? 'No encontré ese negocio' : 'Ningún evento tiene un negocio'}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {selectedCustomers.length > 0 && (
        <List size="small" className="rounded-xl">
          {selectedCustomers.map((customer) => (
            <ListItem key={customer.ws} size="small" className="group px-3">
              <div className="flex flex-row items-center gap-3">
                <Avatar
                  className="size-7"
                  avatar_url={null}
                  name={customer.nombre}
                />
                <div className="flex flex-col">
                  <div className="w-full truncate text-sm">
                    {customer.nombre}
                  </div>
                </div>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Quitar ${customer.nombre}`}
                className="dark:text-polar-500 size-6 text-gray-500 opacity-0 transition-[opacity,background-color] group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleCustomer(customer.ws)
                }}
              >
                <Close fontSize="inherit" />
              </Button>
            </ListItem>
          ))}
        </List>
      )}
    </div>
  )
}

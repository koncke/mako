'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Products/ProductSelect.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// El selector de productos de Polar con los planes de MaKo: llegan por prop (los lee el server) y la búsqueda filtra en
// memoria, en vez de `useProducts` / `useSelectedProducts`. Los grupos por tipo de precio quedan: hoy todos los planes son
// suscripciones mensuales, así que el de «Pago único» no se dibuja (Polar lo saltea cuando está vacío).
// ⚠️ Sin `includeArchived` ni `filterByExternalId`: un plan no tiene id externo, y los archivados se ofrecen marcados.

import { Check as CheckIcon, ExpandMoreOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button } from '@/app/admin/_polar/orbit'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/app/admin/_polar/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/app/admin/_polar/ui/popover'
import React, { useCallback, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ProductPriceTypeLabel, { type ProductPriceType } from './ProductPriceTypeLabel'
import type { ProductoMako } from '@/app/admin/_polar/datos/productos'

const ProductsCommandGroup = ({
  groupedProducts,
  productPriceType,
  onSelectProduct,
  onSelectProductType,
  selectedProducts,
  className,
}: {
  groupedProducts: Record<ProductPriceType, ProductoMako[]>
  productPriceType: ProductPriceType
  onSelectProduct: (product: ProductoMako) => void
  onSelectProductType: (productPriceType: ProductPriceType) => void
  selectedProducts: ProductoMako[]
  className?: string
}) => {
  const areAllSelected = useMemo(() => {
    return groupedProducts[productPriceType].every((product) => selectedProducts.some(({ id }) => id === product.id))
  }, [groupedProducts, productPriceType, selectedProducts])

  if (groupedProducts[productPriceType].length === 0) {
    return null
  }

  return (
    <CommandGroup className={className}>
      <CommandItem
        className="flex flex-row items-center justify-between py-2 text-black dark:text-white"
        key={productPriceType}
        value={productPriceType}
        onSelect={() => onSelectProductType(productPriceType)}
      >
        <div className="flew-row flex items-center gap-2 font-medium">
          <ProductPriceTypeLabel productPriceType={productPriceType} />
        </div>

        <div className="text-xs opacity-70">
          {!areAllSelected ? <>Elegir los {groupedProducts[productPriceType].length}</> : <>Quitar todos</>}
        </div>
      </CommandItem>
      {groupedProducts[productPriceType].map((product) => {
        const isSelected = selectedProducts.some(({ id }) => id === product.id)

        return (
          <CommandItem
            className="flex flex-row items-center justify-between text-black dark:text-white"
            key={product.id}
            value={product.id}
            onSelect={() => onSelectProduct(product)}
          >
            {`${product.nombre} ${!product.activo ? '(Archivado)' : ''}`}
            <CheckIcon className={twMerge('h-4 w-4', isSelected ? 'visible' : 'invisible')} />
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}

interface ProductSelectProps {
  products: ProductoMako[]
  value: string[]
  onChange: (value: string[]) => void
  emptyLabel?: string
  className?: string
}

const plano = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const ProductSelect: React.FC<ProductSelectProps> = ({ products, value, onChange, emptyLabel, className }) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedProducts = useMemo(() => products.filter((p) => value.includes(p.id)), [products, value])

  // Products displayed in the selector
  const displayedProducts = useMemo(() => {
    const q = plano(query.trim())
    return [...products].filter((p) => !q || plano(p.nombre).includes(q)).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [products, query])

  // Group displayed products by product price type (un plan de MaKo se cobra por mes: es una suscripción)
  const groupedProducts = useMemo<Record<ProductPriceType, ProductoMako[]>>(() => {
    return displayedProducts.reduce<Record<ProductPriceType, ProductoMako[]>>(
      (acc, product) => {
        acc.recurring.push(product)
        return acc
      },
      { one_time: [], recurring: [] },
    )
  }, [displayedProducts])

  const buttonLabel = useMemo(() => {
    if (value.length === 0) {
      return emptyLabel || 'Todos los planes'
    }
    if (value.length === 1) {
      return selectedProducts[0]?.nombre
    }
    return `${value.length} planes`
  }, [value, emptyLabel, selectedProducts])

  const onSelectProduct = useCallback(
    (product: ProductoMako) => {
      if (value.includes(product.id)) {
        onChange(value.filter((v) => v !== product.id))
      } else {
        onChange([...value, product.id])
      }
    },
    [onChange, value],
  )

  const onSelectProductType = useCallback(
    (productPriceType: ProductPriceType) => {
      const productValues = groupedProducts[productPriceType].map((product) => product.id)
      const selectedValues = new Set(value)
      const allSelected = productValues.every((v) => selectedValues.has(v))
      if (allSelected) {
        onChange(value.filter((v) => !productValues.includes(v)))
      } else {
        onChange([...value, ...productValues.filter((v) => !selectedValues.has(v))])
      }
    },
    [groupedProducts, onChange, value],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="lg"
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className={twMerge(
            'ring-offset-background placeholder:text-muted-foreground focus:ring-ring dark:bg-polar-800 font-medium dark:hover:bg-polar-700 dark:border-polar-700 dark:hover:border-polar-700 flex h-10 w-full! flex-row items-center justify-between gap-x-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-sans shadow-xs transition-colors hover:border-gray-300 hover:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1',
            className,
          )}
          wrapperClassNames="justify-between w-full min-w-0 sm:min-w-[200px]"
        >
          <div className="overflow-hidden text-ellipsis whitespace-nowrap">{buttonLabel}</div>
          <ExpandMoreOutlined className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="bottom" align="start">
        <Command shouldFilter={false}>
          <CommandInput className="border-none focus:ring-transparent" placeholder="Buscar planes…" value={query} onValueChange={setQuery} />
          <CommandList>
            {displayedProducts.length ? (
              <>
                <ProductsCommandGroup
                  groupedProducts={groupedProducts}
                  productPriceType="one_time"
                  onSelectProduct={onSelectProduct}
                  onSelectProductType={onSelectProductType}
                  selectedProducts={selectedProducts}
                />
                {groupedProducts.one_time.length > 0 && groupedProducts.recurring.length > 0 && <CommandSeparator />}
                <ProductsCommandGroup
                  groupedProducts={groupedProducts}
                  productPriceType="recurring"
                  onSelectProduct={onSelectProduct}
                  onSelectProductType={onSelectProductType}
                  selectedProducts={selectedProducts}
                />
              </>
            ) : (
              <CommandEmpty>No hay planes con ese nombre</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default ProductSelect

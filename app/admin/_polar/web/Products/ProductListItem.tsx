'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Products/ProductListItem.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Una fila del Catalogue: un plan de MaKo (app/admin/_polar/datos/productos.ts → `ProductoMako`).
// ⚠️ LO QUE SE SACÓ: la casilla de la selección en lote, el «Private» (un plan de MaKo no tiene visibilidad aparte de
//    activo/archivado), las pastillas de precio por uso, por asiento y por unidad (un plan cobra un precio fijo por mes), y
//    del menú «Integrate Checkout», «Edit Product», «Duplicate Product» y «Archive Product» (no hay acción de MaKo para eso:
//    los planes viven en el setting `planes.mako`). Quedan «Share» (arma un link de cobro de ese plan: Checkout Links) y
//    «Copy Product ID».

import ProductPriceLabel from '@/app/admin/_polar/web/Products/ProductPriceLabel'
import { MoreVertOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button } from '@/app/admin/_polar/orbit'
import { ListItem } from '@/app/admin/_polar/orbit'
import { Status } from '@/app/admin/_polar/orbit'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/admin/_polar/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/admin/_polar/orbit'
import Link, { useRouter } from '@/app/_ui/Link'
import type { ProductoMako } from '@/app/admin/_polar/datos/productos'

interface ProductListItemProps {
  product: ProductoMako
}

export const ProductListItem = ({ product }: ProductListItemProps) => {
  const router = useRouter()

  const handleContextMenuCallback = (callback: (e: React.MouseEvent) => void) => {
    return (e: React.MouseEvent) => {
      e.stopPropagation()
      callback(e)
    }
  }

  return (
    <Link href={`/admin/products/${product.id}`}>
      <ListItem className="flex flex-row items-center justify-between gap-x-6 pr-3">
        <div className="flex min-w-0 grow flex-row items-center gap-x-4 text-sm">
          <div className="flex min-w-0 flex-row items-center gap-x-2">
            <span className="truncate">{product.nombre}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-center gap-x-4 md:gap-x-6">
          {!product.activo ? (
            <Tooltip>
              <TooltipTrigger>
                <Status color="gray" status="Archivado" />
              </TooltipTrigger>
              <TooltipContent align="center" side="left">
                Un plan archivado no se ofrece más: quien ya lo paga lo sigue pagando
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <span className="text-sm leading-snug">
                <ProductPriceLabel product={product} />
              </span>
              <Button
                size="sm"
                variant="secondary"
                className="hidden md:inline-flex"
                onClick={(e) => {
                  e.preventDefault()
                  router.push(`/admin/products/checkout-links?productId=${product.id}`)
                }}
              >
                Compartir
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger className="focus:outline-none" asChild>
                  <Button
                    className={'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'}
                    size="icon"
                    variant="secondary"
                    aria-label={`Más opciones de ${product.nombre}`}
                    onClick={(e) => e.preventDefault()}
                  >
                    <MoreVertOutlined fontSize="inherit" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="dark:bg-polar-800 bg-gray-50 shadow-lg">
                  <DropdownMenuItem
                    onClick={handleContextMenuCallback(() => {
                      if (typeof navigator !== 'undefined') {
                        void navigator.clipboard.writeText(product.id).catch(() => {})
                      }
                    })}
                  >
                    Copiar el ID del plan
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </ListItem>
    </Link>
  )
}

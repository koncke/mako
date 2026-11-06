'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Products/ProductListItem.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Una fila del Catalogue: un plan de MaKo (app/admin/_polar/datos/productos.ts → `ProductoMako`).
// ⚠️ LO QUE SE SACÓ: la casilla de la selección en lote, el «Private» (un plan de MaKo no tiene visibilidad aparte de
//    activo/archivado), las pastillas de precio por uso, por asiento y por unidad (un plan cobra un precio fijo por mes), y
//    del menú «Integrate Checkout», «Edit Product», «Duplicate Product» y «Archive Product» (no hay acción de MaKo para eso:
//    los planes viven en el setting `planes.mako`). Quedan «Vender» y «Copy Product ID».
// ⚠️ «VENDER», NO «SHARE» (punto 21 de docs/admin/revision-cerebro-6-11.md): en MaKo un link es de UNA persona y se paga una
//    vez, así que «compartir» saltaba al primer link del plan, que podía estar pagado o ser de otro comprador, y el formulario
//    no se abría. Abre el formulario NUEVO con el plan puesto (`rutaParaVender`, productos.ts). Va también en el menú, porque el
//    botón se esconde en una pantalla chica (como en Polar) y el menú está siempre.
// ⚠️ «COPIAR EL ID» DICE SI SE COPIÓ (punto 24): la fila del menú pasa a «Copiado» o «No pude copiar» y el menú queda abierto
//    para que se lea (`useCopiar`, atoms/CopyToClipboardInput.tsx).

import ProductPriceLabel from '@/app/admin/_polar/web/Products/ProductPriceLabel'
import { MoreVertOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button } from '@/app/admin/_polar/orbit'
import { ListItem } from '@/app/admin/_polar/orbit'
import { Status } from '@/app/admin/_polar/orbit'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/admin/_polar/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/app/admin/_polar/orbit'
import Link, { useRouter } from '@/app/_ui/Link'
import { rutaParaVender, type ProductoMako } from '@/app/admin/_polar/datos/productos'
import { rotuloDeCopia, useCopiar } from '@/app/admin/_polar/atoms/CopyToClipboardInput'

interface ProductListItemProps {
  product: ProductoMako
}

export const ProductListItem = ({ product }: ProductListItemProps) => {
  const router = useRouter()
  const [copia, copiar] = useCopiar()

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
                  router.push(rutaParaVender(product.id))
                }}
              >
                Vender
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
                      router.push(rutaParaVender(product.id))
                    })}
                  >
                    Vender
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    // El menú queda abierto: si se cerrara con el clic, la señal no se vería.
                    onSelect={(e) => e.preventDefault()}
                    className={copia === 'fallo' ? 'text-red-500 dark:text-red-400' : undefined}
                    onClick={handleContextMenuCallback(() => {
                      void copiar(product.id)
                    })}
                  >
                    {rotuloDeCopia(copia, 'Copiar el ID del plan')}
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

'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Products/ProductPage/ProductPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// La ficha de un plan de MaKo: el título con su estado y su precio, el menú, y el «Overview» de Polar.
// ⚠️ LO QUE SE SACÓ:
//    · La pestaña «Metrics» y los gráficos del Overview (MRR, suscripciones activas, ingresos acumulados, los de hoy):
//      el gráfico de ingresos vive SÓLO en Overview y en Analytics › Metrics (Martín, 6/11/2026), y MaKo tampoco sabe de qué
//      plan es cada pago (un pago no guarda el plan). Sin la segunda pestaña, el Subnav de una sola se va también.
//    · «Edit Product», «Duplicate», «Archive / Unarchive», «Delete Permanently» e «Integrate Checkout»: no hay acción de MaKo
//      para eso (los planes viven en el setting `planes.mako`). Quedan «Vender» (abre el formulario nuevo de Checkout Links con
//      este plan: `rutaParaVender`, productos.ts) y «Copy Product ID», que dice si se copió (`useCopiar`). Puntos 21 y 24 de
//      docs/admin/revision-cerebro-6-11.md.
//    · Debajo del precio va SÓLO el enlace a Settings › Payments, donde viven los precios en Mercado Pago: el precio en
//      dólares sale de `planes.mako` y desde acá no se edita.
//    · El aviso de versiones del producto (ProductVersionBanner): un plan de MaKo no tiene versiones.

import ProductPriceLabel from '@/app/admin/_polar/web/Products/ProductPriceLabel'
import { MoreVert } from '@/app/admin/_polar/orbit/icons'
import { Button } from '@/app/admin/_polar/orbit'
import { Status } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/admin/_polar/ui/dropdown-menu'
import Link, { useRouter } from '@/app/_ui/Link'
import { rotuloDeCopia, useCopiar } from '@/app/admin/_polar/atoms/CopyToClipboardInput'
import { DashboardBody } from '../../Layout/DashboardLayout'
import { ProductOverview } from './ProductOverview'
import { rutaParaVender, type ProductoMako } from '@/app/admin/_polar/datos/productos'

/** Settings › Payments: los precios de los planes en Mercado Pago. */
const RUTA_PRECIOS = '/admin/settings/payments'

export interface ProductPageProps {
  product: ProductoMako
}

export const ProductPage = ({ product }: ProductPageProps) => {
  const router = useRouter()
  const [copia, copiar] = useCopiar()
  return (
    <DashboardBody
      title={
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex min-w-0 flex-row items-center gap-4">
            <h1 className="truncate text-2xl">{product.nombre}</h1>
            <div className="flex shrink-0 flex-row items-center gap-4">{!product.activo && <Status status="Archivado" color="gray" />}</div>
          </div>
          <span className="dark:text-polar-500 text-xl text-gray-400 [&_*]:!text-current">
            <ProductPriceLabel product={product} verbose />
          </span>
          <Link href={RUTA_PRECIOS} className="dark:text-polar-500 w-fit text-sm text-gray-500 underline hover:no-underline">
            Precios en Mercado Pago: Settings › Payments
          </Link>
        </div>
      }
      header={
        <div className="flex flex-row items-center justify-between gap-2">
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="aspect-square h-10 w-10" variant="secondary" aria-label="Más opciones">
                  <MoreVert fontSize="small" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {product.activo && <DropdownMenuItem onClick={() => router.push(rutaParaVender(product.id))}>Vender</DropdownMenuItem>}
                <DropdownMenuItem
                  // El menú queda abierto: si se cerrara con el clic, la señal no se vería.
                  onSelect={(e) => e.preventDefault()}
                  className={copia === 'fallo' ? 'text-red-500 dark:text-red-400' : undefined}
                  onClick={() => void copiar(product.id)}
                >
                  {rotuloDeCopia(copia, 'Copiar el ID del plan')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      }
    >
      <Box flexDirection="column" rowGap="2xl">
        <ProductOverview product={product} />
      </Box>
    </DashboardBody>
  )
}

'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/CheckoutLinks/CheckoutLinkListSidebar.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// La barra de Checkout Links: los links de «Vender un plan» (app/admin/_polar/datos/productos.ts → `LinkDeVenta`), con el
// orden por etiqueta, el filtro por plan y el «+» que abre el formulario. Lo que Polar pide a su API (`useCheckoutLinks`,
// paginado infinito) llega armado del server: es la misma lista de hasta 200 cobros que leía la pantalla de Cobros.
//
// ⚠️ EL FILTRO POR PLAN FILTRA POR CAPA (productos.ts, `filtrarLinksPorProducto`): un link guarda la capa, no el plan.
// ⚠️ LO QUE MaKo SUMA (no está en Polar): el estado del cobro en la segunda línea («Pagado», «Sin pagar»…), porque un link
//    de MaKo se paga una vez y deja de servir; el botón de copiar sólo mientras se puede pagar; y el aviso del tope de 200.
// ⚠️ LO QUE SE SACÓ: el scroll infinito (la lista llega entera) y los toasts de «copiado» (Admin no tiene Toaster: el ícono
//    del botón cambia al copiar).

import { CheckoutLinkManagementModal } from '@/app/admin/_polar/web/CheckoutLinks/CheckoutLinkManagementModal'
import { InlineModal } from '@/app/admin/_polar/orbit'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import ProductSelect from '@/app/admin/_polar/web/Products/ProductSelect'
import { AddOutlined, ArrowDownward, ArrowUpward, CheckOutlined, LinkOutlined } from '@/app/admin/_polar/orbit/icons'
import { Alert, Button } from '@/app/admin/_polar/orbit'
import Link, { useRouter } from '@/app/_ui/Link'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ESTADO_LINK, filtrarLinksPorProducto, leerOrdenLinks, leerProductIds, ordenarLinks, type DatosCheckoutLinks } from '@/app/admin/_polar/datos/productos'

const BASE = '/admin/products/checkout-links'

export const CheckoutLinkListSidebar = ({ datos }: { datos: DatosCheckoutLinks | { error: string } }) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const productIds = useMemo(() => leerProductIds(searchParams.get('productId')), [searchParams])
  const sorting = leerOrdenLinks(searchParams.get('sorting'))
  const createCheckoutLinkQuerystring = searchParams.get('create_checkout_link') === 'true'

  const conQuery = useCallback(
    (ruta: string, cambios: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(cambios)) {
        if (v) params.set(k, v)
        else params.delete(k)
      }
      const queryString = params.toString()
      return `${ruta}${queryString ? `?${queryString}` : ''}`
    },
    [searchParams],
  )

  const setSorting = (v: 'label' | '-label') => router.replace(conQuery(pathname, { sorting: v === 'label' ? null : v }), { scroll: false })

  const ok = 'links' in datos ? datos : null
  const checkoutLinks = useMemo(
    () => (ok ? ordenarLinks(filtrarLinksPorProducto(ok.links, productIds, ok.productos), sorting) : []),
    [ok, productIds, sorting],
  )

  const { isShown: isCreateCheckoutLinkModalShown, show: showCreateCheckoutLinkModal, hide: hideCreateCheckoutLinkModal } = useModal()

  useEffect(() => {
    if (createCheckoutLinkQuerystring) {
      showCreateCheckoutLinkModal()
      router.replace(conQuery(pathname, { create_checkout_link: null }), { scroll: false })
    }
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [createCheckoutLinkQuerystring])

  const selectedCheckoutLinkId = useMemo(() => {
    const parts = pathname.split('/')
    const checkoutLinksIndex = parts.indexOf('checkout-links')
    if (checkoutLinksIndex !== -1 && parts[checkoutLinksIndex + 1]) {
      return parts[checkoutLinksIndex + 1]
    }
    return null
  }, [pathname])

  const handleProductIdsChange = useCallback(
    (ids: string[]) => {
      router.push(conQuery(BASE, { productId: ids.length > 0 ? ids.join(',') : null }))
    },
    [router, conQuery],
  )

  const handleCreateCheckoutLinkClose = useCallback(
    (cobroId: number) => {
      hideCreateCheckoutLinkModal()
      router.push(conQuery(`${BASE}/${cobroId}`, { productId: null }))
      // La lista la arma el server: que se vuelva a leer con el link nuevo.
      router.refresh()
    },
    [hideCreateCheckoutLinkModal, router, conQuery],
  )

  const [copiado, setCopiado] = useState<number | null>(null)

  return (
    <>
      <div className="dark:divide-polar-800 flex h-full flex-col divide-y divide-gray-200">
        <div className="flex flex-row items-center justify-between gap-6 px-4 py-4">
          <div>Checkout Links</div>
          <div className="flex flex-row items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label={sorting === 'label' ? 'Ordenar de la Z a la A' : 'Ordenar de la A a la Z'}
              onClick={() => setSorting(sorting === 'label' ? '-label' : 'label')}
            >
              {sorting === 'label' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />}
            </Button>
            <Button size="icon" className="h-6 w-6" aria-label="Vender un plan" disabled={!ok} onClick={showCreateCheckoutLinkModal}>
              <AddOutlined fontSize="small" />
            </Button>
          </div>
        </div>
        {ok && (
          <div className="flex flex-row items-center gap-3 px-2 py-2">
            <ProductSelect products={ok.productos} value={productIds} onChange={handleProductIdsChange} />
          </div>
        )}
        <div className="dark:divide-polar-800 flex h-full grow flex-col divide-y divide-gray-50 overflow-y-auto">
          {!ok ? (
            <div className="flex flex-col items-start gap-2 p-4">
              <Alert variant="danger" title="No pude leer los links" description={'error' in datos ? datos.error : undefined} />
              <ReportarASoporte error={'error' in datos ? datos.error : 'No pude leer los links.'} />
            </div>
          ) : (
            <>
              {ok.avisos.length > 0 && (
                <div className="p-4">
                  <Alert variant="warning" title="No pude leer todo" description={`Faltan ${ok.avisos.join('; ')}.`} />
                </div>
              )}
              {checkoutLinks.map((checkoutLink) => {
                const productLabel = `${checkoutLink.producto} · ${ESTADO_LINK[checkoutLink.estado].rotulo}`
                const checkoutLinkHref = conQuery(`${BASE}/${checkoutLink.id}`, {})

                return (
                  <Link
                    key={checkoutLink.id}
                    href={checkoutLinkHref}
                    className={twMerge(
                      'dark:hover:bg-polar-800 cursor-pointer hover:bg-gray-100',
                      selectedCheckoutLinkId === String(checkoutLink.id) && 'dark:bg-polar-800 bg-gray-100',
                    )}
                  >
                    <div className="flex flex-row items-center gap-3 px-4 py-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="w-full truncate text-sm">{checkoutLink.etiqueta}</div>
                        <div>
                          <div className="dark:text-polar-500 w-full truncate text-sm text-gray-500">{productLabel}</div>
                        </div>
                      </div>
                      {checkoutLink.url && (
                        <Button
                          size="icon"
                          variant="secondary"
                          aria-label={`Copiar el link de ${checkoutLink.etiqueta}`}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()

                            if (typeof navigator !== 'undefined' && checkoutLink.url) {
                              void navigator.clipboard.writeText(checkoutLink.url).then(
                                () => setCopiado(checkoutLink.id),
                                () => {},
                              )
                            }
                          }}
                        >
                          {copiado === checkoutLink.id ? <CheckOutlined fontSize="small" /> : <LinkOutlined fontSize="small" />}
                        </Button>
                      )}
                    </div>
                  </Link>
                )
              })}
              {checkoutLinks.length === 0 && (
                <div className="dark:text-polar-500 px-4 py-6 text-sm text-gray-500">
                  {productIds.length > 0 ? 'No hay links de ese plan.' : 'Todavía no armaste ningún link.'}
                </div>
              )}
              {ok.truncado && (
                <div className="dark:text-polar-500 px-4 py-4 text-xs text-gray-500">Se ven los 200 cobros más nuevos: los de antes no entran en la lista.</div>
              )}
            </>
          )}
        </div>
      </div>
      {ok && (
        <InlineModal
          isShown={isCreateCheckoutLinkModalShown}
          hide={hideCreateCheckoutLinkModal}
          modalContent={
            <CheckoutLinkManagementModal
              productos={ok.productos}
              pasarelas={ok.pasarelas}
              monedaMp={ok.monedaMp}
              productIds={productIds}
              onClose={handleCreateCheckoutLinkClose}
              hide={hideCreateCheckoutLinkModal}
            />
          }
        />
      )}
    </>
  )
}

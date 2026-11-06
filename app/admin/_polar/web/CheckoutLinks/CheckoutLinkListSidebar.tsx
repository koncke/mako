'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/CheckoutLinks/CheckoutLinkListSidebar.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
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
// ⚠️ «COPIADO» SÓLO SI SE COPIÓ (punto 24 de docs/admin/revision-cerebro-6-11.md): el tilde sale en el `.then` de
//    `copiarTexto` (atoms/CopyToClipboardInput.tsx); si el portapapeles dice que no, la fila lo dice en rojo («No pude copiar»)
//    en vez de callarse. Antes el error se tragaba y se podía pegar otra cosa creyendo que era el link.
// ⚠️ EL ORDEN Y LA LIMPIEZA DE `create_checkout_link` NO VAN AL SERVER (punto 32): la lista ya está en el navegador, así que se
//    cambia la URL con `cambiarQuery` (history.replaceState), como Customers. Con `router.replace` cada clic en el orden volvía a
//    leer los 200 cobros y la pantalla parecía no responder. El filtro por plan sí va al server: decide a qué link salta el índice.

import { CheckoutLinkManagementModal } from '@/app/admin/_polar/web/CheckoutLinks/CheckoutLinkManagementModal'
import { InlineModal } from '@/app/admin/_polar/orbit'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import ProductSelect from '@/app/admin/_polar/web/Products/ProductSelect'
import { AddOutlined, ArrowDownward, ArrowUpward, CheckOutlined, ErrorOutlined, LinkOutlined } from '@/app/admin/_polar/orbit/icons'
import { Alert, Button } from '@/app/admin/_polar/orbit'
import Link, { useRouter } from '@/app/_ui/Link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { ESTADO_LINK, filtrarLinksPorProducto, leerOrdenLinks, leerProductIds, ordenarLinks, TITULO_SIN_LINKS, type DatosCheckoutLinks } from '@/app/admin/_polar/datos/productos'
import { cambiarQuery } from '@/app/admin/_polar/web/Customer/useClientSidePagination'
import { copiarTexto, MS_SENAL_COPIA, ROTULO_COPIA } from '@/app/admin/_polar/atoms/CopyToClipboardInput'

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

  const setSorting = (v: 'label' | '-label') => cambiarQuery({ sorting: v === 'label' ? null : v })

  const ok = 'links' in datos ? datos : null
  const checkoutLinks = useMemo(
    () => (ok ? ordenarLinks(filtrarLinksPorProducto(ok.links, productIds, ok.productos), sorting) : []),
    [ok, productIds, sorting],
  )

  const { isShown: isCreateCheckoutLinkModalShown, show: showCreateCheckoutLinkModal, hide: hideCreateCheckoutLinkModal } = useModal()

  useEffect(() => {
    if (createCheckoutLinkQuerystring) {
      showCreateCheckoutLinkModal()
      cambiarQuery({ create_checkout_link: null })
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

  // La señal de copiar de UNA fila: cuál y qué pasó. Vuelve a nada a los MS_SENAL_COPIA.
  const [copia, setCopia] = useState<{ id: number; estado: 'copiado' | 'fallo' } | null>(null)
  const timerCopia = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timerCopia.current) clearTimeout(timerCopia.current)
  }, [])
  const copiarLink = (id: number, url: string) => {
    void copiarTexto(url).then((estado) => {
      setCopia({ id, estado })
      if (timerCopia.current) clearTimeout(timerCopia.current)
      timerCopia.current = setTimeout(() => setCopia(null), MS_SENAL_COPIA)
    })
  }

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
            <div className="p-4">
              <Alert variant="danger" title={TITULO_SIN_LINKS} description={'error' in datos ? datos.error : undefined} />
            </div>
          ) : (
            <>
              {ok.avisos.length > 0 && (
                <div className="p-4">
                  <Alert variant="warning" soporte title="No pude leer todo" description={`Faltan ${ok.avisos.join('; ')}.`} />
                </div>
              )}
              {checkoutLinks.map((checkoutLink) => {
                const productLabel = `${checkoutLink.producto} · ${ESTADO_LINK[checkoutLink.estado].rotulo}`
                const senal = copia?.id === checkoutLink.id ? copia.estado : null
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
                          {senal === 'fallo' ? (
                            <div aria-live="polite" className="w-full truncate text-sm text-red-500 dark:text-red-400">{ROTULO_COPIA.fallo}</div>
                          ) : (
                            <div className="dark:text-polar-500 w-full truncate text-sm text-gray-500">{productLabel}</div>
                          )}
                        </div>
                      </div>
                      {checkoutLink.url && (
                        <Button
                          size="icon"
                          variant="secondary"
                          aria-label={senal ? `${ROTULO_COPIA[senal]}: el link de ${checkoutLink.etiqueta}` : `Copiar el link de ${checkoutLink.etiqueta}`}
                          onClick={(event) => {
                            event.preventDefault()
                            event.stopPropagation()
                            if (checkoutLink.url) copiarLink(checkoutLink.id, checkoutLink.url)
                          }}
                        >
                          {senal === 'copiado' ? (
                            <CheckOutlined fontSize="small" />
                          ) : senal === 'fallo' ? (
                            <ErrorOutlined fontSize="small" />
                          ) : (
                            <LinkOutlined fontSize="small" />
                          )}
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

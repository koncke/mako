'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Layout/DashboardLayout.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.

import { Modal } from '@/app/admin/_polar/orbit'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { ViewSidebarOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button } from '@/app/admin/_polar/orbit'
import { SidebarProvider, SidebarTrigger } from '@/app/admin/_polar/atoms/Sidebar'
import { ID_PORTAL_PL } from '@/app/admin/_polar/portal'
import { m } from 'motion/react'
import { usePathname } from 'next/navigation'
import { PropsWithChildren, useEffect, useRef, type JSX } from 'react'
import { twMerge } from 'tailwind-merge'
import { useRoute } from '../Navigation/useRoute'
import { DashboardSidebar } from './Dashboard/DashboardSidebar'

/**
 * El layout de Polar (DashboardLayout) adentro de MaKo: la raíz `.pl` del tema, el `SidebarProvider open` del layout de
 * Polar (`(header)/layout.tsx`), su barra a la izquierda del contenido y el contenedor de los portales.
 * ⚠️ Sin el `setLastVisitedOrg` ni el contexto de la organización: Admin es una sola, la plataforma.
 */
const DashboardLayout = (
  props: PropsWithChildren<{
    className?: string
    search?: (o: { open: boolean; onOpenChange: (v: boolean) => void }) => React.ReactNode
  }>,
) => {
  return (
    // ⚠️ EL ALTO: en la columna del layout raíz de MaKo, `flex-1` ANULA el `height` (su base 0% manda) y el contenedor crece
    // con su contenido: scrolleaba el DOCUMENTO entero y la lista de Customers se iba con él (medido el 6/11/2026: 2.540 px en una
    // ventana de 900). Desde md va `flex: none` con el alto de la ventana (menos la barra de inspección) y `overflow: hidden`, y
    // scrollea cada panel por adentro, como en Polar; en una pantalla angosta scrollea el documento, como dice Polar abajo.
    <div className="pl min-w-0 flex-1 md:h-[calc(100dvh-var(--barra-agencia,0px))] md:flex-none md:overflow-hidden">
      <SidebarProvider open className="h-full! min-h-0!">
        <div className="relative flex h-full w-full flex-col bg-white md:flex-row md:bg-gray-100 md:p-2 dark:bg-transparent">
          <MobileNav />
          {/* MaKo: en Polar la barra es `fixed` a la ventana y no ocupa el `md:p-2` del layout; acá vive adentro, así que se
              come ese margen con uno negativo y queda donde la dibuja Polar. */}
          <div className="hidden md:-my-2 md:-ml-2 md:flex">
            <DashboardSidebar search={props.search} />
          </div>
          <div className={twMerge('relative flex h-full min-w-0 flex-1 flex-col', props.className)}>
            {/* On large devices, scroll here. On small devices the _document_ is the only element that should scroll. */}
            <main className="relative flex min-h-0 min-w-0 grow flex-col">{props.children}</main>
          </div>
        </div>
      </SidebarProvider>
      <div id={ID_PORTAL_PL} />
    </div>
  )
}

export default DashboardLayout

/**
 * La barra de arriba que Polar dibuja en una pantalla angosta, SIN el logotipo ni la cuenta (Martín: «sin logo… sin
 * cuenta»): queda el botón que abre la barra de secciones, que en una pantalla angosta es la única forma de llegar a ellas.
 */
const MobileNav = () => {
  return (
    <div className="dark:bg-polar-900 relative z-20 flex w-full flex-col items-center justify-between bg-gray-50 md:hidden">
      <div className="dark:bg-polar-900 sticky top-0 right-0 left-0 flex w-full flex-row items-center justify-end bg-gray-50 p-4">
        <SidebarTrigger />
      </div>
    </div>
  )
}

export interface DashboardBodyProps {
  children?: React.ReactNode
  className?: string
  wrapperClassName?: string
  title?: JSX.Element | string | null
  contextView?: React.ReactNode
  contextViewClassName?: string
  contextViewPlacement?: 'left' | 'right'
  contextViewTitle?: string
  header?: JSX.Element
  titleActions?: React.ReactNode
  wide?: boolean
  detailView?: React.ReactNode
}

export const DashboardBody = ({
  children,
  className,
  wrapperClassName,
  title,
  contextView,
  contextViewClassName,
  contextViewPlacement = 'right',
  contextViewTitle = 'Detalle',
  header,
  titleActions,
  wide = false,
  detailView,
}: DashboardBodyProps) => {
  const { currentRoute, currentSubRoute } = useRoute()

  const current = currentSubRoute ?? currentRoute

  const parsedTitle = title ?? current?.title

  const pathname = usePathname()
  const {
    isShown: isContextShown,
    show: showContext,
    hide: hideContext,
  } = useModal()
  const lastPathnameRef = useRef(pathname)

  useEffect(() => {
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname
      hideContext()
    }
  }, [pathname, hideContext])

  return (
    <m.div
      className={twMerge(
        'flex h-full w-full flex-row gap-x-2',
        contextViewPlacement === 'left' ? 'flex-row-reverse' : '',
      )}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {contextViewPlacement === 'left' && detailView}
      <div className="dark:bg-polar-900 dark:border-polar-800 relative flex min-w-0 flex-2 flex-col items-center rounded-2xl border-gray-200 bg-white px-4 md:overflow-y-auto md:border md:px-8 md:shadow-xs">
        <div
          className={twMerge(
            'flex h-full w-full flex-col gap-8 pt-8',
            wrapperClassName,
            wide ? '' : 'max-w-(--breakpoint-xl)',
          )}
        >
          {(title !== null || !!header || contextView) && (
            <div className="flex flex-col gap-y-4 md:flex-row md:items-center md:justify-between md:gap-x-4">
              {(title !== null || contextView || titleActions) && (
                <div className="flex items-center gap-x-2 md:contents">
                  {title !== null &&
                    (!title || typeof parsedTitle === 'string' ? (
                      <h4 className="text-2xl font-medium whitespace-nowrap dark:text-white">
                        {title ?? current?.title}
                      </h4>
                    ) : (
                      parsedTitle
                    ))}
                  {titleActions && (
                    <div className="ml-auto flex items-center gap-x-2 md:hidden">
                      {titleActions}
                    </div>
                  )}
                  {contextView && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className={twMerge(
                        'h-8 w-8 md:hidden',
                        titleActions ? '' : 'ml-auto',
                      )}
                      onClick={showContext}
                      aria-label={`Open ${contextViewTitle}`}
                    >
                      <ViewSidebarOutlined fontSize="small" />
                    </Button>
                  )}
                </div>
              )}

              {header}
            </div>
          )}

          <m.div
            className={twMerge('flex w-full flex-col pb-8', className)}
            variants={{
              initial: { opacity: 0 },
              animate: { opacity: 1, transition: { duration: 0.3 } },
              exit: { opacity: 0, transition: { duration: 0.3 } },
            }}
          >
            {children}
          </m.div>
        </div>
      </div>
      {contextView ? (
        <m.div
          variants={{
            initial: { opacity: 0 },
            animate: { opacity: 1, transition: { duration: 0.3 } },
            exit: { opacity: 0, transition: { duration: 0.3 } },
          }}
          className={twMerge(
            'dark:bg-polar-900 dark:border-polar-800 hidden w-full flex-1 overflow-y-auto rounded-2xl border border-gray-200 bg-white md:block md:max-w-[320px] md:shadow-xs xl:max-w-[440px]',
            contextViewClassName,
          )}
        >
          {contextView}
        </m.div>
      ) : null}
      {contextViewPlacement === 'right' && detailView}
      {contextView && (
        <Modal
          title={contextViewTitle}
          isShown={isContextShown}
          hide={hideContext}
          modalContent={<div>{contextView}</div>}
        />
      )}
    </m.div>
  )
}

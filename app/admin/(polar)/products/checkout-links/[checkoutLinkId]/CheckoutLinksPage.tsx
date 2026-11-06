'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/products/checkout-links/[checkoutLinkId]/CheckoutLinksPage.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// La cabecera de un link (su etiqueta y el menú) y su cuerpo. «Delete Checkout Link» de Polar es acá «Anular el link»
// (`anularCobroMakoAction`, app/admin/cobros/actions.ts): sólo mientras no se pagó; un link pagado no tiene menú.
// ⚠️ LO QUE MaKo SUMA: el estado del cobro al lado de la etiqueta (como el «Archived» de un producto en Polar).
// ⚠️ Sin el toast de Polar al anular (Admin no tiene Toaster): si falla, el error se dice en la cabecera.

import { CheckoutLinkPage } from '@/app/admin/_polar/web/CheckoutLinks/CheckoutLinkPage'
import { MasterDetailLayoutContent } from '@/app/admin/_polar/web/Layout/MasterDetailLayout'
import { ConfirmModal } from '@/app/admin/_polar/web/Modal/ConfirmModal'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { anularCobroMakoAction } from '@/app/admin/cobros/actions'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { MoreVertOutlined } from '@/app/admin/_polar/orbit/icons'
import { Button, Status, Text, Truncated } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/admin/_polar/ui/dropdown-menu'
import { useRouter } from '@/app/_ui/Link'
import React, { useState } from 'react'
import type { Pasarela } from '@/lib/cobros-tipos'
import { ESTADO_LINK, sePuedeAnular, type LinkDeVenta, type ProductoMako } from '@/app/admin/_polar/datos/productos'

interface ClientPageProps {
  checkoutLink: LinkDeVenta
  productos: ProductoMako[]
  pasarelas: Pasarela[]
  monedaMp: string | null
}

const ClientPage: React.FC<ClientPageProps> = ({ checkoutLink, productos, pasarelas, monedaMp }) => {
  const router = useRouter()
  const [isDeletePending, setIsDeletePending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { isShown: isDeleteModalShown, show: showDeleteModal, hide: hideDeleteModal } = useModal()

  const onDelete = async () => {
    setIsDeletePending(true)
    setError(null)
    const r = await anularCobroMakoAction(checkoutLink.id).catch((e: unknown) => ({ ok: false, error: e instanceof Error ? e.message : 'No pude anular el link.' }))
    setIsDeletePending(false)
    if (!r.ok) {
      setError(r.error ?? 'No pude anular el link.')
      return
    }
    router.refresh()
  }

  const estado = ESTADO_LINK[checkoutLink.estado]

  return (
    <MasterDetailLayoutContent
      header={
        <Box width="100%" flexDirection="column" gap="m">
          <Box width="100%" alignItems="center" justifyContent="between" gap="l">
            <Box alignItems="center" gap="m" minWidth={0}>
              <Truncated>
                <Text variant="heading-xs" as="p">
                  {checkoutLink.etiqueta}
                </Text>
              </Truncated>
              <Status status={estado.rotulo} color={estado.color} />
            </Box>

            {sePuedeAnular(checkoutLink) && (
              <Box flexShrink={0} alignItems="center" gap="s">
                <DropdownMenu>
                  <DropdownMenuTrigger className="focus:outline-none" asChild>
                    <Button size="icon" variant="secondary" loading={isDeletePending} aria-label="Más opciones">
                      <MoreVertOutlined fontSize="inherit" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="dark:bg-polar-800 bg-gray-50 shadow-lg">
                    <DropdownMenuItem destructive onClick={showDeleteModal}>
                      Anular el link
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Box>
            )}
          </Box>
          {error && (
            <div role="alert" className="flex flex-col items-start gap-2">
              <Text color="error">{error}</Text>
              <ReportarASoporte error={error} />
            </div>
          )}
        </Box>
      }
    >
      <div className="flex h-full w-full flex-col">
        <div className="flex w-full flex-col gap-8 pb-8">
          <CheckoutLinkPage checkoutLink={checkoutLink} productos={productos} pasarelas={pasarelas} monedaMp={monedaMp} />
        </div>
      </div>
      <ConfirmModal
        title="Anular el link"
        description="Quien lo abra ya no va a poder pagar con él."
        onConfirm={onDelete}
        isShown={isDeleteModalShown}
        hide={hideDeleteModal}
        confirmPrompt={checkoutLink.etiqueta}
        destructiveText="Anular"
        destructive
      />
    </MasterDetailLayoutContent>
  )
}

export default ClientPage

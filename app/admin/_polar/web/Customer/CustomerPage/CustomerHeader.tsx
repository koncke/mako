'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/CustomerHeader.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el mismo menú de la cabecera, con lo que el super admin hace con un negocio:
//   · «Copy Customer Portal» de Polar (el link al portal del cliente) → «Entrar a su cuenta» (/inicio?ws=<n>, la entrada de
//     siempre a un negocio; un <a> sin JavaScript, como en la grilla vieja);
//   · «Contact Customer» (mailto) → el email de quien administra su cuenta;
//   · «Edit Customer» → EditCustomerModal (nombre, plan, plan a mano);
//   · «Pausar cuenta» / «Reactivar cuenta» (`estado` de /api/admin/workspaces): Polar no pausa un cliente; es la acción de la
//     grilla vieja y va donde Polar pone las acciones del cliente;
//   · «Delete Customer» → «Eliminar negocio» (`eliminar`), con el ConfirmModal de Polar que pide escribir el nombre (la ruta lo
//     pide igual).
// Se sacó «Add Credits»: MaKo no tiene créditos por cliente. ⚠️ Lo que falla se dice debajo del menú (Admin no tiene el toast).
// «Administrar», en el clic derecho de la lista (../menu-contextual-negocios.ts), llega con `?editar=1`: abre «Editar negocio» y
// saca el parámetro de la URL (un F5 no lo vuelve a abrir).
// ⚠️ ELIMINADO, SIN MENÚ (punto 20 de la revisión del 6/11/2026): la ficha borrada queda a la vista con lo que se llevó y sólo
//    «Ir a Customers» (`NegocioEliminado`), que hace `push` Y `refresh` (`irALaLista`): sin el refresh, la lista de la izquierda
//    y ⌘K seguían mostrando el negocio, con un 404 al tocarlo.

import { EditCustomerModal } from '@/app/admin/_polar/web/Customer/EditCustomerModal'
import { ConfirmModal } from '@/app/admin/_polar/web/Modal/ConfirmModal'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { cambioDeEstadoNegocio, resumenDeBorrado, type NegocioCabecera } from '@/app/admin/_polar/datos/cliente'
import { MoreVert } from '@/app/admin/_polar/orbit/icons'
import { Alert, Button, InlineModal } from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/admin/_polar/ui/dropdown-menu'
import { useRouter } from '@/app/_ui/Link'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cambiarQuery } from '@/app/admin/_polar/web/Customer/useClientSidePagination'
import { PARAM_EDITAR } from '../menu-contextual-negocios'
import { accionDelNegocio, irALaLista } from './acciones'

interface CustomerHeaderProps {
  negocio: NegocioCabecera
}

/** La cabecera de un negocio que se acaba de eliminar: lo que se llevó y la salida a la lista. Sin menú: ya no hay negocio. */
export const NegocioEliminado = ({ resumen, onIr }: { resumen: string; onIr: () => void }) => (
  <Box flexDirection="column" alignItems="end" rowGap="s">
    <Alert variant="success" title="Negocio eliminado" description={resumen} actions={[{ text: 'Ir a Customers', onClick: onIr }]} />
  </Box>
)

export const CustomerHeader = ({ negocio }: CustomerHeaderProps) => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [eliminado, setEliminado] = useState<string | null>(null)
  const {
    show: showEditCustomerModal,
    hide: hideEditCustomerModal,
    isShown: isEditCustomerModalOpen,
  } = useModal()
  const {
    show: showDeleteCustomerModal,
    hide: hideDeleteCustomerModal,
    isShown: isDeleteCustomerModalShown,
  } = useModal()
  const {
    show: showPauseModal,
    hide: hidePauseModal,
    isShown: isPauseModalShown,
  } = useModal()

  const searchParams = useSearchParams()
  // Una sola vez por ficha: cerrar el modal no lo vuelve a abrir aunque la URL tarde en enterarse.
  const editarAbierto = useRef(false)
  useEffect(() => {
    if (editarAbierto.current || searchParams.get(PARAM_EDITAR) !== '1') return
    editarAbierto.current = true
    showEditCustomerModal()
    cambiarQuery({ [PARAM_EDITAR]: null })
  }, [searchParams, showEditCustomerModal])

  const pausado = negocio.estado === 'pausado'

  const onPausar = useCallback(async () => {
    setError(null)
    const r = await accionDelNegocio(cambioDeEstadoNegocio(negocio))
    if (!r.ok) setError(r.error)
    router.refresh()
  }, [negocio, router])

  const onDeleteCustomer = useCallback(async () => {
    setError(null)
    const r = await accionDelNegocio({ action: 'eliminar', id: negocio.ws, nombre: negocio.nombre })
    if (!r.ok) {
      setError(r.error)
      return
    }
    // ⚠️ Se dice LO QUE SE LLEVÓ (la grilla vieja lo hacía): un «listo» sobre lo más destructivo de la app no deja comprobar
    //    nada. Sin refrescar: esta ficha ya no existe, y la salida es el botón a la lista.
    setEliminado(resumenDeBorrado(negocio.nombre, r.datos))
  }, [negocio])

  if (eliminado) return <NegocioEliminado resumen={eliminado} onIr={() => irALaLista(router)} />

  return (
    <Box flexDirection="column" alignItems="end" rowGap="s">
      <Box columnGap="s">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="default" className="size-10" variant="secondary" aria-label="Acciones del negocio">
              <MoreVert fontSize="small" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <a href={`/inicio?ws=${negocio.ws}`}>Entrar a su cuenta</a>
            </DropdownMenuItem>
            {negocio.contacto && (
              <DropdownMenuItem asChild>
                <a href={`mailto:${negocio.contacto}`}>Contactar</a>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={showEditCustomerModal}>
              Editar negocio
            </DropdownMenuItem>
            <DropdownMenuItem onClick={showPauseModal}>
              {pausado ? 'Reactivar cuenta' : 'Pausar cuenta'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={showDeleteCustomerModal}>
              Eliminar negocio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <InlineModal
          isShown={isEditCustomerModalOpen}
          hide={hideEditCustomerModal}
          modalContent={
            <EditCustomerModal
              negocio={negocio}
              onClose={hideEditCustomerModal}
            />
          }
        />
        <ConfirmModal
          isShown={isPauseModalShown}
          hide={hidePauseModal}
          title={pausado ? `¿Reactivar «${negocio.nombre}»?` : `¿Pausar «${negocio.nombre}»?`}
          description={
            pausado
              ? 'La cuenta vuelve a quedar activa.'
              : 'La cuenta queda pausada. Se puede reactivar desde este mismo menú.'
          }
          confirmText={pausado ? 'Reactivar la cuenta' : 'Pausar la cuenta'}
          onConfirm={onPausar}
        />
        <ConfirmModal
          isShown={isDeleteCustomerModalShown}
          hide={hideDeleteCustomerModal}
          title={`¿Eliminar el negocio «${negocio.nombre}»?`}
          body={
            <div className="text-sm leading-relaxed">
              <Box flexDirection="column" rowGap="s" color="text-secondary">
                <p>No se puede deshacer, y en el momento:</p>
                <ol className="list-inside list-disc pl-4">
                  <li>Se borran sus datos, sus archivos y sus personas</li>
                  <li>Se cortan su línea de WhatsApp y su voz</li>
                  <li>Los leads de tu CRM que eran esta cuenta quedan sin cuenta</li>
                </ol>
              </Box>
            </div>
          }
          onConfirm={onDeleteCustomer}
          confirmPrompt={negocio.nombre}
          destructiveText="Eliminar"
          destructive
        />
      </Box>
      {error && <Alert variant="danger" title="No se pudo" description={error} onDismiss={() => setError(null)} />}
    </Box>
  )
}

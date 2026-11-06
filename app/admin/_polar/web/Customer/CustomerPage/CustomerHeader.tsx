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
import { useCallback, useState } from 'react'
import { accionDelNegocio } from './acciones'

interface CustomerHeaderProps {
  negocio: NegocioCabecera
}

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
      {eliminado && (
        <Alert
          variant="success"
          title="Negocio eliminado"
          description={eliminado}
          actions={[{ text: 'Ir a Customers', onClick: () => router.push('/admin/customers') }]}
        />
      )}
    </Box>
  )
}

'use client'

// Una fila de Admin › Products › Templates (18/11/2026): la fila del Catalogue de Polar
// (app/admin/_polar/web/Products/ProductListItem.tsx, copiado de polarsource/polar, Apache-2.0; aviso: lib/avisos/LICENSE-POLAR
// y lib/avisos/NOTICE-POLAR) con una plantilla que un negocio compartió: su nombre y su tipo a la izquierda; a la derecha cuánto
// gustó, el negocio que la publicó, su estado («Retirada» como el «Archivado» de un plan, «De MaKo» si la publicó la plataforma)
// y el «⋮» con «Retirar de la galería» (con su confirmación: es el «Cortar la suscripción» de SubscriptionActionsMenu) y
// «Copiar el ID». Sin link a un detalle: una plantilla no tiene página propia en Admin.

import { useState } from 'react'
import { useRouter } from '@/app/_ui/Link'
import { MoreVertOutlined } from '@/app/admin/_polar/orbit/icons'
import { Alert, Button, ListItem, Status } from '@/app/admin/_polar/orbit'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/app/admin/_polar/ui/dropdown-menu'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { ConfirmModal } from '@/app/admin/_polar/web/Modal/ConfirmModal'
import { rotuloDeCopia, useCopiar } from '@/app/admin/_polar/atoms/CopyToClipboardInput'
import { cuantoGusto, type PlantillaModerada } from '@/app/admin/_polar/datos/plantillas'
import { retirarPlantillaAction } from '@/app/admin/plantillas/actions'

export const PlantillaListItem = ({ plantilla }: { plantilla: PlantillaModerada }) => {
  const router = useRouter()
  const retirar = useModal()
  const [copia, copiar] = useCopiar()
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)

  return (
    <>
      <ListItem className="flex flex-row items-center justify-between gap-x-6 pr-3">
        <div className="flex min-w-0 grow flex-row items-center gap-x-4 text-sm">
          <div className="flex min-w-0 flex-col">
            <span className="truncate">{plantilla.titulo}</span>
            <span className="dark:text-polar-500 truncate text-xs text-gray-500">{plantilla.tipoTexto} · {plantilla.autor}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-center gap-x-4 md:gap-x-6">
          <span className="hidden text-sm leading-snug md:inline">{cuantoGusto(plantilla)}</span>
          <span className="dark:text-polar-500 hidden max-w-48 truncate text-sm text-gray-500 md:inline">{plantilla.negocio.nombre}</span>
          {plantilla.deMako && <Status color="blue" status="De MaKo" />}
          {plantilla.estado === 'retirada' && <Status color="gray" status="Retirada" />}
          <DropdownMenu>
            <DropdownMenuTrigger className="focus:outline-none" asChild>
              <Button
                className={'border-none bg-transparent text-[16px] opacity-50 transition-opacity hover:opacity-100 dark:bg-transparent'}
                size="icon"
                variant="secondary"
                aria-label={`Más opciones de ${plantilla.titulo}`}
              >
                <MoreVertOutlined fontSize="inherit" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dark:bg-polar-800 bg-gray-50 shadow-lg">
              {plantilla.estado === 'publicada' && <DropdownMenuItem onClick={retirar.show}>Retirar de la galería</DropdownMenuItem>}
              <DropdownMenuItem
                // El menú queda abierto: si se cerrara con el clic, la señal no se vería.
                onSelect={(e) => e.preventDefault()}
                className={copia === 'fallo' ? 'text-red-500 dark:text-red-400' : undefined}
                onClick={() => { void copiar(String(plantilla.id)) }}
              >
                {rotuloDeCopia(copia, 'Copiar el ID de la plantilla')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ListItem>
      {(error || hecho) && (
        <div className="fixed right-6 bottom-6 z-50 max-w-sm">
          {error && <Alert variant="danger" title={error} />}
          {hecho && <Alert variant="success" title={hecho} />}
        </div>
      )}
      {plantilla.estado === 'publicada' && (
        <ConfirmModal
          isShown={retirar.isShown}
          hide={retirar.hide}
          title="¿Retirar de la galería?"
          description={`«${plantilla.titulo}», de ${plantilla.negocio.nombre}, deja de verse en la galería y en «Nuevo …» de los demás negocios. Los que ya la usaron conservan su copia.`}
          destructive
          destructiveText="Retirar de la galería"
          onConfirm={async () => {
            setError(null)
            const r = await retirarPlantillaAction(plantilla.id).catch(() => ({ ok: false, resumen: 'No pude retirar la plantilla.' }))
            if (!r.ok) return setError(r.resumen)
            setHecho(r.resumen)
            router.refresh()
          }}
        />
      )}
    </>
  )
}

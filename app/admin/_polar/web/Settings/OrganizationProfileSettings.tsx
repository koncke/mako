'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Settings/OrganizationProfileSettings.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Settings › General: QUIÉN EMITE cada recibo de MaKo (lib/recibos-reglas.ts → `Emisor`), con el formulario de perfil de
// Polar: los campos en su grilla y el guardado solo, un segundo después de dejar de escribir (`useAutoSave` de Polar, acá
// con su misma demora). Guarda con `guardarEmisorAction` (app/admin/cobros/recibos-actions.ts) SÓLO lo que se tocó: el server
// lo mezcla sobre lo guardado, y así no pisa el asunto que se escribió en Customer Notifications (punto 15 de la revisión del
// 6/11/2026). Al salir antes del segundo, lo escrito se guarda igual (`guardadoDiferido`, punto 16: antes se descartaba).
// Nunca se inventa un dato fiscal: lo que se deja vacío no se imprime.
//
// ⚠️ LO QUE SE SACÓ: el grupo «Identifiers» (el id y el slug de la organización: MaKo no tiene uno que copiar), el logo, el
//    país, la web y las redes sociales (el emisor no los tiene), y el toast al fallar (Admin no tiene Toaster: el error se
//    dice debajo del formulario, con el `Alert` de Orbit: punto 42). «Organization Name» es el nombre que sale en el recibo; «Website» y «Support Email», el
//    documento, la dirección y el correo de contacto.
// ⚠️ LO QUE NO ESTÁ EN LA FUENTE: el «Ver ejemplo» del PDF del recibo (/api/admin/recibos/ejemplo) que tenía la pantalla de
//    antes. Polar no muestra una vista previa; va en el mismo grupo, como un renglón más de Polar (`SettingsGroupItem`, con su
//    botón a la derecha), por decisión del Cerebro (6/11/2026). Abre el PDF con los datos de hoy, sin número.

import { guardarEmisorAction } from '@/app/admin/cobros/recibos-actions'
import { Alert, Button, Input } from '@/app/admin/_polar/orbit'
import { Form, FormField, FormMessage } from '@/app/admin/_polar/ui/form'
import React, { useEffect, useId, useRef, useState } from 'react'
import { useForm, useFormContext, useWatch } from 'react-hook-form'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { SettingsGroup, SettingsGroupItem } from './SettingsGroup'
import {
  RUTA_EJEMPLO_RECIBO,
  cambiosDelEmisor,
  guardadoDiferido,
  problemaDelPerfil,
  type CambiosEmisor,
  type Emisor,
} from '@/app/admin/_polar/datos/ajustes'

type PerfilForm = { nombre: string; documento: string; direccion: string; correo: string }

const valoresDe = (e: Emisor): PerfilForm => ({ nombre: e.nombre, documento: e.documento ?? '', direccion: e.direccion ?? '', correo: e.correo ?? '' })

const OrganizationDetailsForm: React.FC = () => {
  const { control } = useFormContext<PerfilForm>()
  const fieldId = useId()

  return (
    <div className="space-y-8">
      <div className="space-y-6">
        <div>
          <label htmlFor={`${fieldId}-name`} className="mb-2 block text-sm font-medium">
            Nombre *
          </label>
          <FormField
            control={control}
            name="nombre"
            render={({ field }) => (
              <div>
                <Input id={`${fieldId}-name`} {...field} maxLength={120} placeholder="Estudio Norte" />
                <FormMessage />
              </div>
            )}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor={`${fieldId}-documento`} className="mb-2 block text-sm font-medium">
              Documento
            </label>
            <FormField
              control={control}
              name="documento"
              render={({ field }) => (
                <div>
                  <Input id={`${fieldId}-documento`} {...field} maxLength={80} placeholder="Sin documento" />
                  <p className="dark:text-polar-400 mt-1 text-xs text-gray-600">Vacío, no se imprime.</p>
                  <FormMessage />
                </div>
              )}
            />
          </div>

          <div>
            <label htmlFor={`${fieldId}-correo`} className="mb-2 block text-sm font-medium">
              Correo de contacto
            </label>
            <FormField
              control={control}
              name="correo"
              render={({ field }) => (
                <div>
                  <Input id={`${fieldId}-correo`} type="email" {...field} maxLength={120} placeholder="hola@ejemplo.com" />
                  <FormMessage />
                </div>
              )}
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${fieldId}-direccion`} className="mb-2 block text-sm font-medium">
            Dirección
          </label>
          <FormField
            control={control}
            name="direccion"
            render={({ field }) => (
              <div>
                <Input id={`${fieldId}-direccion`} {...field} maxLength={200} placeholder="Sin dirección" />
                <FormMessage />
              </div>
            )}
          />
        </div>
      </div>
    </div>
  )
}

interface OrganizationProfileSettingsProps {
  emisor: Emisor
}

const OrganizationProfileSettings: React.FC<OrganizationProfileSettingsProps> = ({ emisor }) => {
  const form = useForm<PerfilForm>({ defaultValues: valoresDe(emisor) })
  const { control, setError, clearErrors } = form
  const valores = useWatch({ control })
  // Lo último que el server dijo que quedó guardado, y lo que hay escrito ahora: los dos en refs, porque el guardado que corre
  // al salir los lee después de que el componente se fue.
  const guardado = useRef<Emisor>(emisor)
  const escrito = useRef<PerfilForm>(valoresDe(emisor))
  const [error, setErrorGeneral] = useState<string | null>(null)

  // El `useAutoSave` de Polar: un segundo después del último cambio. Lo que no se puede guardar (un nombre vacío, un correo que
  // no es un correo) se dice en su campo y no viaja; lo demás, sí.
  const [guardador] = useState(() =>
    guardadoDiferido<CambiosEmisor>({
      demoraMs: 1000,
      pendiente: () => {
        const v = escrito.current
        const cambios = cambiosDelEmisor(guardado.current, v)
        const problema = problemaDelPerfil(v)
        if (problema) {
          setError(problema.campo, { message: problema.mensaje })
          delete cambios[problema.campo]
        } else {
          clearErrors()
        }
        return Object.keys(cambios).length ? cambios : null
      },
      enviar: async (cambios) => {
        const r = await guardarEmisorAction(cambios).catch(() => ({ ok: false as const, error: 'No pude guardar los datos del recibo.' }))
        if (!r.ok) {
          setErrorGeneral(r.error)
          return
        }
        setErrorGeneral(null)
        guardado.current = r.emisor
        // La acción ya revalidó Settings (como el `router.refresh()` de Polar): no hace falta pedirlo acá.
      },
    }),
  )

  useEffect(() => {
    escrito.current = { nombre: valores.nombre ?? '', documento: valores.documento ?? '', direccion: valores.direccion ?? '', correo: valores.correo ?? '' }
    guardador.cambio()
  }, [valores, guardador])

  // Al salir con algo pendiente, se guarda en vez de descartarse (punto 16). Su única dependencia es el guardador, que no cambia
  // (sale de `useState`): corre una vez, al desmontar. Nunca un `clearTimeout` a secas, que tiraba lo escrito.
  useEffect(() => () => void guardador.salir(), [guardador])

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Box flexDirection="column" rowGap="2xl">
          <SettingsGroup title="Profile" description="Quién emite: sale en cada recibo y en su correo.">
            <Box flexDirection="column" padding="xl">
              <OrganizationDetailsForm />
            </Box>
            <SettingsGroupItem title="Ver ejemplo" description="Cómo sale un recibo con estos datos." layout="inline">
              {/* El Button de Orbit envuelve su texto (no acepta `asChild`): abre el PDF en otra pestaña. */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(RUTA_EJEMPLO_RECIBO, '_blank', 'noopener,noreferrer')}
              >
                Ver ejemplo
              </Button>
            </SettingsGroupItem>
          </SettingsGroup>
          {error && <Alert variant="danger" title="No se guardó" description={error} onDismiss={() => setErrorGeneral(null)} />}
        </Box>
      </form>
    </Form>
  )
}

export default OrganizationProfileSettings

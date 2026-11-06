'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Settings/OrganizationProfileSettings.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Settings › General: QUIÉN EMITE cada recibo de MaKo (lib/recibos-reglas.ts → `Emisor`), con el formulario de perfil de
// Polar: los campos en su grilla y el guardado solo, un segundo después de dejar de escribir (`useAutoSave` de Polar, acá
// con su misma demora). Guarda con `guardarEmisorAction` (app/admin/cobros/recibos-actions.ts), siempre el emisor ENTERO.
// Nunca se inventa un dato fiscal: lo que se deja vacío no se imprime.
//
// ⚠️ LO QUE SE SACÓ: el grupo «Identifiers» (el id y el slug de la organización: MaKo no tiene uno que copiar), el logo, el
//    país, la web y las redes sociales (el emisor no los tiene), y el toast al fallar (Admin no tiene Toaster: el error se
//    dice debajo del formulario). «Organization Name» es el nombre que sale en el recibo; «Website» y «Support Email», el
//    documento, la dirección y el correo de contacto.
// ⚠️ LO QUE NO ESTÁ EN LA FUENTE: el «Ver ejemplo» del PDF del recibo (/api/admin/recibos/ejemplo) que tenía la pantalla de
//    antes. Polar no muestra una vista previa: queda anotado y lo decide Martín.

import { guardarEmisorAction } from '@/app/admin/cobros/recibos-actions'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { Input, Text } from '@/app/admin/_polar/orbit'
import { Form, FormField, FormMessage } from '@/app/admin/_polar/ui/form'
import { useRouter } from '@/app/_ui/Link'
import React, { useEffect, useId, useRef, useState } from 'react'
import { useForm, useFormContext, useWatch } from 'react-hook-form'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import { SettingsGroup } from './SettingsGroup'
import { emisorConCambios, mismoEmisor, problemaDelPerfil, type Emisor } from '@/app/admin/_polar/datos/ajustes'

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
  const router = useRouter()
  const form = useForm<PerfilForm>({ defaultValues: valoresDe(emisor) })
  const { control, setError, clearErrors } = form
  const valores = useWatch({ control })
  const guardado = useRef<Emisor>(emisor)
  const [error, setErrorGeneral] = useState<string | null>(null)

  // El `useAutoSave` de Polar: un segundo después del último cambio, si hay algo distinto y se puede guardar.
  useEffect(() => {
    const v: PerfilForm = { nombre: valores.nombre ?? '', documento: valores.documento ?? '', direccion: valores.direccion ?? '', correo: valores.correo ?? '' }
    const siguiente = emisorConCambios(guardado.current, v)
    if (mismoEmisor(siguiente, guardado.current) && v.nombre.trim()) return
    const t = setTimeout(async () => {
      const problema = problemaDelPerfil(v)
      if (problema) {
        setError(problema.campo, { message: problema.mensaje })
        return
      }
      clearErrors()
      const r = await guardarEmisorAction(siguiente).catch(() => ({ ok: false as const, error: 'No pude guardar los datos del recibo.' }))
      if (!r.ok) {
        setErrorGeneral(r.error)
        return
      }
      setErrorGeneral(null)
      guardado.current = r.emisor
      // Que el server vuelva a leer lo guardado (como Polar: `router.refresh()`).
      router.refresh()
    }, 1000)
    return () => clearTimeout(t)
  }, [valores, setError, clearErrors, router])

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        <Box flexDirection="column" rowGap="2xl">
          <SettingsGroup title="Perfil" description="Quién emite: sale en cada recibo y en su correo.">
            <Box flexDirection="column" padding="xl">
              <OrganizationDetailsForm />
            </Box>
          </SettingsGroup>
          {error && (
            <div role="alert" className="flex flex-col items-start gap-2">
              <Text color="error">{error}</Text>
              <ReportarASoporte error={error} />
            </div>
          )}
        </Box>
      </form>
    </Form>
  )
}

export default OrganizationProfileSettings

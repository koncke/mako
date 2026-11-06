'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/EditCustomerModal.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: lo que se edita de un negocio, con las acciones de siempre de /api/admin/workspaces: el nombre (`nombre`), el plan
// (`capa`, sólo los que se venden) y el plan a mano (`plan_a_mano`: los días que se pueden dar, o quitarlo). Se sacaron el
// Email, el External ID y la Metadata de Polar: un negocio de MaKo no tiene email propio (el de sus personas está en Members),
// ni id externo, ni metadata. Sin `useHasPermission`: Admin es sólo del super admin (la página y cada ruta lo preguntan).
// ⚠️ Lo que el server dice que falló se muestra tal cual (Admin no tiene el toast de Polar): ahí está el motivo.

import {
  cambiosDelNegocio,
  opcionesDePlanAMano,
  PLANES_ASIGNABLES,
  SIN_CAMBIO,
  type NegocioCabecera,
} from '@/app/admin/_polar/datos/cliente'
import {
  Alert,
  Button,
  InlineModalHeader,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/admin/_polar/orbit'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/admin/_polar/ui/form'
import { useRouter } from '@/app/_ui/Link'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { accionDelNegocio, enOrden } from './CustomerPage/acciones'

type CustomerUpdateForm = { nombre: string; capa: string; planAMano: string }

export const EditCustomerModal = ({
  negocio,
  onClose,
}: {
  negocio: NegocioCabecera
  onClose: () => void
}) => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const form = useForm<CustomerUpdateForm>({
    defaultValues: {
      nombre: negocio.nombre,
      capa: negocio.capa,
      planAMano: SIN_CAMBIO,
    },
  })

  const handleUpdateCustomer = async (valores: CustomerUpdateForm) => {
    const cambios = cambiosDelNegocio(negocio, valores)
    if (!cambios.length) {
      onClose()
      return
    }
    setError(null)
    setGuardando(true)
    const r = await enOrden(cambios, accionDelNegocio)
    setGuardando(false)
    if (!r.ok) {
      setError(r.error)
      router.refresh()
      return
    }
    router.refresh()
    onClose()
  }

  const planes = PLANES_ASIGNABLES.some((p) => p.capa === negocio.capa)
    ? PLANES_ASIGNABLES
    : [{ capa: negocio.capa, nombre: negocio.plan }, ...PLANES_ASIGNABLES]

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={onClose}>
        <h2 className="text-xl">Editar negocio</h2>
      </InlineModalHeader>
      <div className="flex flex-col gap-8 px-8 pb-12">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleUpdateCustomer)}
            className="flex flex-col gap-8"
          >
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="nombre"
                rules={{ validate: (v) => (v.trim() ? true : 'El nombre no puede quedar vacío') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="capa"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <FormDescription>
                      Cambiarlo le cambia las tabs que ve, y se le avisa por mail.
                    </FormDescription>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {planes.map((p) => (
                          <SelectItem key={p.capa} value={p.capa}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="planAMano"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan a mano</FormLabel>
                    <FormDescription>
                      {negocio.planAMano ?? 'No tiene un plan a mano.'}
                    </FormDescription>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {opcionesDePlanAMano(negocio.planAMano != null).map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {error && <Alert variant="danger" title="No se guardó" description={error} />}
            <Button
              type="submit"
              className="self-start"
              loading={guardando}
            >
              Guardar
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}

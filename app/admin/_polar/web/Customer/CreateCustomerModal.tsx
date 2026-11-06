'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CreateCustomerModal.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: crear un Customer es dar de alta un NEGOCIO, por el alta de siempre (POST /api/admin/workspaces, action 'crear',
// lib/alta-cliente.ts): el nombre del negocio, el email de su admin (por donde le llega el acceso), su nombre y el plan.
// ⚠️ ES EL ÚNICO FORMULARIO DE ALTA DE ADMIN (Martín, 6/11/2026: cada cosa en UN lugar). Lo abren el «+» de la lista de
//    Customers (vacío) y el «Dar de alta» del aviso «Quieren entrar» de Overview (con lo del pedido, `inicial`). Lo que se
//    precarga y lo que se manda lo deciden `inicialDeAlta` y `cuerpoDeAlta` (app/admin/_polar/datos/alta.ts, con test).
// Donde Polar pide External ID y Metadata (MaKo no los guarda), MaKo pide el nombre del admin y el plan. Sin el chequeo de
// permiso (entra sólo el super admin) y sin el toast: lo que contesta el alta se dice ACÁ, porque si el mail de acceso no
// salió hay que pasarle el link a mano (`avisoInvitacion`, lib/invitacion-aviso.ts) y un toast se lo lleva.

import { InlineModalHeader } from '@/app/admin/_polar/orbit'
import { Alert, Button } from '@/app/admin/_polar/orbit'
import { Input } from '@/app/admin/_polar/orbit'
import {
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
import {
  cuerpoDeAlta,
  inicialDeAlta,
  type FormAlta,
  type OpcionesAlta,
  type PedidoParaAlta,
} from '@/app/admin/_polar/datos/alta'
import {
  avisoInvitacion,
  type AvisoInvitacion,
  type ResultadoInvitacion,
} from '@/lib/invitacion-aviso'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

type RespuestaAlta = {
  ok: boolean
  error?: string
  invitacion?: ResultadoInvitacion | null
}

export const CreateCustomerModal = ({
  onClose,
  onCreated,
  opciones,
  pedido,
}: {
  onClose: () => void
  /** Se llama al crear (la lista se vuelve a leer). */
  onCreated: () => void
  /** Los planes que se pueden dar y el que viene elegido. */
  opciones: OpcionesAlta
  /** Quien pidió entrar (el aviso «Quieren entrar»): su nombre y su email vienen puestos. */
  pedido?: PedidoParaAlta | null
}) => {
  const form = useForm<FormAlta>({
    defaultValues: inicialDeAlta(opciones, pedido),
  })
  const [enviando, setEnviando] = useState(false)
  const [errorAlta, setErrorAlta] = useState<string | null>(null)
  /** El negocio quedó creado y el mail no salió: el aviso queda a la vista y no se vuelve a mandar. */
  const [aviso, setAviso] = useState<AvisoInvitacion | null>(null)
  const planElegido = opciones.planes.find((p) => p.id === form.watch('plan'))

  const handleCreateCustomer = async (alta: FormAlta) => {
    setEnviando(true)
    setErrorAlta(null)
    setAviso(null)
    const cuerpo = cuerpoDeAlta(alta)
    try {
      const res = await fetch('/api/admin/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      })
      const j = (await res.json().catch(() => null)) as RespuestaAlta | null
      if (!j?.ok) {
        setErrorAlta(j?.error ?? `No se pudo crear el negocio (HTTP ${res.status}).`)
        return
      }
      onCreated()
      const a = avisoInvitacion(j.invitacion, cuerpo.adminEmail)
      if (a.tono === 'ok') {
        onClose()
        return
      }
      setAviso(a)
    } catch (e) {
      setErrorAlta(e instanceof Error ? e.message : String(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      <InlineModalHeader hide={onClose}>
        <h2 className="text-xl">Nuevo negocio</h2>
      </InlineModalHeader>
      <div className="flex flex-col gap-8 px-8 pb-12">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleCreateCustomer)}
            className="flex flex-col gap-8"
          >
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="nombre"
                rules={{
                  validate: (v) =>
                    v.trim().length >= 2 || 'Pon el nombre del negocio',
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="Por ejemplo, Estudio Norte" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                rules={{
                  required: 'Pon el email de su admin',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Email inválido',
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email del admin</FormLabel>
                    <FormDescription>Por aquí le llega el acceso.</FormDescription>
                    <FormControl>
                      <Input {...field} type="email" value={field.value || ''} placeholder="ana@ejemplo.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminNombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre del admin</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="Nombre y apellido" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {opciones.planes.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {planElegido && <FormDescription>{planElegido.descripcion}</FormDescription>}
                    {planElegido?.aviso && <FormDescription className="text-yellow-700 dark:text-yellow-500">{planElegido.aviso}</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {errorAlta ? (
              <Alert variant="danger" title="No se creó el negocio" description={errorAlta} />
            ) : null}
            {aviso ? (
              <Alert variant="warning" title="Negocio creado" description={aviso.texto} />
            ) : null}
            {aviso ? (
              <Button type="button" variant="secondary" className="self-start" onClick={onClose}>
                Cerrar
              </Button>
            ) : (
              <Button type="submit" className="self-start" loading={enviando}>
                Crear negocio
              </Button>
            )}
          </form>
        </Form>
      </div>
    </div>
  )
}

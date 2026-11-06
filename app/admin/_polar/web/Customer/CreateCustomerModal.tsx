'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CreateCustomerModal.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
// MaKo: crear un Customer es dar de alta un NEGOCIO, por el alta de siempre (POST /api/admin/workspaces, action 'crear',
// lib/alta-cliente.ts): el nombre del negocio y el email de su admin, que es por donde le llega el acceso. El tipo va en el
// default de MaKo (CAPA_DEFAULT, el alta lo pone sola). Sin External ID ni Metadata (MaKo no los guarda), sin el chequeo de
// permiso (acá entra sólo el super admin) y sin el toast: lo que contesta el alta se dice ACÁ, porque si el mail de acceso
// no salió hay que pasarle el link a mano (`avisoInvitacion`, lib/invitacion-aviso.ts) y un toast se lo lleva.

import { InlineModalHeader } from '@/app/admin/_polar/orbit'
import { Alert, Button } from '@/app/admin/_polar/orbit'
import { Input } from '@/app/admin/_polar/orbit'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/app/admin/_polar/ui/form'
import {
  avisoInvitacion,
  type AvisoInvitacion,
  type ResultadoInvitacion,
} from '@/lib/invitacion-aviso'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

type CustomerCreateForm = {
  name: string
  email: string
}

type RespuestaAlta = {
  ok: boolean
  error?: string
  invitacion?: ResultadoInvitacion | null
}

export const CreateCustomerModal = ({
  onClose,
  onCreated,
}: {
  onClose: () => void
  /** Se llama al crear (la lista se vuelve a leer). */
  onCreated: () => void
}) => {
  const form = useForm<CustomerCreateForm>({
    defaultValues: { name: '', email: '' },
  })
  const [enviando, setEnviando] = useState(false)
  const [errorAlta, setErrorAlta] = useState<string | null>(null)
  const [aviso, setAviso] = useState<AvisoInvitacion | null>(null)

  const handleCreateCustomer = async (customerCreate: CustomerCreateForm) => {
    setEnviando(true)
    setErrorAlta(null)
    setAviso(null)
    const email = customerCreate.email.trim()
    try {
      const res = await fetch('/api/admin/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'crear',
          nombre: customerCreate.name.trim(),
          adminEmail: email,
        }),
      })
      const j = (await res.json().catch(() => null)) as RespuestaAlta | null
      if (!j?.ok) {
        setErrorAlta(j?.error ?? `No se pudo crear el negocio (HTTP ${res.status}).`)
        return
      }
      onCreated()
      const a = avisoInvitacion(j.invitacion, email)
      if (a.tono === 'ok') {
        onClose()
        return
      }
      // El negocio quedó creado y el mail no salió: queda a la vista con el link para pasárselo a mano.
      setAviso(a)
      form.reset()
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
                name="name"
                rules={{
                  validate: (v) =>
                    v.trim().length >= 2 || 'Pon el nombre del negocio',
                }}
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
                    <FormControl>
                      <Input {...field} type="email" value={field.value || ''} />
                    </FormControl>
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
            <Button type="submit" className="self-start" loading={enviando}>
              Crear negocio
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}

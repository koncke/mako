'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/components/Customer/EditMemberModal.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// MaKo: el email no se cambia desde acá (es con el que entra con Google, y /api/admin/usuarios no lo edita: queda como el
// candado de Polar para el dueño); el nombre (`nombre`) y el rol en el negocio (`rolws`: Admin, Closer, Setter) sí. Se sacó
// «Assigned Seats» (MemberSeats): MaKo no vende lugares por persona. Sin `useHasPermission`: Admin es sólo del super admin.
// ⚠️ El motivo de un rechazo se muestra tal cual («Es el único admin de ese cliente — asigna otro admin antes.»).

import {
  cambiosDelMiembro,
  ROLES_MIEMBRO,
  ROTULO_ROL,
  type MiembroNegocio,
} from '@/app/admin/_polar/datos/cliente'
import type { RolWorkspace } from '@/lib/auth-session'
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
  Text,
} from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
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
import { accionDelMiembro, enOrden } from './CustomerPage/acciones'

type MemberUpdateForm = { nombre: string; email: string; rol: string }

export const EditMemberModal = ({
  member,
  onClose,
}: {
  member: MiembroNegocio
  onClose: () => void
}) => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const form = useForm<MemberUpdateForm>({
    defaultValues: {
      nombre: member.nombre ?? '',
      email: member.email,
      rol: member.rol ?? '',
    },
  })

  const handleUpdateMember = async (valores: MemberUpdateForm) => {
    const rol = (ROLES_MIEMBRO as readonly string[]).includes(valores.rol) ? (valores.rol as RolWorkspace) : null
    const cambios = cambiosDelMiembro(member, { nombre: valores.nombre, rol })
    if (!cambios.length) {
      onClose()
      return
    }
    setError(null)
    setGuardando(true)
    const r = await enOrden(cambios, accionDelMiembro)
    setGuardando(false)
    router.refresh()
    if (!r.ok) {
      setError(r.error)
      return
    }
    onClose()
  }

  return (
    <Box flexDirection="column" overflowY="auto">
      <InlineModalHeader hide={onClose}>
        <Text as="h2" variant="heading-xs">
          Editar persona
        </Text>
      </InlineModalHeader>
      <Box
        flexDirection="column"
        gap="2xl"
        paddingHorizontal="2xl"
        paddingBottom="3xl"
      >
        <Form {...form}>
          <Box
            as="form"
            onSubmit={form.handleSubmit(handleUpdateMember)}
            flexDirection="column"
            gap="2xl"
          >
            <Box flexDirection="column" gap="l">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormDescription>
                      Es con el que entra: no se cambia desde aquí.
                    </FormDescription>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        value={field.value || ''}
                        disabled
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nombre"
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
                name="rol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol en el negocio</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Elige un rol" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {ROLES_MIEMBRO.map((r) => (
                          <SelectItem key={r} value={r}>
                            {ROTULO_ROL[r][0]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </Box>
            {error && <Alert variant="danger" title="No se guardó" description={error} />}
            <Box justifyContent="end">
              <Button type="submit" loading={guardando}>
                Guardar
              </Button>
            </Box>
          </Box>
        </Form>
      </Box>
    </Box>
  )
}

'use client'

// Hecho para MaKo con las piezas de Polar (el formulario de EditMemberModal y el `InlineModal`): «Agregar persona» de Members.
// ⚠️ NO ESTÁ EN LA FUENTE COMO ESTÁ ACÁ: Polar invita a un miembro de un Customer `team` con su email; MaKo lo tenía en la grilla
//    vieja de Admin («＋ Sumar a alguien», app/admin/AdminView.tsx, `sumar`) y la copia de Polar lo había perdido (6/11/2026, el
//    revisor de la tanda). Manda el MISMO cuerpo que la grilla (`cuerpoDeAlta`, app/admin/_polar/datos/cliente.ts): en un
//    negocio, una persona de ese negocio con su rol; en Settings › Members, un admin de MaKo (el rol global sale de DÓNDE se suma).
// La consecuencia se dice antes de agregar (`consecuenciaDeAlta`): en la plataforma, que va a ver todos los negocios. Si el mail
// de acceso no salió, lo dice quien abrió el modal (`avisoInvitacion`, con el link para pasárselo a mano).

import {
  consecuenciaDeAlta,
  cuerpoDeAlta,
  ROLES_MIEMBRO,
  ROTULO_ROL,
  type DestinoDeAlta,
} from '@/app/admin/_polar/datos/cliente'
import type { RolWorkspace } from '@/lib/auth-session'
import { avisoInvitacion, type AvisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso'
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
import { accionDelMiembro } from './acciones'

type AltaForm = { nombre: string; email: string; rol: string }

export const AddMemberModal = ({
  destino,
  onClose,
  onListo,
}: {
  destino: DestinoDeAlta
  onClose: () => void
  /** Se agregó: lo que pasó con el mail de acceso, para decirlo arriba de la tabla. */
  onListo: (aviso: AvisoInvitacion) => void
}) => {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const form = useForm<AltaForm>({ defaultValues: { nombre: '', email: '', rol: 'admin' } })

  const agregar = async (v: AltaForm) => {
    const rol = (ROLES_MIEMBRO as readonly string[]).includes(v.rol) ? (v.rol as RolWorkspace) : null
    const cuerpo = cuerpoDeAlta(destino, { nombre: v.nombre, email: v.email, rol })
    if (!cuerpo) {
      form.setError('email', { message: 'Revisa el email.' })
      return
    }
    setError(null)
    setGuardando(true)
    const r = await accionDelMiembro(cuerpo)
    setGuardando(false)
    if (!r.ok) {
      setError(r.error)
      return
    }
    onListo(avisoInvitacion(r.datos.invitacion as ResultadoInvitacion | undefined, v.email.trim()))
    router.refresh()
    onClose()
  }

  return (
    <Box flexDirection="column" overflowY="auto">
      <InlineModalHeader hide={onClose}>
        <Text as="h2" variant="heading-xs">
          Agregar persona
        </Text>
      </InlineModalHeader>
      <Box flexDirection="column" gap="2xl" paddingHorizontal="2xl" paddingBottom="3xl">
        <Text color="muted">{consecuenciaDeAlta(destino)}</Text>
        <Form {...form}>
          <Box as="form" onSubmit={form.handleSubmit(agregar)} flexDirection="column" gap="2xl">
            <Box flexDirection="column" gap="l">
              <FormField
                control={form.control}
                name="nombre"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Nombre y apellido" maxLength={120} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                rules={{ validate: (v) => (v.trim() ? true : 'El email no puede quedar vacío') }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormDescription>Es con el que va a entrar, con Google.</FormDescription>
                    <FormControl>
                      <Input {...field} type="email" placeholder="persona@ejemplo.com" maxLength={160} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {destino !== 'plataforma' && (
                <FormField
                  control={form.control}
                  name="rol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol en el negocio</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
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
              )}
            </Box>
            {error && <Alert variant="danger" title="No se agregó" description={error} />}
            <Box justifyContent="end">
              <Button type="submit" loading={guardando}>
                Agregar
              </Button>
            </Box>
          </Box>
        </Form>
      </Box>
    </Box>
  )
}

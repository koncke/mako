'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/MembersSection.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ ES EL ÚNICO LUGAR DE ADMIN DONDE SE VEN Y SE GESTIONAN LAS PERSONAS (Martín, 6/11/2026: rechazó una versión con «usuarios
//    en tres lugares»). Las de un negocio son sus usuarios-cliente (`usuarios` con su `workspace_id`); las del equipo de MaKo
//    van en Settings › Members.
// MaKo: las columnas de Polar con lo que MaKo sabe de cada persona: su rol en el negocio (Admin, Closer, Setter), su estado
// (activo, invitado, suspendido, y si se le mandó el acceso), su segundo factor y su último ingreso. Se sacaron Seat (MaKo no
// vende lugares por persona) y External ID (no tiene). El menú de cada fila: «Editar persona» (nombre y rol), «Reenviar el
// acceso» (en el lugar de «Copy login link»: le manda el mail de entrada) y «Suspender» / «Reactivar», todo por
// /api/admin/usuarios, que no deja al negocio sin un admin. ⚠️ Lo que pasó se dice arriba de la tabla (Admin no tiene el toast).
// ⚠️ Siete columnas no entran con los 150 px fijos de Polar en el panel de ~745 px (6/11/2026: «Último ingreso» salía cortada
//    a la derecha y «Sin acceso enviado» se partía en tres renglones). Van en porcentajes (`DataTableColumnMeta`), lo que
//    acompaña al estado va DEBAJO de la insignia en una línea, y en una caja angosta se esconden de a poco las secundarias
//    (Alta, después el 2FA y el último ingreso, después el rol). La persona, su estado y su menú no se esconden nunca: el menú
//    es la única forma de editarla.

import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import {
  cambioDeEstado,
  ROTULO_ESTADO_MIEMBRO,
  ROTULO_ROL,
  type MiembroNegocio,
} from '@/app/admin/_polar/datos/cliente'
import { avisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso'
import { MoreVertOutlined } from '@/app/admin/_polar/orbit/icons'
import {
  Alert,
  Avatar,
  Button,
  DataTable,
  InlineModal,
  Status,
  Text,
} from '@/app/admin/_polar/orbit'
import { Box } from '@/app/admin/_polar/orbit/components/Box'
import FormattedDateTime from '@/app/admin/_polar/atoms/FormattedDateTime'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/admin/_polar/ui/dropdown-menu'
import { useRouter } from '@/app/_ui/Link'
import { useState } from 'react'
import { EditMemberModal } from '../EditMemberModal'
import { accionDelMiembro } from './acciones'

interface MembersSectionProps {
  miembros: MiembroNegocio[]
}

type Aviso = { tono: 'ok' | 'warn' | 'error'; texto: string }

export const MembersSection = ({ miembros }: MembersSectionProps) => {
  const router = useRouter()
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [selectedMember, setSelectedMember] = useState<MiembroNegocio | null>(null)
  const {
    show: showEditMemberModal,
    hide: hideEditMemberModal,
    isShown: isEditMemberModalShown,
  } = useModal()

  const reenviar = async (m: MiembroNegocio) => {
    setAviso(null)
    const r = await accionDelMiembro({ action: 'reinvitar', id: m.id })
    if (!r.ok) {
      setAviso({ tono: 'error', texto: r.error })
      return
    }
    const a = avisoInvitacion(r.datos.invitacion as ResultadoInvitacion | undefined, m.email)
    setAviso({ tono: a.tono, texto: a.texto })
    router.refresh()
  }

  const cambiarEstado = async (m: MiembroNegocio) => {
    setAviso(null)
    const r = await accionDelMiembro(cambioDeEstado(m))
    if (!r.ok) setAviso({ tono: 'error', texto: r.error })
    router.refresh()
  }

  return (
    <Box flexDirection="column" gap="l">
      <Text variant="heading-xxs" as="h3">
        Members
      </Text>
      {aviso && (
        <Alert
          variant={aviso.tono === 'ok' ? 'success' : aviso.tono === 'warn' ? 'warning' : 'danger'}
          title={aviso.tono === 'error' ? 'No se pudo' : aviso.tono === 'warn' ? 'Falta un paso' : 'Listo'}
          description={aviso.texto}
          onDismiss={() => setAviso(null)}
        />
      )}
      <DataTable
        data={miembros}
        columns={[
          {
            header: 'Persona',
            accessorKey: 'email',
            size: 260,
            meta: { width: '25%' },
            cell: ({ row: { original } }) => (
              <Box alignItems="center" gap="m" minWidth={0}>
                <Avatar
                  className="h-8 w-8"
                  name={original.nombre || original.email}
                  avatar_url={original.cara}
                />
                <Box flexDirection="column" minWidth={0}>
                  <Text truncate>{original.nombre || original.email}</Text>
                  {original.nombre && (
                    <Text color="muted" truncate>
                      {original.email}
                    </Text>
                  )}
                </Box>
              </Box>
            ),
          },
          {
            header: 'Rol',
            accessorKey: 'rol',
            meta: { width: '12%', className: 'hidden @md:table-cell' },
            cell: ({ row: { original } }) => {
              if (!original.rol) return <Text>—</Text>
              const [label, color] = ROTULO_ROL[original.rol]
              return <Status color={color} status={label} size="small" />
            },
          },
          {
            header: 'Estado',
            id: 'estado',
            meta: { width: '17%' },
            cell: ({ row: { original } }) => {
              const [label, color] = ROTULO_ESTADO_MIEMBRO[original.estado]
              return (
                <Box flexDirection="column" alignItems="start" rowGap="xs" minWidth={0}>
                  <Status color={color} status={label} size="small" />
                  {original.estado === 'invitado' && (
                    <Text variant="caption" color="muted" truncate style={{ maxWidth: '100%' }}>
                      {original.accesoEnviado ? 'Acceso enviado' : 'Sin acceso enviado'}
                    </Text>
                  )}
                </Box>
              )
            },
          },
          {
            header: '2FA',
            id: 'mfa',
            size: 80,
            meta: { width: '10%', className: 'hidden @lg:table-cell' },
            cell: ({ row: { original } }) =>
              original.mfa == null ? (
                <Text>—</Text>
              ) : (
                <Status
                  color={original.mfa ? 'green' : 'gray'}
                  status={original.mfa ? 'Activo' : 'No'}
                  size="small"
                />
              ),
          },
          {
            header: 'Último ingreso',
            accessorKey: 'ultimoIngreso',
            meta: { width: '17%', className: 'hidden @lg:table-cell whitespace-nowrap' },
            cell: ({ row: { original } }) =>
              original.ultimoIngreso ? (
                <FormattedDateTime datetime={original.ultimoIngreso} />
              ) : (
                <Text color="muted">Nunca</Text>
              ),
          },
          {
            header: 'Alta',
            accessorKey: 'creado',
            meta: { width: '11%', className: 'hidden @4xl:table-cell whitespace-nowrap' },
            cell: ({ row: { original } }) => (
              <FormattedDateTime datetime={original.creado} />
            ),
          },
          {
            id: 'actions',
            header: () => null,
            size: 60,
            meta: { width: '8%', className: 'px-1 @md:px-4' },
            cell: ({ row: { original } }) => (
              <Box justifyContent="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="h-8 w-8" variant="ghost" size="icon" aria-label={`Acciones de ${original.nombre || original.email}`}>
                      <MoreVertOutlined fontSize="inherit" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setSelectedMember(original)
                        showEditMemberModal()
                      }}
                    >
                      Editar persona
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => reenviar(original)}>
                      {original.accesoEnviado ? 'Reenviar el acceso' : 'Mandarle el acceso'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => cambiarEstado(original)}>
                      {original.estado === 'suspendido' ? 'Reactivar' : 'Suspender'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Box>
            ),
          },
        ]}
        isLoading={false}
        className="@container text-sm"
      />
      <InlineModal
        isShown={isEditMemberModalShown}
        hide={hideEditMemberModal}
        modalContent={
          selectedMember ? (
            <EditMemberModal
              member={selectedMember}
              onClose={hideEditMemberModal}
            />
          ) : null
        }
      />
    </Box>
  )
}

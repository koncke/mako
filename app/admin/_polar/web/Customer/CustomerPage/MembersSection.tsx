'use client'

// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/components/Customer/CustomerPage/MembersSection.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// ⚠️ CADA PERSONA SE VE Y SE GESTIONA EN UN SOLO LUGAR (Martín, 6/11/2026: rechazó una versión con «usuarios en tres
//    lugares»). Las de un negocio son sus usuarios-cliente (`usuarios` con su `workspace_id`) y viven en su ficha; las de la
//    plataforma (los admins de MaKo, su equipo y quien no tiene negocio) viven en Admin › Settings › Members, que monta ESTA
//    misma sección con `destino="plataforma"` (punto 25 de la revisión del 6/11/2026; hasta ese día este comentario la nombraba
//    y no existía). La regla de qué va dónde es UNA: app/admin/_polar/datos/personas.ts.
// MaKo: las columnas de Polar con lo que MaKo sabe de cada persona: su rol en el negocio (Admin, Closer, Setter) — en Settings,
// de qué lado de la plataforma está —, su estado (activo, invitado, suspendido, y si se le mandó el acceso), su segundo factor y
// su último ingreso. Se sacaron Seat (MaKo no vende lugares por persona) y External ID (no tiene). Arriba, «Agregar persona»
// (AddMemberModal). El menú de cada fila: «Editar persona» (nombre, rol y a qué negocio pertenece), «Reenviar el acceso» (en el
// lugar de «Copy login link»: le manda el mail de entrada), «Suspender» / «Reactivar» y «Eliminar», todo por
// /api/admin/usuarios, que no deja al negocio sin un admin. ⚠️ Lo que pasó se dice arriba de la tabla (Admin no tiene el toast).
// ⚠️ «SUSPENDER» Y «ELIMINAR» PIDEN CONFIRMACIÓN (punto 22): los dos apagan los tokens de API que la persona creó, y reactivarla
//    no los devuelve; un clic las dejaba afuera con las integraciones rotas sin aviso. «Reactivar» va directo.
// ⚠️ «Agregar persona», «Eliminar» y mudarla de negocio volvieron el 6/11/2026: la grilla vieja (app/admin/AdminView.tsx) los
//    tenía con estos mismos cuerpos y la copia de Polar los había perdido.

import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import {
  cambioDeEstado,
  confirmacionDeEstado,
  ROTULO_ESTADO_MIEMBRO,
  ROTULO_ROL,
  TEXTO_ELIMINAR_PERSONA,
  type DestinoDeAlta,
  type MiembroNegocio,
} from '@/app/admin/_polar/datos/cliente'
import { ROTULO_TIPO_PERSONA } from '@/app/admin/_polar/datos/personas'
import { avisoInvitacion, type AvisoInvitacion, type ResultadoInvitacion } from '@/lib/invitacion-aviso'
import { MoreVertOutlined, PeopleAltOutlined } from '@/app/admin/_polar/orbit/icons'
import { ConfirmModal } from '@/app/admin/_polar/web/Modal/ConfirmModal'
import { EmptyState } from '@/app/admin/_polar/web/Shared/EmptyState'
import {
  Alert,
  Avatar,
  Button,
  DataTable,
  type DataTableColumnDef,
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/app/admin/_polar/ui/dropdown-menu'
import { useRouter } from '@/app/_ui/Link'
import { useState } from 'react'
import { EditMemberModal } from '../EditMemberModal'
import { accionDelMiembro } from './acciones'
import { AddMemberModal } from './AddMemberModal'

interface MembersSectionProps {
  miembros: MiembroNegocio[]
  /** A dónde suma «Agregar persona»: el negocio de la ficha, o la plataforma (Settings › Members). */
  destino: DestinoDeAlta
  /** Los negocios a los que se puede mudar a alguien («Editar persona»). `null` = no se pudieron leer: no se ofrece mudar. */
  negocios?: ReadonlyArray<{ ws: number; nombre: string }> | null
  /** Lo que se dice sin nadie. */
  vacio: { titulo: string; texto: string }
  /** Settings › Members ya tiene el título en su cabecera. */
  sinTitulo?: boolean
}

type Aviso = { tono: 'ok' | 'warn' | 'error'; texto: string }

/**
 * Los anchos de las columnas de Members. Suman 723 px: entran en la ficha a 1440 (744 px de tabla, medido el 6/11/2026). Con el
 * default de 150 de TanStack la tabla medía 1.000 y el «⋯» de cada persona quedaba afuera, del otro lado de un scroll de
 * costado. Lo fija tests/admin-polar-pantalla.test.ts, que los suma.
 */
export const ANCHOS_MIEMBROS = {
  persona: 220,
  rol: 95,
  estado: 105,
  dosPasos: 60,
  ultimoIngreso: 105,
  alta: 90,
  acciones: 48,
} as const

/**
 * Las columnas de Settings › Members (la plataforma): «Tipo» (de qué lado está, y su rol si es del equipo) en el lugar de «Rol»,
 * y sin «Alta». Suman 688 px, para entrar en el cuerpo de Settings: el `max-w-md` de Polar (768) menos el relleno de
 * DashboardBody (2 × 32) son 704 (una cuenta sobre el código, sin medir en pantalla).
 */
export const ANCHOS_MIEMBROS_PLATAFORMA = {
  persona: 220,
  tipo: 150,
  estado: 105,
  dosPasos: 60,
  ultimoIngreso: 105,
  acciones: 48,
} as const

const nombreDe = (m: Pick<MiembroNegocio, 'nombre' | 'email'>) => m.nombre || m.email

export const MembersSection = ({ miembros, destino, negocios = null, vacio, sinTitulo = false }: MembersSectionProps) => {
  const router = useRouter()
  const [aviso, setAviso] = useState<Aviso | null>(null)
  const [selectedMember, setSelectedMember] = useState<MiembroNegocio | null>(null)
  const [aSuspender, setASuspender] = useState<MiembroNegocio | null>(null)
  const [aEliminar, setAEliminar] = useState<MiembroNegocio | null>(null)
  const {
    show: showEditMemberModal,
    hide: hideEditMemberModal,
    isShown: isEditMemberModalShown,
  } = useModal()
  const {
    show: showAddMemberModal,
    hide: hideAddMemberModal,
    isShown: isAddMemberModalShown,
  } = useModal()
  const plataforma = destino === 'plataforma'

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

  // «Suspender» pregunta (apaga sus tokens); «Reactivar» no quita nada y va directo.
  const pedirCambioDeEstado = (m: MiembroNegocio) => {
    if (confirmacionDeEstado(m)) setASuspender(m)
    else void cambiarEstado(m)
  }

  const eliminar = async (m: MiembroNegocio) => {
    setAviso(null)
    const r = await accionDelMiembro({ action: 'eliminar', id: m.id })
    setAviso(r.ok ? { tono: 'ok', texto: `Se eliminó a ${nombreDe(m)}.` } : { tono: 'error', texto: r.error })
    router.refresh()
  }

  const alAgregar = (a: AvisoInvitacion) => setAviso({ tono: a.tono, texto: a.texto })
  const confirmacion = aSuspender ? confirmacionDeEstado(aSuspender) : null

  const columnaRol: DataTableColumnDef<MiembroNegocio> = {
    header: 'Rol',
    size: ANCHOS_MIEMBROS.rol,
    accessorKey: 'rol',
    cell: ({ row: { original } }) => {
      if (!original.rol) return <Text>—</Text>
      const [label, color] = ROTULO_ROL[original.rol]
      return <Status color={color} status={label} size="small" />
    },
  }
  // En Settings: de qué lado de la plataforma está y, si es del equipo con un rol, cuál.
  const columnaTipo: DataTableColumnDef<MiembroNegocio> = {
    header: 'Tipo',
    size: ANCHOS_MIEMBROS_PLATAFORMA.tipo,
    id: 'tipo',
    cell: ({ row: { original } }) => (
      <Box alignItems="center" gap="s">
        <Status color={original.tipo === 'admin' ? 'blue' : 'gray'} status={original.tipo ? ROTULO_TIPO_PERSONA[original.tipo] : '—'} size="small" />
        {original.tipo === 'equipo' && original.rol && (
          <Text variant="caption" color="muted">
            {ROTULO_ROL[original.rol][0]}
          </Text>
        )}
      </Box>
    ),
  }
  const columnaAlta: DataTableColumnDef<MiembroNegocio> = {
    header: 'Alta',
    size: ANCHOS_MIEMBROS.alta,
    accessorKey: 'creado',
    cell: ({ row: { original } }) => <FormattedDateTime datetime={original.creado} />,
  }

  return (
    <Box flexDirection="column" gap="l">
      <Box alignItems="center" justifyContent={sinTitulo ? 'end' : 'between'} gap="m">
        {!sinTitulo && (
          <Text variant="heading-xxs" as="h3">
            Members
          </Text>
        )}
        <Button variant="secondary" size="sm" onClick={showAddMemberModal}>
          Agregar persona
        </Button>
      </Box>
      {aviso && (
        <Alert
          variant={aviso.tono === 'ok' ? 'success' : aviso.tono === 'warn' ? 'warning' : 'danger'}
          title={aviso.tono === 'error' ? 'No se pudo' : aviso.tono === 'warn' ? 'Falta un paso' : 'Listo'}
          description={aviso.texto}
          onDismiss={() => setAviso(null)}
        />
      )}
      {miembros.length === 0 ? (
        <EmptyState icon={<PeopleAltOutlined fontSize="medium" />} title={vacio.titulo} description={vacio.texto} />
      ) : (
      <DataTable
        data={miembros}
        // Los anchos, en ANCHOS_MIEMBROS y ANCHOS_MIEMBROS_PLATAFORMA (arriba del componente).
        columns={[
          {
            header: 'Persona',
            accessorKey: 'email',
            size: plataforma ? ANCHOS_MIEMBROS_PLATAFORMA.persona : ANCHOS_MIEMBROS.persona,
            cell: ({ row: { original } }) => (
              <Box alignItems="center" gap="m">
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
          plataforma ? columnaTipo : columnaRol,
          {
            header: 'Estado',
            size: ANCHOS_MIEMBROS.estado,
            id: 'estado',
            cell: ({ row: { original } }) => {
              const [label, color] = ROTULO_ESTADO_MIEMBRO[original.estado]
              // ⚠️ Apilados: en fila, «Invitado» + «Sin acceso enviado» no entran en los 105 px de la columna y la aclaración se
              //    dibujaba encima de la columna 2FA (capturas del 6/11/2026).
              return (
                <Box flexDirection="column" alignItems="start" rowGap="xs" minWidth={0}>
                  <Status color={color} status={label} size="small" />
                  {original.estado === 'invitado' && (
                    <Text variant="caption" color="muted">
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
            size: ANCHOS_MIEMBROS.dosPasos,
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
            size: ANCHOS_MIEMBROS.ultimoIngreso,
            accessorKey: 'ultimoIngreso',
            cell: ({ row: { original } }) =>
              original.ultimoIngreso ? (
                <FormattedDateTime datetime={original.ultimoIngreso} />
              ) : (
                <Text color="muted">Nunca</Text>
              ),
          },
          ...(plataforma ? [] : [columnaAlta]),
          {
            id: 'actions',
            header: () => null,
            size: ANCHOS_MIEMBROS.acciones,
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
                    <DropdownMenuItem onClick={() => pedirCambioDeEstado(original)}>
                      {original.estado === 'suspendido' ? 'Reactivar' : 'Suspender'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem destructive onClick={() => setAEliminar(original)}>
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Box>
            ),
          },
        ]}
        isLoading={false}
        className="text-sm"
      />
      )}
      <InlineModal
        isShown={isEditMemberModalShown}
        hide={hideEditMemberModal}
        modalContent={
          selectedMember ? (
            <EditMemberModal
              member={selectedMember}
              negocios={negocios}
              onClose={hideEditMemberModal}
            />
          ) : null
        }
      />
      <InlineModal
        isShown={isAddMemberModalShown}
        hide={hideAddMemberModal}
        modalContent={<AddMemberModal destino={destino} onClose={hideAddMemberModal} onListo={alAgregar} />}
      />
      <ConfirmModal
        isShown={aSuspender != null}
        hide={() => setASuspender(null)}
        title={`¿Suspender a «${aSuspender ? nombreDe(aSuspender) : ''}»?`}
        description={confirmacion?.texto}
        destructive
        destructiveText={confirmacion?.boton ?? 'Suspender'}
        cancelText="No suspender"
        onConfirm={() => (aSuspender ? cambiarEstado(aSuspender) : undefined)}
      />
      <ConfirmModal
        isShown={aEliminar != null}
        hide={() => setAEliminar(null)}
        title={`¿Eliminar a «${aEliminar ? nombreDe(aEliminar) : ''}»?`}
        description={TEXTO_ELIMINAR_PERSONA}
        destructive
        destructiveText="Eliminar"
        cancelText="No eliminar"
        onConfirm={() => (aEliminar ? eliminar(aEliminar) : undefined)}
      />
    </Box>
  )
}

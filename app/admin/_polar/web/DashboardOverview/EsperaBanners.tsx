'use client'

// Copiado de polarsource/polar (Apache-2.0), clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/(home)/DisputesBanner.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// LO QUE ESPERA A MARTÍN, arriba de los widgets: donde Polar avisa el estado de la organización y las disputas por
// responder, MaKo avisa quién pidió entrar, qué pidieron las agencias y quién pidió eliminar su cuenta. Cada banner es el
// `Alert` de Polar (como `DisputesBanner`): dice cuántos hay y su acción abre un `Modal` con la lista y las acciones de
// siempre, contra los mismos endpoints que usaban las pantallas viejas (app/admin/PedidosDeIngreso.tsx,
// AprobacionesDeAgencia.tsx y BajasDeCuenta.tsx; se leyeron, no se importan):
//   · «Quieren entrar»: /api/admin/pedidos-ingreso (descartar) y el alta de siempre, /api/admin/workspaces `crear`;
//   · las agencias: /api/admin/agencia (dejar mirar a un cliente) y /api/admin/agencia/altas (sumar a alguien a su equipo);
//   · las bajas: /api/admin/bajas-cuenta (cancelar, eliminar a la persona, cerrar el del negocio ya borrado). El negocio
//     entero NO se borra desde acá: desde su ficha (Customers › <negocio>), con el nombre escrito a mano.
// Las dos reglas que ya tenían: SIN NADA ESPERANDO, NO SE DIBUJA NADA; y un error de lectura NO es «no hay nadie»: se dice.
// Lo que se lee viene del server (la portada); después de cada acción se vuelve a pedir la página (`router.refresh()`).

import { Alert, Button, Input, List, ListItem, Modal, Text } from '@/app/admin/_polar/orbit'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/admin/_polar/orbit'
import Link, { useRouter } from '@/app/_ui/Link'
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte'
import { useModal } from '@/app/admin/_polar/web/Modal/useModal'
import { altaDelPedido } from '@/lib/pedidos-ingreso-reglas'
import { avisoInvitacion, type AvisoInvitacion } from '@/lib/invitacion-aviso'
import {
  tituloDeAgencias,
  tituloDeBajas,
  tituloDeIngreso,
  type Esperan,
  type PedidoIngreso,
  type PlanAlta,
} from '@/app/admin/_polar/datos/resumen'
import { useId, useState, type ReactNode } from 'react'

type Respuesta = { ok?: boolean; error?: string; aviso?: { tono: 'ok' | 'warn'; texto: string }; invitacion?: Parameters<typeof avisoInvitacion>[0] }

async function postJson(url: string, body: unknown): Promise<Respuesta> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return (await r.json().catch(() => ({ ok: false, error: 'La respuesta no se pudo leer.' }))) as Respuesta
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** El error de una lectura o de una acción, con su «Reportar a Soporte» (AGENTS.md: todo aviso de error lo lleva). */
const ErrorAlert = ({ title, error }: { title: string; error: string }) => (
  <Alert
    variant="danger"
    title={title}
    description={
      <>
        {error} <ReportarASoporte error={`${title}: ${error}`} />
      </>
    }
  />
)

/** El resultado de una acción que le manda algo a alguien, pegado a su renglón. */
const AvisoFila = ({ aviso }: { aviso: { tono: 'ok' | 'warn'; texto: string } }) => (
  <Text color={aviso.tono === 'ok' ? 'success' : 'warning'}>{aviso.texto}</Text>
)

/** El cuerpo de cada modal: el título y la frase de Polar (`p-8`, como ConfirmModal) y la lista. */
const CuerpoModal = ({ title, description, children }: { title: string; description: string; children: ReactNode }) => (
  <div className="flex flex-col gap-y-4 p-8">
    <h3 className="text-xl font-medium">{title}</h3>
    <p className="dark:text-polar-400 max-w-full text-sm text-gray-500">{description}</p>
    {children}
  </div>
)

// ── Quieren entrar ────────────────────────────────────────────────────────────────────────────────────────────────

const AltaDelPedido = ({
  pedido,
  planes,
  planPorDefecto,
  onVolver,
}: {
  pedido: PedidoIngreso
  planes: PlanAlta[]
  planPorDefecto: string
  onVolver: () => void
}) => {
  const router = useRouter()
  const inicial = altaDelPedido(pedido)
  const [nombre, setNombre] = useState(inicial.nombre)
  const [capa, setCapa] = useState(planPorDefecto)
  const [adminEmail, setAdminEmail] = useState(inicial.adminEmail)
  const [adminNombre, setAdminNombre] = useState(inicial.adminNombre)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hecho, setHecho] = useState<AvisoInvitacion | null>(null)
  const ids = { nombre: useId(), plan: useId(), email: useId(), admin: useId() }
  const plan = planes.find((p) => p.id === capa)
  const puedeCrear = nombre.trim().length > 0 && !creando && !hecho

  const crear = async () => {
    if (!puedeCrear) return
    setError(null)
    setCreando(true)
    try {
      const j = await postJson('/api/admin/workspaces', { action: 'crear', nombre: nombre.trim(), capa, adminEmail: adminEmail.trim(), adminNombre: adminNombre.trim() })
      if (!j.ok) {
        setError(j.error ?? 'No se pudo crear el cliente.')
        return
      }
      setHecho(avisoInvitacion(j.invitacion, adminEmail.trim()))
      router.refresh()
    } finally {
      setCreando(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-y-2">
          <label htmlFor={ids.nombre} className="text-sm font-medium">Nombre del cliente</label>
          <Input id={ids.nombre} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Por ejemplo, Estudio Norte" />
        </div>
        <div className="flex flex-col gap-y-2">
          <label htmlFor={ids.plan} className="text-sm font-medium">Plan</label>
          <Select value={capa} onValueChange={setCapa}>
            <SelectTrigger id={ids.plan}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {planes.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-y-2">
          <label htmlFor={ids.email} className="text-sm font-medium">Email del admin</label>
          <Input id={ids.email} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="ana@ejemplo.com" />
        </div>
        <div className="flex flex-col gap-y-2">
          <label htmlFor={ids.admin} className="text-sm font-medium">Nombre del admin</label>
          <Input id={ids.admin} value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} placeholder="Nombre y apellido" />
        </div>
      </div>
      {plan && <Text color="muted">{plan.descripcion}</Text>}
      {plan?.aviso && <Text color="warning">{plan.aviso}</Text>}
      {error && <ErrorAlert title="No se pudo crear el cliente" error={error} />}
      {hecho && <AvisoFila aviso={hecho} />}
      <div className="flex flex-row-reverse gap-x-4 pt-2">
        {!hecho && (
          <Button onClick={() => void crear()} loading={creando} disabled={!puedeCrear}>
            Crear la cuenta y mandarle el acceso
          </Button>
        )}
        <Button variant="ghost" onClick={onVolver} disabled={creando}>
          {hecho ? 'Volver a la lista' : 'Cancelar'}
        </Button>
      </div>
    </div>
  )
}

const QuierenEntrar = ({ esperan }: { esperan: Esperan }) => {
  const router = useRouter()
  const { isShown, show, hide } = useModal()
  const [alta, setAlta] = useState<PedidoIngreso | null>(null)
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const lectura = esperan.ingreso

  if (!lectura.ok) return <ErrorAlert title="No pude leer quién quiere entrar" error={lectura.error} />
  const { pedidos, hayMas } = lectura.datos
  const title = tituloDeIngreso(pedidos.length)
  // Sin nadie esperando no se dibuja; con el modal abierto se queda (para leer el aviso de la última alta).
  if (!title && !isShown) return null

  const descartar = async (p: PedidoIngreso) => {
    setOcupado(p.id)
    setError(null)
    try {
      const j = await postJson('/api/admin/pedidos-ingreso', { id: p.id })
      if (!j.ok) setError(j.error ?? 'No se pudo descartar.')
      else router.refresh()
    } finally {
      setOcupado(null)
    }
  }

  const cerrar = () => {
    setAlta(null)
    setError(null)
    hide()
  }

  return (
    <>
      {title && (
        <Alert
          title={title}
          description="Pidieron entrar y todavía no tienen cuenta. Dales de alta o descarta el pedido."
          actions={[{ text: pedidos.length === 1 ? 'Ver el pedido' : 'Ver los pedidos', onClick: show }]}
        />
      )}
      <Modal
        title="Quieren entrar"
        className="lg:w-[720px]"
        isShown={isShown}
        hide={cerrar}
        modalContent={
          <CuerpoModal
            title={alta ? `Dar de alta a ${alta.nombre ?? alta.email}` : 'Quieren entrar'}
            description={alta ? 'Se crea su cuenta y MaKo le manda el acceso a su email.' : 'Quien pidió entrar a MaKo y todavía no tiene cuenta. Al darle de alta, sale solo de esta lista.'}
          >
            {alta ? (
              <AltaDelPedido pedido={alta} planes={esperan.planes} planPorDefecto={esperan.planPorDefecto} onVolver={() => setAlta(null)} />
            ) : (
              <>
                {error && <ErrorAlert title="No se pudo descartar" error={error} />}
                {pedidos.length === 0 ? (
                  <Text color="muted">Ya no queda nadie esperando.</Text>
                ) : (
                  <List size="small">
                    {pedidos.map((p) => (
                      <ListItem key={p.id} size="small" className="flex-wrap gap-y-2">
                        <div className="flex min-w-0 flex-col gap-y-0.5">
                          <Text truncate>{p.nombre ? `${p.nombre} · ${p.email}` : p.email}</Text>
                          <Text color="muted">{p.detalle}</Text>
                        </div>
                        <div className="flex shrink-0 gap-x-2">
                          <Button variant="ghost" size="sm" loading={ocupado === p.id} disabled={ocupado != null} onClick={() => void descartar(p)}>
                            Descartar
                          </Button>
                          <Button size="sm" disabled={ocupado != null} onClick={() => setAlta(p)}>
                            Dar de alta
                          </Button>
                        </div>
                      </ListItem>
                    ))}
                  </List>
                )}
                {hayMas && <Text color="muted">Se ven los 50 más recientes.</Text>}
              </>
            )}
          </CuerpoModal>
        }
      />
    </>
  )
}

// ── Las agencias ──────────────────────────────────────────────────────────────────────────────────────────────────

const DeAgencias = ({ esperan }: { esperan: Esperan }) => {
  const router = useRouter()
  const { isShown, show, hide } = useModal()
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** El resultado de la última firma, pegado a SU renglón (la clave del renglón). */
  const [aviso, setAviso] = useState<{ clave: string; aviso: { tono: 'ok' | 'warn'; texto: string } } | null>(null)
  const { carteras, altas } = esperan.agencias
  const title = tituloDeAgencias(carteras.length + altas.length)
  if (!title && !isShown) return null

  const firmar = async (clave: string, url: string, body: unknown) => {
    setOcupado(clave)
    setError(null)
    setAviso(null)
    try {
      const j = await postJson(url, body)
      if (!j.ok) {
        setError(j.error ?? 'No se pudo aplicar.')
        return
      }
      if (j.aviso) setAviso({ clave, aviso: j.aviso })
      router.refresh()
    } finally {
      setOcupado(null)
    }
  }

  return (
    <>
      {title && (
        <Alert
          title={title}
          description="Una agencia quiere entrar al dashboard de un cliente suyo, o sumarle a alguien al equipo."
          actions={[{ text: 'Revisar', onClick: show }]}
        />
      )}
      <Modal
        title="Pedidos de las agencias"
        className="lg:w-[720px]"
        isShown={isShown}
        hide={() => {
          setAviso(null)
          setError(null)
          hide()
        }}
        modalContent={
          <CuerpoModal title="Pedidos de las agencias" description="Dejar entrar le manda el acceso al cliente; crear la cuenta le manda un correo a la persona.">
            {error && <ErrorAlert title="No se pudo aplicar" error={error} />}
            {carteras.length + altas.length === 0 && !aviso ? (
              <Text color="muted">Ya no queda nada por firmar.</Text>
            ) : (
              <List size="small">
                {carteras.map((c) => {
                  const clave = `cartera:${c.agenciaWs}:${c.clienteWs}`
                  return (
                    <ListItem key={clave} size="small" className="flex-wrap gap-y-2">
                      <Text>
                        <b>{c.agencia}</b> quiere entrar a <b>{c.cliente}</b>
                      </Text>
                      <div className="flex shrink-0 gap-x-2">
                        <Button variant="ghost" size="sm" disabled={ocupado != null}
                          onClick={() => void firmar(clave, '/api/admin/agencia', { agenciaWs: c.agenciaWs, clienteWs: c.clienteWs, estado: 'revocado' })}>
                          No dejar entrar
                        </Button>
                        <Button size="sm" loading={ocupado === clave} disabled={ocupado != null}
                          onClick={() => void firmar(clave, '/api/admin/agencia', { agenciaWs: c.agenciaWs, clienteWs: c.clienteWs, estado: 'aprobado' })}>
                          Dejar entrar
                        </Button>
                      </div>
                    </ListItem>
                  )
                })}
                {altas.map((a) => {
                  const clave = `alta:${a.id}`
                  return (
                    <ListItem key={clave} size="small" className="flex-wrap gap-y-2">
                      <Text>
                        <b>{a.agencia}</b> quiere sumar a <b>{a.email}</b> al equipo de <b>{a.cliente}</b> como {a.rol}
                      </Text>
                      <div className="flex shrink-0 gap-x-2">
                        <Button variant="ghost" size="sm" disabled={ocupado != null}
                          onClick={() => void firmar(clave, '/api/admin/agencia/altas', { id: a.id, estado: 'rechazada' })}>
                          No sumarlo
                        </Button>
                        <Button size="sm" loading={ocupado === clave} disabled={ocupado != null}
                          onClick={() => void firmar(clave, '/api/admin/agencia/altas', { id: a.id, estado: 'aprobada' })}>
                          Crear la cuenta
                        </Button>
                      </div>
                    </ListItem>
                  )
                })}
              </List>
            )}
            {aviso && <AvisoFila aviso={aviso.aviso} />}
          </CuerpoModal>
        }
      />
    </>
  )
}

// ── Pidieron eliminar su cuenta ───────────────────────────────────────────────────────────────────────────────────

const Bajas = ({ esperan }: { esperan: Esperan }) => {
  const router = useRouter()
  const { isShown, show, hide } = useModal()
  const [ocupado, setOcupado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Eliminar a una persona no se deshace: el primer clic pregunta, el segundo elimina. */
  const [aConfirmar, setAConfirmar] = useState<number | null>(null)
  const lectura = esperan.bajas

  if (!lectura.ok) return <ErrorAlert title="No pude leer quién pidió eliminar su cuenta" error={lectura.error} />
  const { bajas } = lectura.datos
  const title = tituloDeBajas(bajas.length)
  if (!title && !isShown) return null
  const vencidas = bajas.filter((b) => b.vencido).length

  const accion = async (id: number, que: 'cancelar' | 'eliminar-persona' | 'terminar') => {
    setOcupado(id)
    setError(null)
    try {
      const j = await postJson('/api/admin/bajas-cuenta', { id, accion: que })
      if (!j.ok) setError(j.error ?? 'No se pudo.')
      else {
        setAConfirmar(null)
        router.refresh()
      }
    } finally {
      setOcupado(null)
    }
  }

  return (
    <>
      {title && (
        <Alert
          variant={vencidas > 0 ? 'danger' : 'warning'}
          title={title}
          description={
            vencidas > 0
              ? `${vencidas === 1 ? 'Una ya se pasó' : `${vencidas} ya se pasaron`} del plazo que le dijimos.`
              : 'Le dijimos una fecha: hay que borrarla antes de que venza.'
          }
          actions={[{ text: 'Revisar', onClick: show }]}
        />
      )}
      <Modal
        title="Pidieron eliminar su cuenta"
        className="lg:w-[720px]"
        isShown={isShown}
        hide={() => {
          setAConfirmar(null)
          setError(null)
          hide()
        }}
        modalContent={
          <CuerpoModal title="Pidieron eliminar su cuenta" description="El negocio entero se elimina desde su ficha en Customers, con su nombre escrito a mano.">
            {error && <ErrorAlert title="No se pudo" error={error} />}
            {bajas.length === 0 ? (
              <Text color="muted">Ya no queda ningún pedido.</Text>
            ) : (
              <List size="small">
                {bajas.map((b) => (
                  <ListItem key={b.id} size="small" className="flex-wrap gap-y-2">
                    <div className="flex min-w-0 flex-col gap-y-0.5">
                      <Text truncate>{b.titulo}</Text>
                      <Text color={b.vencido ? 'danger' : 'muted'}>{b.plazo}</Text>
                      {b.notas && <Text color="danger">{b.notas}</Text>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {b.negocioWs != null && (
                        <Link href={`/admin/customers/${b.negocioWs}`}>
                          <Button variant="secondary" size="sm">Ver el negocio</Button>
                        </Link>
                      )}
                      {b.puedeTerminar && (
                        <Button size="sm" loading={ocupado === b.id} disabled={ocupado != null} onClick={() => void accion(b.id, 'terminar')}>
                          Ya está: avisarle
                        </Button>
                      )}
                      {b.puedeEliminar && (aConfirmar === b.id ? (
                        <>
                          <Text color="danger">Se borran su usuario y sus datos. No se deshace.</Text>
                          <Button variant="destructive" size="sm" loading={ocupado === b.id} disabled={ocupado != null} onClick={() => void accion(b.id, 'eliminar-persona')}>
                            Eliminar para siempre
                          </Button>
                          <Button variant="ghost" size="sm" disabled={ocupado != null} onClick={() => setAConfirmar(null)}>
                            No eliminar
                          </Button>
                        </>
                      ) : (
                        <Button variant="destructive" size="sm" disabled={ocupado != null} onClick={() => setAConfirmar(b.id)}>
                          Eliminar
                        </Button>
                      ))}
                      <Button variant="ghost" size="sm" disabled={ocupado != null} onClick={() => void accion(b.id, 'cancelar')}>
                        Cancelar el pedido
                      </Button>
                    </div>
                  </ListItem>
                ))}
              </List>
            )}
          </CuerpoModal>
        }
      />
    </>
  )
}

/**
 * Los banners de lo que espera a Martín, y arriba lo que no se pudo leer del todo. Sin nada (ni un error de lectura), no se
 * dibuja ninguno, y la caja tampoco ocupa lugar (`empty:hidden`: en Polar cada banner es un hermano del cuerpo, que separa
 * con `gap-y-16`; tres juntos van más cerca). Cada banner queda montado con su modal abierto aunque el último pedido se
 * haya resuelto: el aviso de la última acción (el acceso que no salió, con su link) tiene que poder leerse.
 */
export const EsperaBanners = ({ esperan, avisos }: { esperan: Esperan; avisos: string[] }) => (
  <div className="flex flex-col gap-y-4 empty:hidden">
    {avisos.length > 0 && (
      <Alert
        variant="warning"
        title="No pude leer todo: lo que ves puede quedarse corto"
        description={
          <>
            {avisos.join(' · ')} <ReportarASoporte error={`Admin › Overview: ${avisos.join(' · ')}`} />
          </>
        }
      />
    )}
    <Bajas esperan={esperan} />
    <DeAgencias esperan={esperan} />
    <QuierenEntrar esperan={esperan} />
  </div>
)

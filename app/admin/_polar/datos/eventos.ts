// =============================================================================
// Admin › Analytics › Events: TODO lo que pasa en MaKo, en la lista de eventos de Polar (6/11/2026)
// =============================================================================
// Polar lista los eventos de su API (`useInfiniteEvents`, `useEventHistogram`, `useEventTypeStats`) y los filtra en su
// servidor. MaKo no tiene una tabla de eventos: junta lo que ya leen sus lectores (cada uno con su propia lectura, en
// eventos-server.ts) y lo filtra EN MEMORIA, con las mismas reglas que la pantalla de Polar:
//   · pago        → cada pedido de Admin › Sales (`vistaOrders`, app/admin/_polar/datos/ventas-server.ts), con su negocio;
//   · devolucion  → lo que de esos pedidos se devolvió o se anuló (el recibo del pedido: `devueltoAt`, `anuladoAt`);
//   · suscripcion → cada cambio de lo que paga por mes un cliente (lib/admin-ingresos.ts → `movimientos`);
//   · alta        → el alta de cada negocio (`workspaces.created_at`, sin el de la plataforma);
//   · mako        → lo que HIZO MaKo por un negocio, las acciones (lib/actividad.ts → `acciones`, la tabla actividad_acciones);
//   · lectura     → lo que MaKo LEYÓ para un negocio, de la misma tabla. Aparte desde el 6/11/2026 (punto 13 de la revisión):
//     «N eventos hoy» de Overview cuenta pagos y acciones, y su «Ver todo» abre `eventTypes=pago,mako&range=today`, que tiene
//     que dar el mismo número;
//   · error       → los errores de la app agrupados por huella (lib/admin-errores.ts → `errores`);
//   · reporte     → lo que reportaron las personas (lib/admin-errores.ts → `reportes`, los tickets);
//   · agente      → cada sesión del Claude Code de un cliente (lib/agente-sesiones.ts, lo que era /admin/agente).
// `?tipo=error` y `?tipo=agente` (los links de las pantallas viejas) abren filtrado: `tiposDeUrl`.
//
// ⚠️ ES LA ÚNICA DEFINICIÓN DE «UN EVENTO DE UN NEGOCIO» (6/11/2026): la ficha de un negocio no tiene una lista propia. Su
//    «Events» abre esta pantalla filtrada por él (`rutaDeEventosDelNegocio`, como `buildCustomerEventsPath` de Polar) y su
//    Timeline son los últimos de acá (`timelineDelNegocio`). Hasta ese día eran dos lectores y dos pantallas de lo mismo.
// ⚠️ CADA LECTOR TIENE SU TOPE (las últimas 100 acciones, los 500 errores más recientes, 40 reportes, 200 sesiones). Lo
//    que queda afuera NO se calla: `cortes` dice desde cuándo falta cada cosa, y la pantalla lo muestra si el rango llega
//    hasta ahí. Un «no hay eventos» sobre un pedazo que no se leyó sería mentir. Los negocios del filtro (`?customerIds=`,
//    lo que abre la ficha) se leen ADEMÁS a fondo: sus últimas 300 acciones y 100 reportes (`aFondo`), lo mismo que leía la
//    subpágina vieja; ahí el corte de todos no vale (`salvo`) y vale el de ese negocio, si llegó a su tope.
// ⚠️ SIN CONTENIDO DE UN NEGOCIO más allá de lo que ya mostraban las pantallas viejas (Errors, Agents): el título de un
//    error ya saneado, el acta y los mensajes de una sesión del agente.
// Puro (sin server-only): lo usan la vista del navegador y los tests. Los tipos de los lectores con `server-only` se
// importan sólo como tipos.
// =============================================================================

import type { Movimiento, TipoMovimiento } from '@/lib/admin-ingresos-reglas'
import type { AccionMako } from '@/lib/actividad'
import type { Persona } from '@/lib/actividad-reglas'
import { estadoDeError, ROTULO_ESTADO_ERROR, type FilaError } from '@/lib/admin-errores-reglas'
import type { Reporte } from '@/lib/admin-errores'
import type { SesionAgente } from '@/lib/agente-sesiones'
import { formatoMonto } from '@/lib/pasarela-moneda'
import { cortarSinPartir } from '@/lib/unicode-seguro'
import { aCentavos } from './metricas'
import { medioEnTexto, ROTULO_ESTADO_PEDIDO, type Pedido, type ReciboVenta } from './ventas'
import { rutaDePedido } from './cliente'

export const NOMBRES_EVENTO = ['pago', 'devolucion', 'suscripcion', 'alta', 'mako', 'lectura', 'error', 'reporte', 'agente'] as const
export type NombreEvento = (typeof NOMBRES_EVENTO)[number]

/** Los «system events» de Polar (lo que pasa con la cuenta) y sus «user events» (lo que hizo alguien: MaKo, una persona). */
export type FuenteEvento = 'system' | 'user'
/** La importancia del Timeline de Polar (components/Timeline/renderers.tsx): lo de importancia baja seguido se pliega. */
export type ImportanciaEvento = 'high' | 'medium' | 'low'

/**
 * El rótulo de cada tipo (el `label` de un event type de Polar), en el orden en que se listan a igual cantidad, de qué fuente
 * es y su importancia en el Timeline (la de los renderers de Polar: `order.*` y `subscription.created` altas,
 * `customer.created` media; un user event, media).
 */
export const TIPOS_EVENTO: Record<NombreEvento, { label: string; orden: number; source: FuenteEvento; importancia: ImportanciaEvento }> = {
  pago: { label: 'Pagos recibidos', orden: 0, source: 'system', importancia: 'high' },
  devolucion: { label: 'Pagos devueltos o anulados', orden: 1, source: 'system', importancia: 'high' },
  suscripcion: { label: 'Cambios de suscripción', orden: 2, source: 'system', importancia: 'high' },
  alta: { label: 'Altas de negocios', orden: 3, source: 'system', importancia: 'medium' },
  mako: { label: 'Acciones de MaKo', orden: 4, source: 'user', importancia: 'medium' },
  lectura: { label: 'Lecturas de MaKo', orden: 5, source: 'user', importancia: 'low' },
  agente: { label: 'Agentes de los clientes', orden: 6, source: 'user', importancia: 'medium' },
  error: { label: 'Errores de la app', orden: 7, source: 'system', importancia: 'high' },
  reporte: { label: 'Reportes de las personas', orden: 8, source: 'user', importancia: 'medium' },
}

/**
 * `?tipo=` de los links viejos → los tipos que abre. «error» son los crashes Y los reportes (lo que era la pestaña
 * Errors); «agente», las sesiones del Claude Code de los clientes (lo que era Agents, /admin/agente).
 */
export const ALIAS_TIPO: Record<string, NombreEvento[]> = {
  error: ['error', 'reporte'],
  errores: ['error', 'reporte'],
  errors: ['error', 'reporte'],
  agente: ['agente'],
  agentes: ['agente'],
  agents: ['agente'],
  pago: ['pago'],
  pagos: ['pago'],
  devolucion: ['devolucion'],
  devoluciones: ['devolucion'],
  suscripcion: ['suscripcion'],
  suscripciones: ['suscripcion'],
  alta: ['alta'],
  altas: ['alta'],
  mako: ['mako'],
  lectura: ['lectura'],
  lecturas: ['lectura'],
  // La pantalla vieja de Activity mostraba las dos.
  actividad: ['mako', 'lectura'],
  reporte: ['reporte'],
}

export const esNombreEvento = (s: string): s is NombreEvento => (NOMBRES_EVENTO as readonly string[]).includes(s)

/** Los tipos que cuenta «N eventos hoy» de Overview (`actividadReciente`, ./resumen.ts): los pagos y las acciones de MaKo. */
export const TIPOS_DE_HOY: readonly NombreEvento[] = ['pago', 'mako']
/** El «Ver todo» de esa tarjeta: Events en lo de hoy, con esos tipos (el `range=today` de Polar; punto 13). */
export const EVENTOS_DE_HOY = `/admin/analytics/events?range=today&eventTypes=${TIPOS_DE_HOY.join(',')}`

/** Los tipos que abre `?tipo=<x>` (null = el valor no nombra ninguno). */
export function tiposDeUrl(tipo: string | string[] | undefined): NombreEvento[] | null {
  const valores = (Array.isArray(tipo) ? tipo : tipo ? [tipo] : []).flatMap((v) => v.split(','))
  const out = new Set<NombreEvento>()
  for (const v of valores) for (const n of ALIAS_TIPO[v.trim().toLowerCase()] ?? []) out.add(n)
  return out.size ? NOMBRES_EVENTO.filter((n) => out.has(n)) : null
}

/** Cuántos negocios del filtro se leen a fondo, como mucho (cada uno son dos lecturas más). */
export const TOPE_NEGOCIOS_A_FONDO = 10

/** Los negocios de `?customerIds=` (el filtro de la pantalla, lo que abre la ficha): ids válidos, sin repetir y con tope. */
export function negociosDeUrl(v: string | string[] | undefined): number[] {
  const out: number[] = []
  for (const x of (Array.isArray(v) ? v : v ? [v] : []).flatMap((s) => s.split(','))) {
    const s = x.trim()
    if (!/^[1-9]\d{0,11}$/.test(s)) continue
    const n = Number(s)
    if (Number.isSafeInteger(n) && !out.includes(n)) out.push(n)
    if (out.length >= TOPE_NEGOCIOS_A_FONDO) break
  }
  return out
}

export type NegocioEvento = { ws: number; nombre: string }
/**
 * Un renglón del detalle: el rótulo, el valor y si se puede copiar. Con `fecha`, `valor` es un ISO y lo formatea el
 * NAVEGADOR (en la zona de quien mira): formateado acá, en el server, saldría en la hora de Vercel (UTC). Con `href`, el
 * valor lleva a su página en Admin (el `ResourceLink` de Polar: el pedido de un pago, en Sales).
 */
export type CampoEvento = { label: string; valor: string; mono?: boolean; copiar?: boolean; fecha?: boolean; href?: string }
/** Un bloque de texto del detalle (el stack de un error, los mensajes de una sesión del agente). */
export type SeccionEvento = { titulo: string; lineas: string[]; mono?: boolean }

export type EventoAdmin = {
  id: string
  nombre: NombreEvento
  /** Lo que se lee en la fila. */
  label: string
  /** ISO. */
  timestamp: string
  /** Sólo se sabe el DÍA (un pago se registra con su fecha, sin hora): no se muestra una hora inventada. */
  soloDia?: boolean
  negocios: NegocioEvento[]
  persona: string | null
  /** La plata del evento, en centavos de dólar (los pagos; una devolución entera, en negativo). */
  monto: number | null
  /** Cuántas veces pasó (los errores agrupados). */
  veces: number | null
  /** Una acción que salió mal. */
  falla: boolean
  /** Lo malo (un pago devuelto, un corte, un error, lo que MaKo no pudo): el `sentiment: 'negative'` de Polar. */
  negativo: boolean
  importancia: ImportanciaEvento
  /** La segunda línea del Timeline («US$ 238 · Transferencia»), el `summary` de los renderers de Polar. */
  resumen: string | null
  /** A dónde lleva (el pedido de un pago, en Sales). `null` = no tiene una página propia en Admin. */
  href: string | null
  campos: CampoEvento[]
  secciones: SeccionEvento[]
  /** Todo lo que se puede buscar, sin mayúsculas ni tildes. */
  texto: string
}

/**
 * Lo que un lector deja afuera por su tope: antes de `desde` faltan esos eventos. Con `negocio`, es el corte de la lectura a
 * fondo de ESE negocio; sin él, el de todos, que no vale para los negocios de `salvo` (se leyeron a fondo).
 */
export type CorteFuente = { nombre: NombreEvento; desde: string; tope: number; negocio?: NegocioEvento; salvo?: number[] }

export type VistaEventos = {
  eventos: EventoAdmin[]
  /** Los negocios que aparecen en algún evento (para el filtro), por nombre. */
  negocios: NegocioEvento[]
  cortes: CorteFuente[]
  avisos: string[]
  /** El evento más viejo (ISO): hasta dónde se puede alejar el histograma. */
  earliest: string
}

/** Sin mayúsculas ni tildes, para buscar. */
export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const nombreDe = (nombres: Readonly<Record<number, string>>, ws: number) => nombres[ws] ?? `Negocio ${ws}`
const negocio = (nombres: Readonly<Record<number, string>>, ws: number | null | undefined): NegocioEvento[] =>
  ws == null || !Number.isFinite(Number(ws)) ? [] : [{ ws: Number(ws), nombre: nombreDe(nombres, Number(ws)) }]

type Armado = Omit<EventoAdmin, 'texto' | 'importancia' | 'negativo' | 'resumen' | 'href'> &
  Partial<Pick<EventoAdmin, 'importancia' | 'negativo' | 'resumen' | 'href'>>

const conTexto = (e: Armado): EventoAdmin => ({
  ...e,
  importancia: e.importancia ?? TIPOS_EVENTO[e.nombre].importancia,
  negativo: e.negativo ?? false,
  resumen: e.resumen ?? null,
  href: e.href ?? null,
  texto: normalizar([e.label, TIPOS_EVENTO[e.nombre].label, e.persona ?? '', ...e.negocios.map((n) => n.nombre), ...e.campos.map((c) => c.valor)].join(' ')),
})

/** Un id por evento aunque dos hechos se vean iguales (el mismo instante, la misma operación): el segundo lleva `~2`. */
const idsUnicos = () => {
  const vistos = new Map<string, number>()
  return (id: string) => {
    const n = (vistos.get(id) ?? 0) + 1
    vistos.set(id, n)
    return n === 1 ? id : `${id}~${n}`
  }
}

const usd = (n: number) => formatoMonto(n, 'USD')
/** El mediodía UTC cae en el mismo día en toda América: el día se filtra y se cuenta bien en la zona de quien mira. */
const alMediodia = (dia: string) => `${dia.slice(0, 10)}T12:00:00.000Z`
const CANAL: Record<string, string> = { app: 'En la app', whatsapp: 'Por WhatsApp', http: 'Por la API' }
const ORIGEN: Record<string, string> = { navegador: 'En el navegador', servidor: 'En el servidor', mako: 'En MaKo' }

/** Lo que hace falta de un pedido de Admin › Sales (`Pedido`, ./ventas.ts), con lo de su recibo que dice si se devolvió. */
export type PedidoEvento = Pick<Pedido, 'id' | 'fecha' | 'cliente' | 'concepto' | 'medio' | 'recurrente' | 'usd' | 'estado' | 'suma'> & {
  recibo: Pick<ReciboVenta, 'devueltoAt' | 'devueltoMonto' | 'monedaDetalle' | 'anuladoAt'> | null
}

/**
 * Los pagos y lo que se devolvió, de los pedidos de Sales (los mismos ids y el mismo estado; cada uno lleva a su pedido). Como
 * Polar (`order.paid` y `order.refunded` son dos eventos): un pedido devuelto es «Pago recibido» el día que entró y «Pago
 * devuelto» (o «Devolución parcial») cuando se devolvió. Un pedido ANULADO no entró (Sales no lo suma ni como devuelto): es
 * sólo «Pago anulado». El negocio sale de la cuenta del cliente (`cliente.ws`, por su clave), nunca de su nombre.
 */
export function eventosDePedidos(pedidos: readonly PedidoEvento[]): EventoAdmin[] {
  const out: EventoAdmin[] = []
  for (const p of pedidos) {
    // Un recibo cargado a mano sin su pago en el CRM no suma en Orders (ventas.ts, `suma`): tampoco es un «Pago recibido» acá, o el
    // mismo pago del CRM se contaba dos veces (revisión del Cerebro del 6/11/2026, punto 4).
    if (p.suma === false) continue
    const ws = p.cliente?.ws ?? null
    const negocios = ws != null && p.cliente ? [{ ws, nombre: p.cliente.nombre }] : []
    const persona = ws == null ? (p.cliente?.nombre ?? null) : null
    const monto = p.usd == null ? null : aCentavos(p.usd)
    const montoTxt = p.usd == null ? 'Sin su valor en dólares (no suma)' : usd(p.usd)
    const href = rutaDePedido(p)
    const campos: CampoEvento[] = [
      { label: 'Pedido', valor: p.concepto || p.id, href },
      { label: 'Monto', valor: montoTxt },
      { label: 'Medio', valor: medioEnTexto(p.medio) },
      { label: 'Tipo', valor: p.recurrente ? 'De una suscripción' : 'Pago único' },
      { label: 'Estado', valor: ROTULO_ESTADO_PEDIDO[p.estado] },
      ...(ws == null && p.cliente ? [{ label: 'Cliente', valor: `${p.cliente.nombre} (sin cuenta de MaKo)` }] : []),
    ]
    const resumen = [p.usd == null ? null : usd(p.usd), p.medio ? medioEnTexto(p.medio) : null].filter(Boolean).join(' · ') || null
    if (p.estado !== 'void') {
      out.push(conTexto({
        id: `pago:${p.id}`, nombre: 'pago', label: 'Pago recibido', timestamp: alMediodia(p.fecha), soloDia: true,
        negocios, persona, monto, veces: null, falla: false, resumen, href, campos, secciones: [],
      }))
    }
    if (p.estado === 'paid') continue
    const anulado = p.estado === 'void'
    const cuando = (anulado ? p.recibo?.anuladoAt : p.recibo?.devueltoAt) ?? null
    // Lo devuelto, como lo dice el pedido en Sales (OrderRefundsSection): el monto del recibo en su moneda, o el pago entero.
    const devuelto = p.recibo?.devueltoMonto != null
      ? formatoMonto(p.recibo.devueltoMonto, p.recibo.monedaDetalle)
      : p.estado === 'refunded' && p.usd != null ? usd(p.usd) : null
    out.push(conTexto({
      id: `devolucion:${p.id}`, nombre: 'devolucion',
      label: anulado ? 'Pago anulado' : p.estado === 'refunded' ? 'Pago devuelto' : 'Devolución parcial',
      timestamp: cuando ?? alMediodia(p.fecha), soloDia: cuando == null,
      negocios, persona, monto: p.estado === 'refunded' && monto != null ? -monto : null, veces: null, falla: false, negativo: true,
      resumen: anulado ? resumen : devuelto, href,
      campos: [
        ...campos,
        { label: 'Día del pago', valor: p.fecha },
        ...(!anulado && devuelto ? [{ label: 'Devuelto', valor: devuelto }] : []),
      ],
      secciones: [],
    }))
  }
  return out
}

/** Lo que hace falta de un movimiento de lo que paga por mes (lib/admin-ingresos-reglas.ts `movimientosDe`). */
export type MovimientoEvento = Pick<Movimiento, 'fecha' | 'cliente' | 'tipo' | 'antes' | 'despues'>

/** Cada movimiento, como lo nombraba la ficha: los `subscription.created/reactivated/updated/canceled` de Polar. */
const MOVIMIENTO: Record<TipoMovimiento, { label: string; importancia: ImportanciaEvento; negativo: boolean }> = {
  nuevo: { label: 'Empezó a pagar por mes', importancia: 'high', negativo: false },
  vuelve: { label: 'Volvió a pagar por mes', importancia: 'high', negativo: false },
  sube: { label: 'Subió lo que paga por mes', importancia: 'medium', negativo: false },
  baja: { label: 'Bajó lo que paga por mes', importancia: 'medium', negativo: true },
  corte: { label: 'Dejó de pagar por mes', importancia: 'high', negativo: true },
}

/** Los cambios de lo que paga por mes cada cliente, con su negocio por la clave (`ws:<n>`) si tiene cuenta. */
export function eventosDeSuscripciones(
  movimientos: readonly MovimientoEvento[],
  clientes: ReadonlyArray<{ clave: string; ws: number | null; nombre: string }>,
): EventoAdmin[] {
  const quien = new Map(clientes.map((c) => [c.clave, c]))
  const id = idsUnicos()
  return movimientos.map((m) => {
    const c = quien.get(m.cliente)
    const ws = c?.ws ?? null
    const t = MOVIMIENTO[m.tipo]
    return conTexto({
      id: id(`suscripcion:${m.cliente}:${m.fecha}:${m.tipo}`), nombre: 'suscripcion', label: t.label,
      timestamp: alMediodia(m.fecha), soloDia: true,
      negocios: ws != null && c ? [{ ws, nombre: c.nombre }] : [],
      persona: ws == null ? (c?.nombre ?? m.cliente) : null,
      monto: null, veces: null, falla: false, importancia: t.importancia, negativo: t.negativo,
      resumen: m.tipo === 'corte' ? `Pagaba ${usd(m.antes)} por mes` : `${usd(m.despues)} por mes`,
      campos: [
        { label: 'Antes', valor: `${usd(m.antes)} por mes` },
        { label: 'Después', valor: `${usd(m.despues)} por mes` },
        ...(ws == null ? [{ label: 'Cliente', valor: `${c?.nombre ?? m.cliente} (sin cuenta de MaKo)` }] : []),
      ],
      secciones: [],
    })
  })
}

/** El alta de un negocio (`workspaces.created_at`). */
export type AltaEvento = { ws: number; nombre: string; creado: string }

/** El alta de cada negocio (el `customer.created` de Polar). La plataforma no es un negocio: no llega acá. */
export function eventosDeAltas(altas: readonly AltaEvento[]): EventoAdmin[] {
  return altas.map((a) => conTexto({
    id: `alta:${a.ws}`, nombre: 'alta', label: 'Se creó la cuenta', timestamp: a.creado,
    negocios: [{ ws: a.ws, nombre: a.nombre }], persona: null, monto: null, veces: null, falla: false, campos: [], secciones: [],
  }))
}

/**
 * Lo que hizo MaKo: una acción o una lectura por renglón de actividad_acciones. Una ACCIÓN (`tipo === 'accion'`, lo que cambió
 * algo) es un evento «mako»; lo demás que corrió, una «lectura» (punto 13: el mismo corte que el «hoy» de Overview).
 */
export function eventosDeAcciones(
  acciones: readonly AccionMako[],
  nombres: Readonly<Record<number, string>>,
  personas: ReadonlyArray<Pick<Persona, 'id' | 'nombre' | 'email'>>,
): EventoAdmin[] {
  const quien = new Map(personas.map((p) => [p.id, p.nombre || p.email]))
  const id = idsUnicos()
  return acciones.map((a) => {
    const persona = a.usuario != null ? quien.get(a.usuario) ?? null : null
    const nombre: NombreEvento = a.tipo === 'accion' ? 'mako' : 'lectura'
    return conTexto({
      id: id(`${nombre}:${a.creado}:${a.operacion}:${a.ws ?? '-'}:${a.usuario ?? '-'}`),
      nombre,
      label: a.ok ? a.titulo : `${a.titulo} (falló)`,
      timestamp: a.creado,
      negocios: negocio(nombres, a.ws),
      persona,
      monto: null,
      veces: null,
      falla: !a.ok,
      negativo: !a.ok,
      resumen: [CANAL[a.canal] ?? a.canal, a.ok ? null : 'No salió'].filter(Boolean).join(' · '),
      campos: [
        { label: 'Operación', valor: a.operacion, mono: true, copiar: true },
        ...(a.area ? [{ label: 'Área', valor: a.area }] : []),
        { label: 'Canal', valor: a.canal },
        { label: 'Tipo', valor: a.tipo },
        { label: 'Resultado', valor: a.ok ? 'Salió bien' : 'Falló' },
        ...(persona ? [{ label: 'Persona', valor: persona }] : []),
      ],
      secciones: [],
    })
  })
}

/** Los errores de la app, uno por huella (el último que pasó manda la hora). */
export function eventosDeErrores(errores: readonly FilaError[], nombres: Readonly<Record<number, string>>, ahoraMs: number): EventoAdmin[] {
  return errores.map((f) => {
    const estado = estadoDeError(f, ahoraMs)
    const secciones: SeccionEvento[] = []
    if (f.mensaje) secciones.push({ titulo: 'Mensaje', lineas: [f.mensaje] })
    if (f.stack) secciones.push({ titulo: 'Stack', lineas: f.stack.split('\n'), mono: true })
    return conTexto({
      id: `error:${f.id}`,
      nombre: 'error',
      label: f.titulo || 'Error sin título',
      timestamp: f.ultimaVez,
      negocios: f.negocios.map((ws) => ({ ws, nombre: nombreDe(nombres, ws) })),
      persona: null,
      monto: null,
      veces: f.veces,
      falla: true,
      negativo: true,
      resumen: [ORIGEN[f.origen] ?? f.origen, f.veces === 1 ? '1 vez' : `${f.veces} veces`].join(' · '),
      campos: [
        { label: 'Estado', valor: ROTULO_ESTADO_ERROR[estado].rotulo },
        { label: 'Origen', valor: f.origen },
        { label: 'Veces', valor: String(f.veces) },
        { label: 'Primera vez', valor: f.primeraVez, fecha: true },
        { label: 'Última vez', valor: f.ultimaVez, fecha: true },
        ...(f.ruta ? [{ label: 'Pantalla', valor: f.ruta, mono: true }] : []),
        ...(f.navegador ? [{ label: 'Navegador', valor: f.navegador }] : []),
        { label: 'Personas', valor: String(f.personas) },
        ...(f.ticketId != null ? [{ label: 'Ticket', valor: `#${f.ticketId}${f.ticketEstado ? ` · ${f.ticketEstado}` : ''}` }] : []),
      ],
      secciones,
    })
  })
}

/** Lo que reportó una persona (un ticket). */
export function eventosDeReportes(reportes: readonly Reporte[], nombres: Readonly<Record<number, string>>): EventoAdmin[] {
  return reportes.map((r) => conTexto({
    id: `reporte:${r.id}`,
    nombre: 'reporte',
    label: r.titulo || 'Reporte sin título',
    timestamp: r.creado,
    negocios: negocio(nombres, r.ws),
    persona: r.quien || null,
    monto: null,
    veces: null,
    falla: false,
    resumen: `Ticket #${r.id}`,
    campos: [
      { label: 'Ticket', valor: `#${r.id}` },
      { label: 'Tipo', valor: r.tipo || '—' },
      { label: 'Estado', valor: r.estado || '—' },
      { label: 'Prioridad', valor: r.prioridad || '—' },
      { label: 'Canal', valor: r.canal || '—' },
      ...(r.quien ? [{ label: 'Quién', valor: r.quien }] : []),
    ],
    secciones: [],
  }))
}

/** Cuántos mensajes de una sesión del agente se muestran, y hasta dónde cada uno (como la pantalla vieja de Agents). */
export const MENSAJES_SESION = 6
export const LARGO_MENSAJE = 240

/** Cada sesión del Claude Code de un cliente: en qué trabajó. */
export function eventosDeSesiones(sesiones: readonly SesionAgente[], nombres: Readonly<Record<number, string>>): EventoAdmin[] {
  return sesiones.map((s) => {
    const turnos = s.turnos ?? []
    const secciones: SeccionEvento[] = []
    if (s.acta?.resumen) secciones.push({ titulo: 'Resumen', lineas: [s.acta.resumen] })
    if (turnos.length) {
      const lineas = turnos.slice(0, MENSAJES_SESION).map((t) => (t.texto.length > LARGO_MENSAJE ? `${cortarSinPartir(t.texto, LARGO_MENSAJE)}…` : t.texto))
      if (turnos.length > MENSAJES_SESION) lineas.push(`y ${turnos.length - MENSAJES_SESION} mensajes más`)
      secciones.push({ titulo: 'Mensajes del cliente', lineas })
    }
    return conTexto({
      id: `agente:${s.id}`,
      nombre: 'agente',
      label: s.acta?.titulo || 'Sesión de Claude Code',
      timestamp: s.empezo_en ?? s.created_at,
      negocios: negocio(nombres, s.workspace_id),
      persona: null,
      monto: null,
      veces: null,
      falla: false,
      campos: [
        { label: 'Empezó', valor: s.empezo_en ?? s.created_at, fecha: true },
        ...(s.termino_en ? [{ label: 'Terminó', valor: s.termino_en, fecha: true }] : []),
        { label: 'Mensajes', valor: String(turnos.length) },
        ...(typeof s.acta?.herramientas === 'number' ? [{ label: 'Herramientas', valor: String(s.acta.herramientas) }] : []),
        // La alarma de la pantalla vieja: si sube, el filtro de «sólo turnos humanos» está dejando pasar cosas.
        { label: 'Redacciones', valor: String(s.redacciones ?? 0) },
        { label: 'Sesión', valor: s.sesion_id, mono: true, copiar: true },
      ],
      secciones,
    })
  })
}

const masViejo = (fechas: Iterable<string>): string | null => {
  let m: string | null = null
  for (const f of fechas) if (m == null || f < m) m = f
  return m
}
const masViejoDe = (eventos: readonly EventoAdmin[]) => masViejo(eventos.map((e) => e.timestamp))

/**
 * Lo que se leyó A FONDO de un negocio del filtro (sus últimas acciones y reportes, no sólo los que entraron entre los de
 * todos). `null` = esa lectura falló (su aviso va en `avisos` y quedan los de la lectura de todos).
 */
export type LecturaAFondo = { ws: number; acciones: readonly AccionMako[] | null; reportes: readonly Reporte[] | null }

/** Lo que leyó cada lector (null = no se pudo leer: su aviso va en `avisos`). */
export type EntradasEventos = {
  /** Los pedidos de Admin › Sales (`vistaOrders`). */
  pedidos: readonly PedidoEvento[] | null
  /** Los movimientos de lo que paga por mes cada cliente, y los clientes (para ir de la clave al negocio). */
  ingresos: { movimientos: readonly MovimientoEvento[]; clientes: ReadonlyArray<{ clave: string; ws: number | null; nombre: string }> } | null
  altas: readonly AltaEvento[] | null
  actividad: {
    acciones: readonly AccionMako[]
    nombres: Readonly<Record<number, string>>
    personas: ReadonlyArray<Pick<Persona, 'id' | 'nombre' | 'email'>>
    medido: boolean
  } | null
  errores: { errores: readonly FilaError[]; hayMas: boolean; reportes: readonly Reporte[]; nombres: Readonly<Record<number, string>> } | null
  agente: { sesiones: readonly SesionAgente[]; nombres: Readonly<Record<number, string>> } | null
  /** Los negocios del filtro, leídos a fondo. Sus acciones y reportes REEMPLAZAN a los suyos de la lectura de todos. */
  aFondo?: readonly LecturaAFondo[]
  avisos: string[]
  ahora: Date
  /** Los topes de cada lector (para decir qué quedó afuera). */
  topes: { acciones: number; reportes: number; sesiones: number; accionesDeUnNegocio: number; reportesDeUnNegocio: number }
}

export function armarEventos(e: EntradasEventos): VistaEventos {
  const avisos = [...e.avisos]
  const cortes: CorteFuente[] = []
  const eventos: EventoAdmin[] = []
  // Un nombre por negocio, de todos los lectores (las altas los traen a todos).
  const nombres: Record<number, string> = {
    ...Object.fromEntries((e.altas ?? []).map((a) => [a.ws, a.nombre])),
    ...e.agente?.nombres, ...e.errores?.nombres, ...e.actividad?.nombres,
  }
  const fondo = e.aFondo ?? []
  const accionesAFondo = new Map(fondo.flatMap((f) => (f.acciones ? [[f.ws, f.acciones] as const] : [])))
  const reportesAFondo = new Map(fondo.flatMap((f) => (f.reportes ? [[f.ws, f.reportes] as const] : [])))

  if (e.pedidos) eventos.push(...eventosDePedidos(e.pedidos))
  if (e.ingresos) eventos.push(...eventosDeSuscripciones(e.ingresos.movimientos, e.ingresos.clientes))
  if (e.altas) eventos.push(...eventosDeAltas(e.altas))

  if (e.actividad && !e.actividad.medido) avisos.push('Lo que hace MaKo todavía no se mide (falta la migración 0398).')
  const deTodos = e.actividad?.acciones ?? []
  const desdeTodos = masViejo(deTodos.map((a) => a.creado))
  if (desdeTodos && deTodos.length >= e.topes.acciones) {
    cortes.push({ nombre: 'mako', desde: desdeTodos, tope: e.topes.acciones, salvo: [...accionesAFondo.keys()] })
  }
  const acciones = [...deTodos.filter((a) => a.ws == null || !accionesAFondo.has(a.ws)), ...[...accionesAFondo.values()].flat()]
  if (e.actividad || accionesAFondo.size) eventos.push(...eventosDeAcciones(acciones, nombres, e.actividad?.personas ?? []))
  for (const [ws, l] of accionesAFondo) {
    const desde = masViejo(l.map((a) => a.creado))
    if (desde && l.length >= e.topes.accionesDeUnNegocio) cortes.push({ nombre: 'mako', desde, tope: e.topes.accionesDeUnNegocio, negocio: { ws, nombre: nombreDe(nombres, ws) } })
  }

  if (e.errores) {
    const errores = eventosDeErrores(e.errores.errores, nombres, e.ahora.getTime())
    eventos.push(...errores)
    const dErr = masViejoDe(errores)
    if (dErr && e.errores.hayMas) cortes.push({ nombre: 'error', desde: dErr, tope: e.errores.errores.length })
  }
  const reportesDeTodos = e.errores?.reportes ?? []
  const dRep = masViejo(reportesDeTodos.map((r) => r.creado))
  if (dRep && reportesDeTodos.length >= e.topes.reportes) {
    cortes.push({ nombre: 'reporte', desde: dRep, tope: e.topes.reportes, salvo: [...reportesAFondo.keys()] })
  }
  const reportes = [...reportesDeTodos.filter((r) => !reportesAFondo.has(r.ws)), ...[...reportesAFondo.values()].flat()]
  eventos.push(...eventosDeReportes(reportes, nombres))
  for (const [ws, l] of reportesAFondo) {
    const desde = masViejo(l.map((r) => r.creado))
    if (desde && l.length >= e.topes.reportesDeUnNegocio) cortes.push({ nombre: 'reporte', desde, tope: e.topes.reportesDeUnNegocio, negocio: { ws, nombre: nombreDe(nombres, ws) } })
  }

  if (e.agente) {
    const sesiones = eventosDeSesiones(e.agente.sesiones, nombres)
    eventos.push(...sesiones)
    const desde = masViejoDe(sesiones)
    if (desde && e.agente.sesiones.length >= e.topes.sesiones) cortes.push({ nombre: 'agente', desde, tope: e.topes.sesiones })
  }
  const vistos = new Map<number, NegocioEvento>()
  for (const ev of eventos) for (const n of ev.negocios) if (!vistos.has(n.ws)) vistos.set(n.ws, n)
  return {
    eventos,
    negocios: [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    cortes,
    avisos,
    earliest: masViejoDe(eventos) ?? e.ahora.toISOString(),
  }
}

// ── Lo que hace la pantalla con la lista (lo que en Polar hace su API) ────────────────────────────────────────────────

export type Orden = '-timestamp' | 'timestamp'

export type FiltrosEventos = {
  desde: Date
  hasta: Date
  nombres?: readonly string[] | null
  negocios?: readonly number[] | null
  /** El texto buscado (Polar lo usa desde 3 letras). */
  query?: string | null
  orden?: Orden
}

const enRango = (e: EventoAdmin, desde: Date, hasta: Date) => {
  const t = Date.parse(e.timestamp)
  return t >= desde.getTime() && t <= hasta.getTime()
}

/** Los eventos que pasan los filtros, en el orden pedido (el más nuevo primero, por default). */
export function filtrarEventos(eventos: readonly EventoAdmin[], f: FiltrosEventos): EventoAdmin[] {
  const nombres = f.nombres && f.nombres.length ? new Set(f.nombres) : null
  const negocios = f.negocios && f.negocios.length ? new Set(f.negocios) : null
  const q = f.query && f.query.trim().length >= 3 ? normalizar(f.query.trim()) : null
  const out = eventos.filter((e) =>
    enRango(e, f.desde, f.hasta)
    && (!nombres || nombres.has(e.nombre))
    && (!negocios || e.negocios.some((n) => negocios.has(n.ws)))
    && (!q || e.texto.includes(q)))
  const signo = f.orden === 'timestamp' ? 1 : -1
  return out.sort((a, b) => (a.timestamp < b.timestamp ? -signo : a.timestamp > b.timestamp ? signo : a.id.localeCompare(b.id)))
}

/** Un tipo con cuántos eventos tiene (el `EventTypeWithStats` de Polar). */
export type TipoConConteo = { name: NombreEvento; label: string; occurrences: number }

/** Cuántos eventos de cada tipo pasan los OTROS filtros (para la lista de tipos de la barra). Sólo los que tienen alguno. */
export function conteoPorTipo(eventos: readonly EventoAdmin[], f: Omit<FiltrosEventos, 'nombres'>): TipoConConteo[] {
  const cuenta = new Map<NombreEvento, number>()
  for (const e of filtrarEventos(eventos, { ...f, nombres: null })) cuenta.set(e.nombre, (cuenta.get(e.nombre) ?? 0) + 1)
  return NOMBRES_EVENTO.filter((n) => cuenta.has(n))
    .map((n) => ({ name: n, label: TIPOS_EVENTO[n].label, occurrences: cuenta.get(n)! }))
    .sort((a, b) => b.occurrences - a.occurrences || TIPOS_EVENTO[a.name].orden - TIPOS_EVENTO[b.name].orden)
}

const MIN = 60_000
const HORA = 60 * MIN
const DIA = 24 * HORA
/** Los anchos de barra que se prueban, del más fino al más grueso. */
const ANCHOS = [MIN, 5 * MIN, 15 * MIN, 30 * MIN, HORA, 3 * HORA, 6 * HORA, 12 * HORA, DIA, 7 * DIA, 30 * DIA]
/** Cuántas barras como mucho (el histograma de Polar dibuja del orden de cien). */
export const MAX_BARRAS = 100

export type Cubeta = { start: Date; end: Date; count: number }

/** Las barras del histograma (lo que Polar pide a `/v1/events/histogram`): el ancho más fino que entra en `MAX_BARRAS`. */
export function cubetas(eventos: readonly EventoAdmin[], desde: Date, hasta: Date): Cubeta[] {
  const ini = desde.getTime()
  const fin = hasta.getTime()
  if (!(fin > ini)) return []
  const ancho = ANCHOS.find((a) => Math.ceil((fin - ini) / a) <= MAX_BARRAS) ?? Math.ceil((fin - ini) / MAX_BARRAS)
  const n = Math.ceil((fin - ini) / ancho)
  const out: Cubeta[] = Array.from({ length: n }, (_, i) => ({
    start: new Date(ini + i * ancho),
    end: new Date(Math.min(fin, ini + (i + 1) * ancho)),
    count: 0,
  }))
  for (const e of eventos) {
    const t = Date.parse(e.timestamp)
    if (t < ini || t > fin) continue
    out[Math.min(n - 1, Math.floor((t - ini) / ancho))].count += 1
  }
  return out
}

/**
 * Los cortes que tocan una lista que arranca en `desde`, con el filtro de negocios de la pantalla: los lectores que no
 * llegan tan atrás. El de todos no vale si TODOS los negocios del filtro se leyeron a fondo (`salvo`); el de un negocio
 * leído a fondo, sólo si ese negocio está en el filtro.
 */
export function cortesVisibles(cortes: readonly CorteFuente[], desde: Date, negocios?: readonly number[] | null): CorteFuente[] {
  const filtro = negocios && negocios.length ? negocios : null
  return cortes.filter((c) => {
    if (!(desde.getTime() < Date.parse(c.desde))) return false
    if (c.negocio) return filtro != null && filtro.includes(c.negocio.ws)
    return !(filtro && filtro.every((ws) => c.salvo?.includes(ws)))
  })
}

/** Lo que dice un corte, en una línea (`fecha` formatea el día en la zona de quien mira). */
export function textoDeCorte(c: CorteFuente, fecha: (iso: string) => string): string {
  const que: Record<NombreEvento, string> = {
    pago: 'pagos', devolucion: 'devoluciones', suscripcion: 'cambios de suscripción', alta: 'altas', mako: 'acciones de MaKo',
    lectura: 'lecturas de MaKo', error: 'errores', reporte: 'reportes', agente: 'sesiones del agente',
  }
  return c.negocio
    ? `Antes del ${fecha(c.desde)} faltan ${que[c.nombre]} de ${c.negocio.nombre}: se leen los ${c.tope} más recientes de ese negocio.`
    : `Antes del ${fecha(c.desde)} faltan ${que[c.nombre]}: se leen los ${c.tope} más recientes.`
}

// ── El Timeline de la ficha de un negocio (components/Customer/CustomerTimeline de Polar) ───────────────────────────────

/** Lo que dibuja el Timeline de un evento (ni sus campos, ni sus secciones, ni el texto de buscar: no viajan). */
export type EventoDeTimeline = Pick<EventoAdmin, 'id' | 'nombre' | 'label' | 'timestamp' | 'soloDia' | 'resumen' | 'href' | 'negativo' | 'importancia'> & {
  source: FuenteEvento
}

/** Cuántos muestra el Timeline (el `limit={20}` de Polar). */
export const LIMITE_TIMELINE = 20

/**
 * Los últimos eventos de un negocio para su Timeline (lo que Polar pide a /v1/events con `customer_id` y `limit: 20`): los
 * mismos de Analytics › Events, filtrados por él, el más nuevo primero. Viajan los `limite` más recientes de cada vista del
 * Timeline («Sistema» y «Todos»), no la lista entera.
 */
export function timelineDelNegocio(eventos: readonly EventoAdmin[], ws: number, limite = LIMITE_TIMELINE): EventoDeTimeline[] {
  const delNegocio = filtrarEventos(eventos, { desde: new Date(-8.64e15), hasta: new Date(8.64e15), negocios: [ws] })
  const sistema = delNegocio.filter((e) => TIPOS_EVENTO[e.nombre].source === 'system').slice(0, limite)
  const van = new Set([...delNegocio.slice(0, limite), ...sistema].map((e) => e.id))
  return delNegocio.filter((e) => van.has(e.id)).map((e) => ({
    id: e.id, nombre: e.nombre, label: e.label, timestamp: e.timestamp, soloDia: e.soloDia, resumen: e.resumen, href: e.href,
    negativo: e.negativo, importancia: e.importancia, source: TIPOS_EVENTO[e.nombre].source,
  }))
}

/** El pliegue del Timeline de Polar (`buildSegments`): los eventos de importancia baja seguidos van juntos, plegados. */
export type SegmentoTimeline<T> = { type: 'event'; evento: T } | { type: 'fold'; eventos: T[] }
export function segmentosDeTimeline<T extends { importancia: ImportanciaEvento }>(eventos: readonly T[]): SegmentoTimeline<T>[] {
  const out: SegmentoTimeline<T>[] = []
  let buffer: T[] = []
  const flush = () => {
    if (buffer.length >= 1) out.push({ type: 'fold', eventos: buffer })
    buffer = []
  }
  for (const e of eventos) {
    if (e.importancia === 'low') buffer.push(e)
    else {
      flush()
      out.push({ type: 'event', evento: e })
    }
  }
  flush()
  return out
}

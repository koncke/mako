// =============================================================================
// Admin › Customers › <negocio>: la ficha de UN negocio, con las subpáginas de Polar (Overview · Usage · Members, y Events) (6/11/2026)
// =============================================================================
// Polar (polarsource/polar, Apache-2.0) arma la ficha de un Customer en …/(header)/customers/[customerId]/ con los componentes de
// clients/apps/web/src/components/Customer/CustomerPage/. En MaKo un Customer es un NEGOCIO (un workspace), y la URL es
// /admin/customers/<ws>. Lo que Polar pide por un hook en el navegador, acá lo lee el server
// (app/admin/_polar/datos/cliente-server.ts) y estas funciones PURAS lo convierten en las props de cada vista.
//
// DE DÓNDE SALE CADA DATO:
//   · la cabecera y el «Alta» (plan, estado, onboarding, prueba, plan a mano, agencia): `getWorkspace` y la fila del negocio de
//     `vistaDeClientes()` (lib/clientes-plataforma.ts), la misma que dibuja la lista de la izquierda;
//   · Metrics, Subscriptions y Orders: los pedidos y las suscripciones de Admin › Sales, los del negocio. Sin gráfico de
//     ingresos y sin lo que paga por mes (Martín, 6/11/2026: nada de ingreso mensual en Customers): sólo las cifras de Polar
//     que MaKo llena, lo pagado y los pedidos del rango; y Costs, Profit y Profit Margin del mes sólo si su gasto de IA es
//     atribuible, con LA regla de Cost Drivers (`costoDelNegocio`, ./clientes.ts);
//   · las Conexiones: `integracionConectada` de cada servicio de /metodo y las computadoras (lib/ia-pc.ts `listarPcDelNegocio`);
//   · Usage: `actividad_uso` (lib/actividad.ts, el día y la tab de cada uno) y las llamadas de IA anotadas en ese negocio
//     (`anthropic_usage` con su `workspace_id`), sin plata: lo que costaron va en Overview, sólo si es atribuible;
//   · Events NO es de la ficha: es Admin › Analytics › Events filtrado por el negocio (`rutaDeEventosDelNegocio`, como Polar), y
//     el Timeline del Overview son sus últimos eventos de ahí (app/admin/_polar/datos/eventos.ts `timelineDelNegocio`): una sola
//     definición de «un evento del negocio» (6/11/2026);
//   · Members: sus personas (`usuarios` con ese `workspace_id`). Es el ÚNICO lugar de Admin donde se ven y se gestionan.
//
// ⚠️ PURO: sin `server-only`. Lo usan el navegador (el rango, el uso, el formulario) y
//    tests/admin-polar-cliente.test.ts. De los módulos del server, sólo `import type`.
// =============================================================================

import type { CapaId } from '@/lib/capas'
import { CAPAS_VENDIBLES } from '@/lib/capas'
import { nombreDePlan } from '@/lib/clientes-plataforma-reglas'
import { DIAS_PLAN_A_MANO, rotuloDeDias } from '@/lib/plan-a-mano-reglas'
import type { FilaUso } from '@/lib/actividad-reglas'
import type { RolWorkspace } from '@/lib/auth-session'
import { aCentavos } from './metricas'
import type { TimeInterval } from './polar-tipos'
import { totalesDePedidos, type Pedido, type SuscripcionVenta } from './ventas'
import type { CostoDelNegocio } from './clientes'

export { aCentavos }

/** La ficha y sus subpáginas (la ruta de Customers la define app/admin/_polar/datos/clientes.ts). */
export const rutaDeFicha = (ws: number, sub?: 'usage' | 'members') => `/admin/customers/${ws}${sub ? `/${sub}` : ''}`

/**
 * «Events» de un negocio: Analytics › Events filtrado por él, desde siempre (`buildCustomerEventsPath` de Polar,
 * clients/apps/web/src/utils/event.ts: `/analytics/events?customerIds=<id>&range=allTime`). La ficha NO tiene una lista de
 * eventos propia: es la misma pantalla, con la misma definición de evento (app/admin/_polar/datos/eventos.ts). La usan la
 * subnav de la ficha, el «Ver todos» del Timeline y la vieja /admin/customers/<ws>/events, que redirige acá.
 */
export const rutaDeEventosDelNegocio = (ws: number) =>
  `/admin/analytics/events?${new URLSearchParams({ customerIds: String(ws), range: 'allTime' })}`

/**
 * El detalle de un pago y de una suscripción, en Admin › Sales (sus ids los define app/admin/_polar/datos/ventas.ts:
 * `p-<pago>`, `c-<cobro>`, `r-<recibo>` y `l-<lead>`, `c-<cobro>`). Polar: /sales/<id> y /sales/subscriptions/<id>.
 */
export const rutaDePedido = (p: Pick<Pedido, 'id'>) => `/admin/sales/${p.id}`
export const rutaDeSuscripcion = (s: Pick<SuscripcionVenta, 'id'>) => `/admin/sales/subscriptions/${s.id}`

/** El id del negocio que viaja en el path. `null` = no es un id (la página contesta 404). Nunca `?ws=`. */
export function wsDeId(id: string | null | undefined): number | null {
  const s = String(id ?? '')
  if (!/^[1-9]\d{0,11}$/.test(s)) return null
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : null
}

// ── La cabecera (CustomerPageShell + CustomerHeader) ───────────────────────────────────────────────────────────────

export type NegocioCabecera = {
  ws: number
  nombre: string
  /** El plan como lo vende MaKo («MaKo Pro»). */
  plan: string
  capa: CapaId
  estado: 'activo' | 'pausado'
  /** El email de quien administra su cuenta, para «Contactar» (el mailto de Polar). `null` = no tiene un admin activo. */
  contacto: string | null
  /** Su plan a mano, ya dicho («Gratis hasta el 1 de mayo de 2027»). `null` = no tiene (o no se pudo leer). */
  planAMano: string | null
}

// ── Overview › Metrics, Subscriptions y Orders (CustomerMetricsOverview, sin los gráficos, y sus dos tablas) ────────
// Los pedidos y las suscripciones son los de Admin › Sales (`vistaOrders`, `vistaSuscripciones`: app/admin/_polar/datos/
// ventas-server.ts), los del negocio: el mismo estado (devuelto, anulado, atrasada), los mismos ids y el mismo detalle. Una tabla
// propia acá sería la segunda cuenta de lo mismo.

/** Los pedidos de un negocio (los de su cuenta, `cliente.ws`), el más nuevo primero. */
export function pedidosDelNegocio(pedidos: readonly Pedido[], ws: number): Pedido[] {
  return pedidos.filter((p) => p.cliente?.ws === ws).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.id.localeCompare(a.id)))
}

/** Las suscripciones de un negocio, las vivas primero (atrasadas, activas, cortadas). */
export function suscripcionesDelNegocio(subs: readonly SuscripcionVenta[], ws: number): SuscripcionVenta[] {
  const peso: Record<SuscripcionVenta['estado'], number> = { past_due: 0, active: 1, canceled: 2 }
  return subs.filter((s) => s.cliente.ws === ws).sort((a, b) => peso[a.estado] - peso[b.estado] || String(b.empezo ?? '').localeCompare(String(a.empezo ?? '')))
}

export type CifrasNegocio = {
  /** Lo que pagó en el rango, en CENTAVOS (como lo dibuja Polar). Lo devuelto no suma (`totalesDePedidos` de Sales). */
  revenue: number
  /** Cuántos pedidos hubo en el rango. */
  orders: number
  /** Pedidos del rango sin su valor en dólares (no suman). */
  sinDolares: number
}

/**
 * Las cifras de las cajas de Metrics: lo pagado y los pedidos en el rango (días YYYY-MM-DD, los dos incluidos). ⛔ Sin lo que
 * paga por mes (revisión del 6/11/2026): era «ingreso mensual en Customers», uno de los motivos del rechazo, y Polar no lo tiene
 * en la ficha (Revenue, Costs, Profit, Profit Margin, Orders). Vive en Overview y en Analytics › Metrics.
 */
export function cifrasDelRango(pedidos: readonly Pedido[], desde: string, hasta: string): CifrasNegocio {
  const t = totalesDePedidos(pedidos.filter((p) => p.fecha >= desde && p.fecha <= hasta))
  return { revenue: t.revenue, orders: t.orders, sinDolares: t.sinDolares }
}

/**
 * Costs, Profit y Profit Margin del negocio (las cajas de Polar), del MES del gasto de IA: lo que pagó ese mes contra lo que MaKo
 * gastó en IA por él, con `costoDelNegocio` (./clientes.ts), la regla de Cost Drivers. `null` = no hay un costo que decir (el
 * gasto de ese mes no es atribuible por negocio, o no se pudo leer): las tres cajas no se dibujan. No siguen al rango de las de
 * arriba: el gasto se mide por mes (como Cost Drivers), y por eso su título lleva el mes.
 */
export type CifrasDeCosto = {
  /** 'YYYY-MM'. */
  periodo: string
  /** Lo que pagó ese mes, en centavos. */
  revenue: number
  /** Lo que MaKo gastó en IA por él ese mes, en centavos (con decimales: es un gasto de centavos). */
  costs: number
  /** `revenue − costs`, en centavos. */
  profit: number
  /** `profit / revenue`, de 0 a 1 (`null` si no pagó nada ese mes). */
  margen: number | null
}

const ultimoDiaDelMes = (mes: string) => {
  const [y, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export function cifrasDeCosto(pedidos: readonly Pedido[], costo: CostoDelNegocio | null): CifrasDeCosto | null {
  if (!costo || !costo.atribuible || !/^\d{4}-\d{2}$/.test(costo.periodo)) return null
  const revenue = totalesDePedidos(pedidos.filter((p) => p.fecha >= `${costo.periodo}-01` && p.fecha <= ultimoDiaDelMes(costo.periodo))).revenue
  const costs = costo.costoCentavos
  const profit = revenue - costs
  return { periodo: costo.periodo, revenue, costs, profit, margen: revenue > 0 ? profit / revenue : null }
}

// ── Overview › Details (CustomerDetailsSection): su identidad, su alta y sus conexiones ───────────────────────────

export type AltaNegocio = {
  /** ISO: cuándo se dio de alta. */
  creado: string
  plan: string
  estado: 'activo' | 'pausado'
  /** `null` = no se pudo leer (no es «no lo terminó»). */
  onboardingHecho: boolean | null
  /** Está en su prueba con tarjeta (un cobro de prueba vivo). */
  prueba: boolean | null
  planAMano: string | null
  /** Partner, Agency, Cliente, Cliente de agencia (lib/clientes-plataforma-reglas.ts `ROTULO_SEGMENTO`). */
  segmentos: string[]
  /** El nombre de la agencia que lo lleva, si es cliente de una. */
  agencia: string | null
}

export type ConexionNegocio = { key: string; nombre: string; conectada: boolean }

/**
 * Una computadora conectada del negocio. ⛔ Sin la persona que la conectó (revisión del 6/11/2026): las personas viven en UN lugar,
 * Members; acá va la computadora (su nombre, su sistema y si está en línea).
 */
export type ComputadoraNegocio = {
  id: number
  nombre: string
  sistema: 'Windows' | 'Mac' | null
  enLinea: boolean
  conectadaAt: string | null
}

/**
 * Las computadoras de la ficha: `'oculto'` si quien mira no pasa la guarda del Centro (`puedeOperar`, lib/operaciones-reglas.ts:
 * el super admin en el workspace de la plataforma, con su sesión y su segundo factor); `null` si no se pudieron leer (no es «no
 * tiene»); si no, la lista. La ficha vieja (app/admin/ComputadorasDelNegocio.tsx) las mostraba sólo con esa guarda, y la copia de
 * Polar la había perdido (las veía cualquier super admin).
 */
export type ComputadorasDeLaFicha = 'oculto' | ComputadoraNegocio[] | null

/**
 * Lo que viaja a la pantalla: sin la guarda, NADA (ni la lista ni que existe); con ella, sólo lo que se dibuja (ni un token, ni sus
 * cuentas, ni la ubicación, ni la persona: ésa vive en Members). `pcs` es lo que leyó el server (`listarPcDelNegocio`), `null` si falló; sin la guarda no se lee.
 */
export function computadorasDeLaFicha(
  opera: boolean,
  pcs: ReadonlyArray<Pick<ComputadoraNegocio, 'id' | 'nombre' | 'sistema' | 'enLinea' | 'conectadaAt'>> | null,
): ComputadorasDeLaFicha {
  if (!opera) return 'oculto'
  return pcs?.map((pc) => ({ id: pc.id, nombre: pc.nombre, sistema: pc.sistema, enLinea: pc.enLinea, conectadaAt: pc.conectadaAt })) ?? null
}

/** Las conexiones que muestra la sección: las conectadas primero, y sin las que no están (Polar no lista lo vacío). */
export function conexionesConectadas(conexiones: readonly ConexionNegocio[]): ConexionNegocio[] {
  return conexiones.filter((c) => c.conectada).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

// ── Usage (CustomerUsageView): las tabs que usa, las que no, y la IA ───────────────────────────────────────────────

const COLORES = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#9333ea', '#0891b2', '#ea580c', '#db2777']

/** Un «medidor» de Polar: una tab de MaKo (lo que se abrió y se hizo) o la IA (las llamadas). */
export type MedidorUso = {
  key: string
  nombre: string
  color: string
  /** En qué se cuenta lo consumido. */
  unidad: 'pantallas' | 'llamadas'
  consumido: number
  /** Las acciones hechas en la tab (la IA no tiene). */
  acciones: number | null
  /** Cuántas personas distintas la usaron (la IA no se mide por persona). */
  personas: number | null
  /** El último día con uso (YYYY-MM-DD). */
  ultimo: string | null
}

/**
 * Las llamadas de IA del negocio, sumadas por día (de `anthropic_usage` con su `workspace_id`). ⛔ Sin plata (revisión del
 * 6/11/2026): lo que cuestan sólo se dice si el gasto es atribuible por negocio, con la regla de Cost Drivers, y eso va en el
 * Overview de la ficha (`cifrasDeCosto`), no acá.
 */
export type IaDelDia = { dia: string; llamadas: number }

export type UsoDelNegocio = {
  medidores: MedidorUso[]
  /** Las tabs de los negocios que nadie de este abrió en el rango («lo que no usa»). */
  sinUso: Array<{ key: string; label: string }>
  /** El gráfico apilado de Polar: un punto por intervalo, una serie por tab (sin la IA, que se cuenta en otra unidad). */
  serie: Array<Record<string, number | string>>
  series: Array<{ key: string; label: string; color: string }>
}

/** El primer día del intervalo de `dia` (YYYY-MM-DD → ISO del inicio, a medianoche UTC). */
export function cubetaDe(dia: string, intervalo: TimeInterval): string {
  const d = new Date(`${dia}T00:00:00Z`)
  if (intervalo === 'week') d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  else if (intervalo === 'month') d.setUTCDate(1)
  else if (intervalo === 'year') d.setUTCMonth(0, 1)
  return d.toISOString()
}

/** El principio del intervalo que sigue al de `cubeta` (un ISO de `cubetaDe`). La hora se cuenta como el día: el uso se anota por día. */
function siguienteCubeta(cubeta: string, intervalo: TimeInterval): string {
  const d = new Date(cubeta)
  if (intervalo === 'week') d.setUTCDate(d.getUTCDate() + 7)
  else if (intervalo === 'month') d.setUTCMonth(d.getUTCMonth() + 1, 1)
  else if (intervalo === 'year') d.setUTCFullYear(d.getUTCFullYear() + 1, 0, 1)
  else d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString()
}

/** Tope de períodos del gráfico (un rango de años por día serían miles de barras). */
const TOPE_CUBETAS = 400

/**
 * Los períodos del gráfico, de `desde` a `hasta` (YYYY-MM-DD), uno por intervalo, TODOS: también los que no tuvieron uso, como
 * la serie de Polar (un punto por período, en cero si no hubo nada). Con sólo los períodos con uso, un rango de meses se dibujaba
 * como una barra suelta (6/11/2026). Vacío si `desde` es posterior a `hasta`.
 */
export function cubetasDelRango(desde: string, hasta: string, intervalo: TimeInterval): string[] {
  const out: string[] = []
  if (desde > hasta) return out
  const fin = cubetaDe(hasta, intervalo)
  for (let c = cubetaDe(desde, intervalo); c <= fin && out.length < TOPE_CUBETAS; c = siguienteCubeta(c, intervalo)) out.push(c)
  return out
}

/**
 * Lo que usó el negocio entre `desde` y `hasta` (YYYY-MM-DD, incluidos): una fila por tab con uso, la IA si tuvo llamadas, las
 * tabs que no abrió nadie, y la serie del gráfico. `tabs` son las de los negocios (lib/actividad-reglas.ts `tabsDeNegocios`),
 * juntas por su nombre: dos keys que se dibujan igual son una tab.
 * La serie trae un punto por período del rango, desde que se mide (`medidoDesde`, el primer día medido): un período de antes
 * no es un cero, es que no se medía, y no se dibuja.
 */
export function usoDelNegocio(
  filas: ReadonlyArray<Pick<FilaUso, 'dia' | 'usuario' | 'tab' | 'pantallas' | 'acciones'>>,
  tabs: ReadonlyArray<{ key: string; label: string; keys: readonly string[] }>,
  ia: readonly IaDelDia[],
  desde: string,
  hasta: string,
  intervalo: TimeInterval,
  medidoDesde: string | null = null,
): UsoDelNegocio {
  const tabDe = new Map<string, { key: string; label: string }>()
  for (const t of tabs) for (const k of t.keys) tabDe.set(k, { key: t.key, label: t.label })
  const porTab = new Map<string, { nombre: string; pantallas: number; acciones: number; personas: Set<number>; ultimo: string | null }>()
  const cubetas = new Map<string, Record<string, number | string>>()
  for (const f of filas) {
    if (f.dia < desde || f.dia > hasta || (f.pantallas <= 0 && f.acciones <= 0)) continue
    const t = tabDe.get(f.tab) ?? { key: f.tab, label: f.tab === 'otra' ? 'Otras pantallas' : f.tab }
    const m = porTab.get(t.key) ?? { nombre: t.label, pantallas: 0, acciones: 0, personas: new Set<number>(), ultimo: null }
    m.pantallas += f.pantallas
    m.acciones += f.acciones
    m.personas.add(f.usuario)
    if (!m.ultimo || f.dia > m.ultimo) m.ultimo = f.dia
    porTab.set(t.key, m)
    const c = cubetaDe(f.dia, intervalo)
    const punto = cubetas.get(c) ?? { timestamp: c }
    punto[t.key] = (Number(punto[t.key]) || 0) + f.pantallas
    cubetas.set(c, punto)
  }
  const orden = [...porTab.entries()].sort((a, b) => b[1].pantallas + b[1].acciones - (a[1].pantallas + a[1].acciones) || a[1].nombre.localeCompare(b[1].nombre, 'es'))
  const medidores: MedidorUso[] = orden.map(([key, m], i) => ({
    key, nombre: m.nombre, color: COLORES[i % COLORES.length], unidad: 'pantallas', consumido: m.pantallas, acciones: m.acciones,
    personas: m.personas.size, ultimo: m.ultimo,
  }))
  let llamadas = 0
  let ultimoIa: string | null = null
  for (const d of ia) {
    if (d.dia < desde || d.dia > hasta || d.llamadas <= 0) continue
    llamadas += d.llamadas
    if (!ultimoIa || d.dia > ultimoIa) ultimoIa = d.dia
  }
  if (llamadas > 0) {
    medidores.push({ key: 'ia', nombre: 'IA', color: COLORES[medidores.length % COLORES.length], unidad: 'llamadas', consumido: llamadas, acciones: null, personas: null, ultimo: ultimoIa })
  }
  const usadas = new Set(porTab.keys())
  const sinUso = tabs.filter((t) => !usadas.has(t.key)).map(({ key, label }) => ({ key, label }))
  const series = medidores.filter((m) => m.key !== 'ia').map((m) => ({ key: m.key, label: m.nombre, color: m.color }))
  const vacio = (timestamp: string): Record<string, number | string> =>
    Object.fromEntries([['timestamp', timestamp], ...series.map((x) => [x.key, 0])])
  const periodos = series.length === 0 ? [] : cubetasDelRango(medidoDesde && medidoDesde > desde ? medidoDesde : desde, hasta, intervalo)
  for (const c of periodos) cubetas.set(c, { ...vacio(c), ...cubetas.get(c) })
  const serie = [...cubetas.values()].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
  return { medidores, sinUso, serie, series }
}

// ── Members (MembersSection, EditMemberModal) ──────────────────────────────────────────────────────────────────────

export type MiembroNegocio = {
  id: number
  nombre: string
  email: string
  /** Su rol en el negocio. `null` = sin rol (no debería pasar en un usuario-cliente). */
  rol: RolWorkspace | null
  estado: 'invitado' | 'activo' | 'suspendido'
  /** Cuándo se le mandó el mail de acceso. `null` = nunca se le avisó que tiene cuenta. */
  accesoEnviado: string | null
  ultimoIngreso: string | null
  creado: string
  /** Si tiene un segundo factor activo. `null` = no se sabe. */
  mfa: boolean | null
  /** La cara que se dibuja (su foto, o la de su Gravatar). */
  cara: string | null
}

export const ROLES_MIEMBRO: readonly RolWorkspace[] = ['admin', 'closer', 'setter']
export const ROTULO_ROL: Record<RolWorkspace, [string, 'blue' | 'purple' | 'gray']> = {
  admin: ['Admin', 'blue'],
  closer: ['Closer', 'purple'],
  setter: ['Setter', 'gray'],
}
export const ROTULO_ESTADO_MIEMBRO: Record<MiembroNegocio['estado'], [string, 'green' | 'yellow' | 'gray']> = {
  activo: ['Activo', 'green'],
  invitado: ['Invitado', 'yellow'],
  suspendido: ['Suspendido', 'gray'],
}

/** Lo que hace falta de una fila de `usuarios` (lib/usuarios.ts `Usuario`). */
export type UsuarioParaMiembro = {
  id: number; email: string; nombre: string; rol: string; estado: string; ultimo_login: string | null; created_at: string
  workspace_id: number | null; rol_ws: RolWorkspace | null; invitacion_enviada_at: string | null; mfa_activo?: boolean
}

/** Las personas del negocio: sus usuarios-cliente (nunca los admins de MaKo, que cruzan negocios), en el orden de alta. */
export function miembrosDe(usuarios: readonly UsuarioParaMiembro[], ws: number, caraDe?: (u: UsuarioParaMiembro) => string | null): MiembroNegocio[] {
  return usuarios
    .filter((u) => u.rol === 'usuario' && u.workspace_id === ws)
    .map((u): MiembroNegocio => ({
      id: u.id, nombre: u.nombre ?? '', email: u.email, rol: u.rol_ws,
      estado: u.estado === 'activo' ? 'activo' : u.estado === 'suspendido' ? 'suspendido' : 'invitado',
      accesoEnviado: u.invitacion_enviada_at, ultimoIngreso: u.ultimo_login, creado: u.created_at,
      mfa: typeof u.mfa_activo === 'boolean' ? u.mfa_activo : null, cara: caraDe?.(u) ?? null,
    }))
    .sort((a, b) => (a.creado < b.creado ? -1 : a.creado > b.creado ? 1 : a.id - b.id))
}

/** El contacto del negocio (el «Contact Customer» de Polar): el email de su primer admin activo. */
export function contactoDe(miembros: readonly MiembroNegocio[]): string | null {
  return miembros.find((m) => m.rol === 'admin' && m.estado === 'activo')?.email ?? miembros.find((m) => m.rol === 'admin')?.email ?? null
}

/** Lo que se le pide a /api/admin/usuarios por cada acción del menú de un miembro (las mismas que tenía Admin). */
export type AccionMiembro =
  | { action: 'reinvitar'; id: number }
  | { action: 'estado'; id: number; estado: 'activo' | 'suspendido' }
  | { action: 'rolws'; id: number; rol_ws: RolWorkspace }
  | { action: 'nombre'; id: number; nombre: string }

/** «Suspender» o «Reactivar» (el estado contrario al de hoy; un invitado se suspende). */
export const cambioDeEstado = (m: Pick<MiembroNegocio, 'id' | 'estado'>): AccionMiembro =>
  ({ action: 'estado', id: m.id, estado: m.estado === 'suspendido' ? 'activo' : 'suspendido' })

/** Los pedidos del formulario «Editar persona»: sólo lo que cambió, el nombre primero. */
export function cambiosDelMiembro(m: Pick<MiembroNegocio, 'id' | 'nombre' | 'rol'>, form: { nombre: string; rol: RolWorkspace | null }): AccionMiembro[] {
  const out: AccionMiembro[] = []
  const nombre = form.nombre.trim()
  if (nombre && nombre !== m.nombre) out.push({ action: 'nombre', id: m.id, nombre })
  if (form.rol && form.rol !== m.rol) out.push({ action: 'rolws', id: m.id, rol_ws: form.rol })
  return out
}

// ── Editar el negocio (EditCustomerModal) ──────────────────────────────────────────────────────────────────────────

/** Los planes que se pueden poner (nunca `superadmin`: es la identidad de la plataforma). */
export const PLANES_ASIGNABLES: ReadonlyArray<{ capa: CapaId; nombre: string }> = CAPAS_VENDIBLES.map((c) => ({ capa: c.id, nombre: nombreDePlan(c.id) }))

/** El valor de «No cambiarlo» (un select de radix no acepta un valor vacío). */
export const SIN_CAMBIO = 'igual'

/** Las opciones del plan a mano: no tocarlo, los días que se pueden dar y quitarlo (sólo si tiene uno). */
export function opcionesDePlanAMano(tiene: boolean): Array<{ value: string; label: string }> {
  return [
    { value: SIN_CAMBIO, label: 'No cambiarlo' },
    ...DIAS_PLAN_A_MANO.map((d) => ({ value: String(d), label: rotuloDeDias(d) })),
    ...(tiene ? [{ value: '0', label: 'Quitar el plan a mano' }] : []),
  ]
}

export type AccionNegocio =
  | { action: 'nombre'; id: number; nombre: string }
  | { action: 'capa'; id: number; capa: CapaId }
  | { action: 'plan_a_mano'; id: number; dias: number }
  | { action: 'estado'; id: number; estado: 'activo' | 'pausado' }
  | { action: 'eliminar'; id: number; nombre: string }

/** Los pedidos a /api/admin/workspaces de «Guardar»: sólo lo que cambió (nombre, plan, plan a mano), en ese orden. */
export function cambiosDelNegocio(n: Pick<NegocioCabecera, 'ws' | 'nombre' | 'capa'>, form: { nombre: string; capa: string; planAMano: string }): AccionNegocio[] {
  const out: AccionNegocio[] = []
  const nombre = form.nombre.trim()
  if (nombre && nombre !== n.nombre) out.push({ action: 'nombre', id: n.ws, nombre })
  const plan = PLANES_ASIGNABLES.find((p) => p.capa === form.capa)
  if (plan && plan.capa !== n.capa) out.push({ action: 'capa', id: n.ws, capa: plan.capa })
  if (form.planAMano !== SIN_CAMBIO && form.planAMano !== '') {
    const dias = Number(form.planAMano)
    if (dias === 0 || (DIAS_PLAN_A_MANO as readonly number[]).includes(dias)) out.push({ action: 'plan_a_mano', id: n.ws, dias })
  }
  return out
}

const plural = (n: number, s: string) => `${n} ${n === 1 ? s : `${s}s`}`

/**
 * Lo que dice «Eliminar» cuando sale bien: lo que se llevó (la respuesta de /api/admin/workspaces `eliminar`: `borrado` por
 * tabla, `usuarios`, `leadsDesligados`, `avisos`), como lo decía la grilla vieja.
 */
export function resumenDeBorrado(nombre: string, r: Record<string, unknown>): string {
  const borrado = r.borrado && typeof r.borrado === 'object' ? (r.borrado as Record<string, unknown>) : {}
  const filas = Object.values(borrado).reduce<number>((a, b) => a + (Number(b) || 0), 0)
  const tablas = Object.keys(borrado).length
  const usuarios = Number(r.usuarios) || 0
  const leads = Number(r.leadsDesligados) || 0
  const avisos = Array.isArray(r.avisos) ? r.avisos.filter((a): a is string => typeof a === 'string') : []
  return [
    `Se eliminó ${nombre}: ${plural(filas, 'fila')} en ${plural(tablas, 'tabla')}, ${plural(usuarios, 'persona')}`,
    leads ? ` y ${plural(leads, 'lead')} de tu CRM que quedaron sin cuenta` : '',
    '.',
    avisos.length ? ` ${avisos.join(' ')}` : '',
  ].join('')
}

/** «Pausar» o «Reactivar» la cuenta. */
export const cambioDeEstadoNegocio = (n: Pick<NegocioCabecera, 'ws' | 'estado'>): AccionNegocio =>
  ({ action: 'estado', id: n.ws, estado: n.estado === 'pausado' ? 'activo' : 'pausado' })

// ── El rango (useCustomerMetricsParams) ────────────────────────────────────────────────────────────────────────────

/** Los parámetros del rango, que viajan entre las subpáginas (los mismos de Polar). */
export const PARAMS_DEL_RANGO = ['startDate', 'endDate', 'interval'] as const

const DIA_RE = /^\d{4}-\d{2}-\d{2}$/
/** YYYY-MM-DD en la hora local (como `toISODate` de Polar). */
export const diaLocal = (d: Date): string => {
  const o = new Date(d.getTime() - d.getTimezoneOffset() * 60_000)
  return o.toISOString().slice(0, 10)
}
/** Un YYYY-MM-DD válido de la URL, o `null`. */
export const diaDeParam = (v: string | null | undefined): string | null => (v && DIA_RE.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) ? v : null)

/** El principio de la actividad del negocio (`getCustomerActivityStart` de Polar): su alta, o su primer pago si fue antes. */
export function inicioDeActividad(creado: string, pedidos: ReadonlyArray<Pick<Pedido, 'fecha'>>): string {
  const alta = creado.slice(0, 10)
  const primero = pedidos.reduce<string | null>((m, p) => (m == null || p.fecha < m ? p.fecha : m), null)
  return primero && primero < alta ? primero : alta
}

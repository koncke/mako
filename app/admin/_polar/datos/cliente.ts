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
//   · Metrics, Subscriptions y Orders: `vistaDeIngresos()` (lib/admin-ingresos.ts) — sus `entradas` (cada pago, con la clave
//     `ws:<n>` del cliente) y sus `clientes` (lo que paga por mes HOY). Sin gráfico de ingresos (Martín, 6/11/2026: nunca en
//     Customers): sólo las cifras, en las cajas de Polar;
//   · las Conexiones: `integracionConectada` de cada servicio de /metodo y las computadoras (lib/ia-pc.ts `listarPcDelNegocio`);
//   · Usage: `actividad_uso` (lib/actividad.ts, el día y la tab de cada uno) y las llamadas de IA anotadas en ese negocio
//     (`anthropic_usage` con su `workspace_id`);
//   · Events NO es de la ficha: es Admin › Analytics › Events filtrado por el negocio (`rutaDeEventosDelNegocio`, como Polar), y
//     el Timeline del Overview son sus últimos eventos de ahí (app/admin/_polar/datos/eventos.ts `timelineDelNegocio`): una sola
//     definición de «un evento del negocio» (6/11/2026);
//   · Members: sus personas (`usuarios` con ese `workspace_id`). Las de un negocio se ven y se gestionan SÓLO ahí; las de la
//     plataforma (los admins de MaKo, su equipo y quien no tiene negocio), sólo en Settings › Members (`miembrosDePlataforma`,
//     con la misma regla: ./personas.ts);
//   · la cabecera (el plan y cómo está) y «Activity» de Details: la fila de la lista y At Risk (`clientesEnRiesgo`), las
//     mismas cuentas que Customers (punto 27 de la revisión del 6/11/2026).
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
import { avisoCambioPlan, type ResultadoAvisoPlan } from '@/lib/plan-aviso'
import { aCentavos } from './metricas'
import { tipoDePersona, type TipoPersonaPlataforma } from './personas'
import type { TimeInterval } from './polar-tipos'
import { totalesDePedidos, type Pedido, type SuscripcionVenta } from './ventas'

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
  /**
   * Debajo del nombre (punto 27 de la revisión del 6/11/2026): el plan y cómo está, en palabras («MaKo Pro · Atrasado 4 días»,
   * «MaKo Pro · Activo»), con el texto de At Risk si está ahí. Reemplaza al «Negocio #n» (Martín pidió nombres, no códigos: el
   * número queda sólo en la fila ID de Details). Lo arma `estadoDeLaCabecera`.
   */
  estadoTxt: string
  /** Está atrasado o le falló un cobro (el rojo de At Risk): se dice en rojo. */
  grave: boolean
}

/**
 * El plan y cómo está, en palabras (la cabecera de la ficha). `riesgo`: lo que dice At Risk de ESTE negocio (`clientesEnRiesgo`,
 * ./clientes.ts), `undefined` si no está en riesgo, `null` si no se pudo saber (no se leyeron sus pagos o su estado).
 * ⚠️ Sin saberlo NO dice «Activo»: eso se leería como «al día» sobre alguien que puede estar atrasado. Dice sólo el plan (o
 *    «Pausado», que sí se sabe), y la ficha avisa arriba qué no se pudo leer.
 */
export function estadoDeLaCabecera(
  plan: string,
  estado: 'activo' | 'pausado',
  riesgo: { texto: string; grave: boolean } | null | undefined,
): { estadoTxt: string; grave: boolean } {
  if (riesgo) return { estadoTxt: `${plan} · ${riesgo.texto}`, grave: riesgo.grave }
  if (estado === 'pausado') return { estadoTxt: `${plan} · Pausado`, grave: false }
  return { estadoTxt: riesgo === null ? plan : `${plan} · Activo`, grave: false }
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
  /** Lo que paga por mes HOY, en centavos (no depende del rango). */
  mrr: number
  /** Cuántos pedidos hubo en el rango. */
  orders: number
  /** Pedidos del rango sin su valor en dólares (no suman). */
  sinDolares: number
}

/** Las cifras de las cajas de Metrics: lo pagado y los pedidos en el rango (días YYYY-MM-DD, los dos incluidos) y el MRR de hoy. */
export function cifrasDelRango(pedidos: readonly Pedido[], mrrUsd: number, desde: string, hasta: string): CifrasNegocio {
  const t = totalesDePedidos(pedidos.filter((p) => p.fecha >= desde && p.fecha <= hasta))
  return { revenue: t.revenue, mrr: aCentavos(mrrUsd), orders: t.orders, sinDolares: t.sinDolares }
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
  /**
   * Cómo llegó y qué quería resolver (la encuesta del onboarding, lib/onboarding-arranque.ts `llegadaDe`), y lo que dijo que
   * faltaba o estaba mal en el PDF de su oferta. Lo mostraba la grilla vieja de Admin; Polar no lo tiene y va en este bloque
   * por decisión del Cerebro (6/11/2026). `null` = no contestó la encuesta; `'no-leida'` = no se pudo leer (no es «no contestó»).
   */
  llegada: LlegadaNegocio | null | 'no-leida'
  /**
   * Lo que paga su primer mes con el 50% mientras corre ese mes (lib/clientes-plataforma.ts `primerMesUsd`), en dólares.
   * `'no'` = no aplica; `null` = no se pudo leer.
   */
  primerMesUsd: number | 'no' | null
  /** La sección «Activity» de Details (punto 27): si lo usan. */
  actividad: ActividadNegocio
}

/**
 * Si el negocio usa MaKo (la sección «Activity» de Details, punto 27 de la revisión del 6/11/2026): lo que la ficha anterior
 * mostraba y que ya se calcula (lib/clientes-plataforma.ts, la misma fila de la lista). Es un resumen de tres renglones, no la
 * pantalla de actividad descartada. Cada campo distingue «no hay» de «no se pudo leer».
 */
export type ActividadNegocio = {
  /** ISO del último ingreso de alguien de su equipo. `null` = nadie entró nunca; `'no-leida'` = no se pudo leer. */
  ultimoIngreso: string | null | 'no-leida'
  /** Cuántos leads tiene y hace cuántos días llegó el último (`null` si no tiene). `null` = no se pudieron leer. */
  leads: { total: number; diasDelUltimo: number | null } | null
  /** Sesiones del agente (su Claude Code) en los últimos 30 días. `null` = no se pudieron leer. */
  sesionesAgente: number | null
}

const haceDias = (n: number) => (n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} días`)

/** Lo que dice el renglón «Leads»: cuántos y cuándo llegó el último. `null` = no se pudieron leer. */
export function textoDeLeads(l: ActividadNegocio['leads']): string | null {
  if (l == null) return null
  if (l.total === 0) return 'Sin leads'
  const cuantos = l.total === 1 ? '1 lead' : `${l.total.toLocaleString('es-AR')} leads`
  return l.diasDelUltimo == null ? cuantos : `${cuantos} · el último ${haceDias(l.diasDelUltimo)}`
}

/** Lo que dice el renglón «Sesiones del agente». `null` = no se pudieron leer. */
export function textoDeSesiones(n: number | null): string | null {
  if (n == null) return null
  return n === 0 ? 'Ninguna en 30 días' : n === 1 ? '1 en 30 días' : `${n} en 30 días`
}

/** El último ingreso de su equipo, de sus personas (las de Members). */
export function ultimoIngresoDe(miembros: ReadonlyArray<Pick<MiembroNegocio, 'ultimoIngreso'>>): string | null {
  return miembros.reduce<string | null>((m, p) => (p.ultimoIngreso && (!m || p.ultimoIngreso > m) ? p.ultimoIngreso : m), null)
}

/** Lo de la encuesta que se dibuja (sin la fecha). */
export type LlegadaNegocio = { origen: string | null; interes: string | null; pdfNota: string | null }

export type ConexionNegocio = { key: string; nombre: string; conectada: boolean }

export type ComputadoraNegocio = {
  id: number
  nombre: string
  /** De quién es (la persona que la conectó). */
  persona: string
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
 * cuentas, ni la ubicación). `pcs` es lo que leyó el server (`listarPcDelNegocio`), `null` si falló; sin la guarda no se lee.
 */
export function computadorasDeLaFicha(
  opera: boolean,
  pcs: ReadonlyArray<Pick<ComputadoraNegocio, 'id' | 'nombre' | 'persona' | 'sistema' | 'enLinea' | 'conectadaAt'>> | null,
): ComputadorasDeLaFicha {
  if (!opera) return 'oculto'
  return pcs?.map((pc) => ({ id: pc.id, nombre: pc.nombre, persona: pc.persona, sistema: pc.sistema, enLinea: pc.enLinea, conectadaAt: pc.conectadaAt })) ?? null
}

/**
 * «Desconectar» una computadora de la ficha: la server action del Centro (`desconectarComputadoraAction`,
 * app/admin/operaciones/acciones.ts, que vuelve a pedir `puedeOperar`), que la página del server le PASA a la ficha. La ficha no
 * la importa: un componente del navegador que importa una server action se trae `lib/auth` a cada test que lo dibuje en node, y
 * tests/ia-pc-varias.test.ts dejaba de cargar. Sin la prop, el botón no se dibuja.
 */
export type DesconectarComputadora = (
  ws: number,
  id: number,
) => Promise<{ ok: true; pcs: ReadonlyArray<Pick<ComputadoraNegocio, 'id' | 'nombre' | 'persona' | 'sistema' | 'enLinea' | 'conectadaAt'>> } | { ok: false; error: string }>

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
  /** Lo que costaron esas llamadas de IA, en dólares (la tab no tiene). */
  costoUsd: number | null
  /** El último día con uso (YYYY-MM-DD). */
  ultimo: string | null
}

/** Las llamadas de IA del negocio, sumadas por día (de `anthropic_usage` con su `workspace_id`). */
export type IaDelDia = { dia: string; llamadas: number; costoUsd: number }

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

/**
 * Lo que usó el negocio entre `desde` y `hasta` (YYYY-MM-DD, incluidos): una fila por tab con uso, la IA si tuvo llamadas, las
 * tabs que no abrió nadie, y la serie del gráfico. `tabs` son las de los negocios (lib/actividad-reglas.ts `tabsDeNegocios`),
 * juntas por su nombre: dos keys que se dibujan igual son una tab.
 */
export function usoDelNegocio(
  filas: ReadonlyArray<Pick<FilaUso, 'dia' | 'usuario' | 'tab' | 'pantallas' | 'acciones'>>,
  tabs: ReadonlyArray<{ key: string; label: string; keys: readonly string[] }>,
  ia: readonly IaDelDia[],
  desde: string,
  hasta: string,
  intervalo: TimeInterval,
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
    personas: m.personas.size, costoUsd: null, ultimo: m.ultimo,
  }))
  let llamadas = 0
  let costo = 0
  let ultimoIa: string | null = null
  for (const d of ia) {
    if (d.dia < desde || d.dia > hasta || d.llamadas <= 0) continue
    llamadas += d.llamadas
    costo += d.costoUsd
    if (!ultimoIa || d.dia > ultimoIa) ultimoIa = d.dia
  }
  if (llamadas > 0) {
    medidores.push({ key: 'ia', nombre: 'IA', color: COLORES[medidores.length % COLORES.length], unidad: 'llamadas', consumido: llamadas, acciones: null, personas: null, costoUsd: Math.round(costo * 10000) / 10000, ultimo: ultimoIa })
  }
  const usadas = new Set(porTab.keys())
  const sinUso = tabs.filter((t) => !usadas.has(t.key)).map(({ key, label }) => ({ key, label }))
  const series = medidores.filter((m) => m.key !== 'ia').map((m) => ({ key: m.key, label: m.nombre, color: m.color }))
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
  /** Su negocio (`workspace_id`): a dónde se la puede mudar desde «Editar persona». `null` = ninguno. */
  ws: number | null
  /** Sólo en Settings › Members: de qué lado de la plataforma está (./personas.ts). */
  tipo?: TipoPersonaPlataforma
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

const miembroDe = (u: UsuarioParaMiembro, caraDe?: (u: UsuarioParaMiembro) => string | null): MiembroNegocio => ({
  id: u.id, nombre: u.nombre ?? '', email: u.email, rol: u.rol_ws,
  estado: u.estado === 'activo' ? 'activo' : u.estado === 'suspendido' ? 'suspendido' : 'invitado',
  accesoEnviado: u.invitacion_enviada_at, ultimoIngreso: u.ultimo_login, creado: u.created_at,
  mfa: typeof u.mfa_activo === 'boolean' ? u.mfa_activo : null, cara: caraDe?.(u) ?? null, ws: u.workspace_id,
})

/** Las personas del negocio: sus usuarios-cliente (nunca los admins de MaKo, que cruzan negocios), en el orden de alta. */
export function miembrosDe(usuarios: readonly UsuarioParaMiembro[], ws: number, caraDe?: (u: UsuarioParaMiembro) => string | null): MiembroNegocio[] {
  return usuarios
    .filter((u) => u.rol === 'usuario' && u.workspace_id === ws)
    .map((u) => miembroDe(u, caraDe))
    .sort((a, b) => (a.creado < b.creado ? -1 : a.creado > b.creado ? 1 : a.id - b.id))
}

/**
 * Settings › Members (punto 25): las personas de la PLATAFORMA — los admins de MaKo, el equipo de su workspace y quien no tiene
 * un negocio que exista —, nunca las de un negocio-cliente (ésas, sólo en su ficha). `clientes`: los negocios que existen, sin
 * la plataforma. Es el complemento exacto de `miembrosDe` (`tipoDePersona`, ./personas.ts): nadie sale dos veces ni en ninguna.
 * El orden: los admins de MaKo, el equipo y los sin negocio, y adentro por alta.
 */
export function miembrosDePlataforma(
  usuarios: readonly UsuarioParaMiembro[],
  plataforma: number | null,
  clientes: ReadonlySet<number>,
  caraDe?: (u: UsuarioParaMiembro) => string | null,
): MiembroNegocio[] {
  const peso: Record<TipoPersonaPlataforma, number> = { admin: 0, equipo: 1, 'sin-negocio': 2 }
  const out: MiembroNegocio[] = []
  for (const u of usuarios) {
    const tipo = tipoDePersona(u, plataforma, clientes)
    if (tipo) out.push({ ...miembroDe(u, caraDe), tipo })
  }
  return out.sort((a, b) => peso[a.tipo!] - peso[b.tipo!] || (a.creado < b.creado ? -1 : a.creado > b.creado ? 1 : a.id - b.id))
}

/** El contacto del negocio (el «Contact Customer» de Polar): el email de su primer admin activo. */
export function contactoDe(miembros: readonly MiembroNegocio[]): string | null {
  return miembros.find((m) => m.rol === 'admin' && m.estado === 'activo')?.email ?? miembros.find((m) => m.rol === 'admin')?.email ?? null
}

/**
 * Lo que se le pide a /api/admin/usuarios por cada acción de Members (las mismas que tenía Admin: app/admin/AdminView.tsx, la
 * grilla vieja). `crear`, `eliminar` y `workspace` volvieron el 6/11/2026: la copia de Polar los había perdido y la ruta los
 * seguía teniendo.
 */
export type AccionMiembro =
  | { action: 'reinvitar'; id: number }
  | { action: 'estado'; id: number; estado: 'activo' | 'suspendido' }
  | { action: 'rolws'; id: number; rol_ws: RolWorkspace }
  | { action: 'nombre'; id: number; nombre: string }
  | { action: 'crear'; email: string; nombre: string; rol: 'admin' | 'usuario'; workspace_id?: number; rol_ws?: RolWorkspace }
  | { action: 'eliminar'; id: number }
  | { action: 'workspace'; id: number; workspace_id: number }

/** A quién se suma una persona nueva: a un negocio (su ficha) o a la plataforma (Settings › Members). */
export type DestinoDeAlta = { ws: number } | 'plataforma'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * «Agregar persona»: el MISMO cuerpo que mandaba la grilla vieja (`sumar` de AdminView). En un negocio, un usuario de ese
 * negocio con el rol elegido (Admin por defecto, como antes); en la plataforma, un admin de MaKo (el rol global sale de
 * DÓNDE se suma, no de un campo: así lo hacía la grilla). `null` = el email no es un email.
 */
export function cuerpoDeAlta(destino: DestinoDeAlta, form: { nombre: string; email: string; rol?: RolWorkspace | null }): AccionMiembro | null {
  const email = form.email.trim()
  if (!EMAIL_RE.test(email)) return null
  const nombre = form.nombre.trim()
  if (destino === 'plataforma') return { action: 'crear', email, nombre, rol: 'admin' }
  return { action: 'crear', email, nombre, rol: 'usuario', workspace_id: destino.ws, rol_ws: form.rol ?? 'admin' }
}

/** Lo que dice el modal de «Agregar persona»: la consecuencia, que en la plataforma es dar acceso a todos los negocios. */
export const consecuenciaDeAlta = (destino: DestinoDeAlta): string =>
  destino === 'plataforma'
    ? 'Va a ser admin de MaKo: entra a Admin y ve todos los negocios. Le llega un mail con el acceso.'
    : 'Le llega un mail con el acceso a esta cuenta.'

/** «Suspender» o «Reactivar» (el estado contrario al de hoy; un invitado se suspende). */
export const cambioDeEstado = (m: Pick<MiembroNegocio, 'id' | 'estado'>): AccionMiembro =>
  ({ action: 'estado', id: m.id, estado: m.estado === 'suspendido' ? 'activo' : 'suspendido' })

/**
 * Lo que confirma «Suspender» y «Eliminar» (punto 22): los dos apagan los tokens de API que la persona creó
 * (/api/admin/usuarios → `revocarAgenteTokensDe`), y reactivarla le devuelve la entrada, no los tokens. «Reactivar» no pregunta:
 * no quita nada. `null` = va directo.
 */
export function confirmacionDeEstado(m: Pick<MiembroNegocio, 'estado'>): { titulo: string; texto: string; boton: string } | null {
  if (m.estado === 'suspendido') return null
  return { titulo: 'Suspender', texto: 'Deja de entrar y se apagan los tokens de API que creó. Reactivarla no los devuelve.', boton: 'Suspender' }
}

/** «Eliminar» siempre pregunta, y dice la consecuencia (la grilla vieja: «Pierde el acceso… no se puede deshacer»). */
export const TEXTO_ELIMINAR_PERSONA = 'Pierde el acceso y se apagan los tokens de API que creó. No se puede deshacer.'

/**
 * Los pedidos del formulario «Editar persona»: sólo lo que cambió, en el orden en que la ruta los entiende — el nombre, la
 * mudanza de negocio (`workspace`, que valida contra el negocio de HOY que no lo deje sin admin) y el rol en el negocio nuevo.
 */
export function cambiosDelMiembro(
  m: Pick<MiembroNegocio, 'id' | 'nombre' | 'rol'> & { ws?: number | null },
  form: { nombre: string; rol: RolWorkspace | null; ws?: number | null },
): AccionMiembro[] {
  const out: AccionMiembro[] = []
  const nombre = form.nombre.trim()
  if (nombre && nombre !== m.nombre) out.push({ action: 'nombre', id: m.id, nombre })
  if (form.ws != null && form.ws !== (m.ws ?? null)) out.push({ action: 'workspace', id: m.id, workspace_id: form.ws })
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

/**
 * Lo que dice «Editar negocio» del mail del cambio de plan (punto 18). /api/admin/workspaces `capa` devuelve en `aviso` si el
 * mail salió (lib/aviso-plan.ts); `avisoCambioPlan` (lib/plan-aviso.ts) lo clasifica. Sólo una FALLA queda a la vista:
 * «no hay nadie adentro» (`a` vacío y sin error) no es una falla, y por eso no se mira `enviado === false` a secas.
 * ⚠️ Y un envío que REVENTÓ antes de saber a quién (la ruta lo atrapa y devuelve `{ enviado: false, error }`, sin `a`) SÍ es una
 *    falla: `avisoCambioPlan` lo leería como «no hay nadie adentro».
 * `null` = no hay nada que avisar (se cierra el modal).
 */
export function avisoDelCambioDePlan(
  pasos: ReadonlyArray<{ accion: AccionNegocio; resultado: { ok: boolean; datos?: Record<string, unknown> } }>,
): { titulo: string; texto: string } | null {
  const paso = pasos.find((p) => p.accion.action === 'capa' && p.resultado.ok)
  if (!paso || paso.accion.action !== 'capa') return null
  const crudo = paso.resultado.datos?.aviso
  if (!crudo || typeof crudo !== 'object') return null
  const r = crudo as ResultadoAvisoPlan
  const plan = PLANES_ASIGNABLES.find((p) => p.capa === (paso.accion as { capa: CapaId }).capa)?.nombre ?? 'el plan nuevo'
  const a = (r.a ?? '').trim()
  const fallo = !r.enviado && (a ? avisoCambioPlan(r, plan).tono === 'warn' : !!r.error)
  if (!fallo) return null
  return {
    titulo: `El plan cambió, pero el mail no salió: ${r.error ?? 'sin motivo'}`,
    texto: a ? `Avísale tú a ${a}.` : 'Avísale tú a quien administra su cuenta.',
  }
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

// =============================================================================
// Admin › Customers › <negocio>: las lecturas del server de la ficha (lo que Polar pide con useCustomer, useMetrics,
// useSubscriptions, useOrders, useCustomerMeters y useMembers). Las conversiones, en ./cliente.ts (puro). Los eventos (`useEvents`
// del Timeline) son los de Analytics › Events (eventos-server.ts `leerTimelineDelNegocio`): una sola definición.
// =============================================================================
// ⚠️ CRUZA NEGOCIOS: sólo el super admin. Cada page.tsx llama a `exigirSuperAdmin()` ANTES de llamar a estas.
// ⚠️ UNA LECTURA POR PEDIDO (`cache` de React): la cabecera, la lista de la izquierda (app/admin/_polar/datos/clientes-server.ts)
//    y la página leen lo mismo; se lee una vez por render.
// ⚠️ NINGUNA TIRA salvo la del negocio mismo: lo que no se pudo leer va a `avisos` y la vista lo dice («no pude leer» no es un
//    vacío, ni un cero).
// ⚠️ La plataforma (`wsSuperAdmin()`) NO es un Customer: la ficha contesta 404 (sus personas viven en Settings › Members).

import 'server-only'
import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getWorkspace, wsSuperAdmin } from '@/lib/workspace'
import { getSesionAdmin } from '@/lib/auth'
import { puedeOperar } from '@/lib/operaciones-reglas'
import { caraDeUsuario } from '@/lib/gravatar'
import { nombreDePlan, ROTULO_SEGMENTO } from '@/lib/clientes-plataforma-reglas'
import { SERVICIOS_METODO } from '@/lib/metodo-catalogo'
import { integracionConectada } from '@/lib/credenciales'
import { listarPcDelNegocio } from '@/lib/ia-pc'
import { tabsDeNegocios } from '@/lib/actividad-reglas'
import { getSupabaseServer } from '@/lib/supabase'
import { leerTodo } from '@/lib/supabase-paginado'
import { CLAVE_ENCUESTA, llegadaDe } from '@/lib/onboarding-arranque'
import { leerClientes, leerIngresos } from './clientes-server'
import { vistaSuscripciones } from './ventas-server'
import { leerActividad, leerOrdenes, leerTimelineDelNegocio, leerUsuarios } from './eventos-server'
import type { EventoDeTimeline } from './eventos'
import type { Pedido, SuscripcionVenta } from './ventas'
import {
  computadorasDeLaFicha,
  contactoDe,
  inicioDeActividad,
  wsDeId,
  miembrosDe,
  pedidosDelNegocio,
  suscripcionesDelNegocio,
  type AltaNegocio,
  type ComputadorasDeLaFicha,
  type ConexionNegocio,
  type IaDelDia,
  type LlegadaNegocio,
  type MiembroNegocio,
  type NegocioCabecera,
} from './cliente'

const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e))
const DIA_MS = 86_400_000

// Las personas, el uso y los pedidos se leen UNA vez por pedido, con los mismos `cache` de Analytics › Events (eventos-server.ts):
// en el Overview, el Timeline lee los pedidos y las personas también. Los pedidos y las suscripciones son los de Admin › Sales
// (ventas-server.ts): la misma cuenta, el mismo estado y los mismos ids.
const usuarios = leerUsuarios
const actividad = leerActividad
const pedidos = leerOrdenes
const suscripciones = cache(() => vistaSuscripciones())

// ── Las personas (Members) ─────────────────────────────────────────────────────────────────────────────────────────

export type LecturaMiembros = { ok: true; miembros: MiembroNegocio[] } | { ok: false; error: string }

export const leerMiembros = cache(async (ws: number): Promise<LecturaMiembros> => {
  try {
    const todos = await usuarios()
    const caras = new Map(todos.map((u) => [u.id, caraDeUsuario(u)]))
    return { ok: true, miembros: miembrosDe(todos, ws, (u) => caras.get(u.id) ?? null) }
  } catch (e) {
    return { ok: false, error: motivo(e) }
  }
})

// ── El negocio (la cabecera y el «Alta») ───────────────────────────────────────────────────────────────────────────

/**
 * Cómo llegó el negocio: la encuesta del onboarding de SU workspace (`CLAVE_ENCUESTA`), leída por `workspace_id` explícito (la
 * lectura cruza negocios: el super admin mira la de otro). `null` = no contestó; tira si no se pudo leer.
 */
async function llegadaDelNegocio(ws: number): Promise<LlegadaNegocio | null> {
  const { data, error } = await getSupabaseServer()
    .from('app_settings').select('value').eq('workspace_id', ws).eq('key', CLAVE_ENCUESTA).maybeSingle()
  if (error) throw new Error(error.message)
  const l = llegadaDe((data as { value?: string | null } | null)?.value ?? null)
  return l ? { origen: l.origen, interes: l.interes, pdfNota: l.pdfNota } : null
}

export type FichaNegocio = { cabecera: NegocioCabecera; alta: AltaNegocio; avisos: string[] }

/** El negocio, o `null` si no existe o es la plataforma (la página contesta 404). Tira sólo si no se pudo leer el negocio. */
export const leerNegocio = cache(async (ws: number): Promise<FichaNegocio | null> => {
  const [w, plataforma] = await Promise.all([getWorkspace(ws), wsSuperAdmin()])
  if (!w || ws === plataforma) return null
  const avisos: string[] = []
  const [clientes, miembros, llegada] = await Promise.all([
    leerClientes(),
    leerMiembros(ws),
    llegadaDelNegocio(ws).catch((e) => { avisos.push(`cómo llegó: ${motivo(e)}`); return 'no-leida' as const }),
  ])
  if (!clientes.ok) avisos.push(`el estado de su cuenta: ${clientes.error}`)
  else avisos.push(...clientes.avisos)
  if (!miembros.ok) avisos.push(`sus personas: ${miembros.error}`)
  const fila = clientes.ok ? (clientes.datos.filas.find((f) => f.ws === ws) ?? null) : null
  const cabecera: NegocioCabecera = {
    ws, nombre: w.nombre, plan: nombreDePlan(w.capa), capa: w.capa, estado: w.estado,
    contacto: miembros.ok ? contactoDe(miembros.miembros) : null,
    planAMano: fila?.planAManoTxt ?? null,
  }
  const alta: AltaNegocio = {
    creado: w.created_at, plan: cabecera.plan, estado: w.estado,
    onboardingHecho: fila ? fila.onboardingHecho : null,
    prueba: fila ? fila.prueba : null,
    planAMano: fila?.planAManoTxt ?? null,
    segmentos: (fila?.segmentos ?? []).map((s) => ROTULO_SEGMENTO[s]),
    agencia: fila?.agencia ?? null,
    llegada,
    primerMesUsd: fila ? (fila.primerMesUsd ?? 'no') : null,
  }
  return { cabecera, alta, avisos: [...new Set(avisos)] }
})

/** El negocio del path (`/admin/customers/<id>`), o 404: un id que no es un número, un negocio que no existe o la plataforma. */
export async function negocioONotFound(id: string): Promise<FichaNegocio & { ws: number }> {
  const ws = wsDeId(id)
  if (ws == null) notFound()
  const ficha = await leerNegocio(ws)
  if (!ficha) notFound()
  return { ...ficha, ws }
}

/** El título de la pestaña (el `generateCustomerMetadata` de Polar): el nombre del negocio y la sección. */
export async function metadataDeNegocio(id: string, section?: string): Promise<Metadata> {
  const ws = wsDeId(id)
  const ficha = ws == null ? null : await leerNegocio(ws).catch(() => null)
  if (!ficha) return { title: 'Negocio no encontrado' }
  const title = ficha.cabecera.nombre || '—'
  return { title: section ? `${title} · ${section}` : title }
}

/** El principio de la actividad del negocio (el «All Time» del rango): su alta, o su primer pago si fue antes. */
export async function leerInicio(ws: number, creado: string): Promise<string> {
  const ingresos = await ingresosDe(ws)
  return inicioDeActividad(creado, ingresos.pedidos)
}

// ── Overview ───────────────────────────────────────────────────────────────────────────────────────────────────────

export type ResumenNegocio = {
  hoy: string
  pedidos: Pedido[]
  /** Lo que paga por mes hoy (dólares). `null` = no se pudo leer. */
  mrrUsd: number | null
  suscripciones: SuscripcionVenta[]
  conexiones: ConexionNegocio[] | null
  computadoras: ComputadorasDeLaFicha
  /** Los últimos eventos del negocio, para el Timeline (los de Analytics › Events, filtrados por él). */
  eventos: EventoDeTimeline[]
  avisos: string[]
}

async function conexionesDe(ws: number): Promise<ConexionNegocio[]> {
  const servicios = SERVICIOS_METODO.filter((s) => !s.soloPlataforma)
  return Promise.all(servicios.map(async (s) => ({ key: s.key, nombre: s.nombre, conectada: await integracionConectada(s.key, ws) })))
}

/** Los pedidos del negocio (Sales) y lo que paga por mes hoy (`vistaDeIngresos`, la de Overview). */
const ingresosDe = cache(async (ws: number) => {
  const avisos: string[] = []
  const [orders, ingresos] = await Promise.all([
    pedidos().catch((e) => { avisos.push(`sus pagos: ${motivo(e)}`); return null }),
    leerIngresos(),
  ])
  if (orders) avisos.push(...orders.avisos)
  if (!ingresos.ok) avisos.push(`lo que paga por mes: ${ingresos.error}`)
  const v = ingresos.ok ? ingresos.datos : null
  return {
    hoy: orders?.hoy ?? v?.hoy ?? new Date().toISOString().slice(0, 10),
    avisos,
    pedidos: orders ? pedidosDelNegocio(orders.pedidos, ws) : [] as Pedido[],
    /** `null` = no se pudo leer (no es «no paga nada»). */
    mrrUsd: v ? (v.clientes.find((c) => c.ws === ws)?.mrr ?? 0) : null,
  }
})

export const leerResumen = cache(async (ws: number): Promise<ResumenNegocio> => {
  const avisos: string[] = []
  // ⚠️ LAS COMPUTADORAS, SÓLO CON LA GUARDA DEL CENTRO (`puedeOperar`: el segundo factor), como en la ficha vieja: sin ella ni se
  // leen ni se dibujan. Es la misma puerta de `computadorasDelNegocioAction` (app/admin/operaciones/acciones.ts).
  const opera = puedeOperar(await getSesionAdmin(), await wsSuperAdmin())
  const [ingresos, conexiones, computadoras, eventos] = await Promise.all([
    ingresosDe(ws),
    conexionesDe(ws).catch((e) => { avisos.push(`sus conexiones: ${motivo(e)}`); return null }),
    opera ? listarPcDelNegocio(ws).catch((e) => { avisos.push(`sus computadoras: ${motivo(e)}`); return null }) : Promise.resolve(null),
    leerTimelineDelNegocio(ws).catch((e) => ({ eventos: [] as EventoDeTimeline[], avisos: [`sus eventos: ${motivo(e)}`] })),
  ])
  avisos.push(...ingresos.avisos)
  const subs = await suscripciones().catch((e) => ({ suscripciones: [] as SuscripcionVenta[], avisos: [`sus suscripciones: ${motivo(e)}`] }))
  // Lo que el Timeline no pudo leer, salvo lo que ya dijeron los pagos de arriba (Sales lee lo mismo y lo avisa una vez).
  avisos.push(...subs.avisos, ...eventos.avisos.filter((a) => !avisos.some((b) => a.endsWith(b))))
  return {
    hoy: ingresos.hoy,
    pedidos: ingresos.pedidos,
    mrrUsd: ingresos.mrrUsd,
    suscripciones: suscripcionesDelNegocio(subs.suscripciones, ws),
    conexiones,
    computadoras: computadorasDeLaFicha(opera, computadoras),
    eventos: eventos.eventos,
    avisos: [...new Set(avisos)],
  }
})

// ── Usage ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export type LecturaUso = {
  /** `false` = la medición del uso por pantalla (mig 0398) no está: no hay uso que mostrar, y se dice. */
  medido: boolean
  /** El primer día medido de toda la medición (desde cuándo se puede afirmar «no usa»). */
  desde: string | null
  hoy: string
  filas: Array<{ dia: string; usuario: number; tab: string; pantallas: number; acciones: number }>
  tabs: Array<{ key: string; label: string; keys: string[] }>
  ia: IaDelDia[]
  avisos: string[]
}

/** Cuántos días de llamadas de IA se leen: los mismos que el uso por pantalla (lib/actividad.ts `DIAS_LEIDOS`). */
export const DIAS_IA = 70

async function iaDe(ws: number, hoy: string): Promise<IaDelDia[]> {
  const desde = new Date(Date.parse(`${hoy}T00:00:00Z`) - DIAS_IA * DIA_MS).toISOString()
  const filas = await leerTodo<{ created_at: string; cost_usd: number | null }>(getSupabaseServer(), 'anthropic_usage', 'created_at, cost_usd', {
    eq: { workspace_id: ws },
    orden: [{ col: 'created_at', asc: true }, { col: 'id', asc: true }],
    filtros: (q) => q.gte('created_at', desde),
  })
  const porDia = new Map<string, IaDelDia>()
  for (const f of filas) {
    const dia = String(f.created_at).slice(0, 10)
    const d = porDia.get(dia) ?? { dia, llamadas: 0, costoUsd: 0 }
    d.llamadas += 1
    d.costoUsd += Number(f.cost_usd) || 0
    porDia.set(dia, d)
  }
  return [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia))
}

export const leerUso = cache(async (ws: number): Promise<LecturaUso> => {
  const avisos: string[] = []
  const v = await actividad().catch((e) => { avisos.push(`el uso por pantalla: ${motivo(e)}`); return null })
  const hoy = v?.hoy ?? new Date().toISOString().slice(0, 10)
  const ia = await iaDe(ws, hoy).catch((e) => { avisos.push(`las llamadas de IA: ${motivo(e)}`); return [] as IaDelDia[] })
  if (v) avisos.push(...v.avisos)
  return {
    medido: v?.medido ?? false,
    desde: v?.desde ?? null,
    hoy,
    filas: (v?.filas ?? []).filter((f) => f.ws === ws).map(({ dia, usuario, tab, pantallas, acciones }) => ({ dia, usuario, tab, pantallas, acciones })),
    tabs: tabsDeNegocios(),
    ia,
    avisos: [...new Set(avisos)],
  }
})

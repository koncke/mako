// =============================================================================
// La lectura de Admin › Analytics › Events: los lectores de siempre, juntos y sin que uno tumbe a los demás
// =============================================================================
// ⚠️ CRUZA TODOS LOS NEGOCIOS: sólo el super admin (lo pregunta la página antes de llamar). Cada lector que falla deja su
//    aviso y los demás siguen: «no pude leer los pagos» es otra cosa que «no hubo pagos», y la pantalla lo dice.
// ⚠️ ES TAMBIÉN LA LECTURA DE LOS EVENTOS DE UN NEGOCIO (6/11/2026): la ficha (/admin/customers/<ws>) no tiene una lista propia.
//    Su «Events» abre Analytics › Events con `?customerIds=<ws>` (la página lee ese negocio a fondo: `negocios`) y su Timeline
//    son los últimos de acá (`leerTimelineDelNegocio`). Lo que leía la subpágina vieja (cliente-server.ts `leerEventos(ws)`:
//    las últimas 300 acciones y 100 reportes del negocio) son las lecturas a fondo de acá abajo.
// ⚠️ UNA LECTURA POR PEDIDO (`cache` de React): la ficha lee los pedidos, las personas y los errores para otras cosas también, y
//    las toma de acá (cliente-server.ts), así se leen una vez.
// Los topes de cada lector viven en su módulo; acá se pasan para que la pantalla diga qué quedó afuera (`cortes`).

import 'server-only'
import { cache } from 'react'
import { vistaDeActividad, type AccionMako } from '@/lib/actividad'
import { faltaLaTabla } from '@/lib/actividad-registro'
import { TOPE_REPORTES, vistaDeErrores, type Reporte } from '@/lib/admin-errores'
import { leerSesionesAgente } from '@/lib/agente-sesiones'
import { porId } from '@/lib/api-mako/registro'
import { getSupabaseServer } from '@/lib/supabase'
import { listarUsuarios } from '@/lib/usuarios'
import { listarWorkspaces, wsSuperAdmin } from '@/lib/workspace'
import { leerCambiosDeLinea } from '@/lib/registro-lineas'
import { leerIngresos } from './clientes-server'
import { vistaOrders } from './ventas-server'
import {
  armarEventos,
  timelineDelNegocio,
  TOPE_NEGOCIOS_A_FONDO,
  type EntradasEventos,
  type EventoDeTimeline,
  type LecturaAFondo,
  type VistaEventos,
} from './eventos'

/** Lo que lee `vistaDeActividad` de actividad_acciones (su `.limit(100)`). */
export const TOPE_ACCIONES = 100
/** Las sesiones del agente que se leen (el default de `leerSesionesAgente`). */
export const TOPE_SESIONES = 200
/** De un negocio del filtro se leen sus últimas 300 acciones de MaKo y sus últimos 100 reportes (lo que leía su ficha). */
export const TOPE_ACCIONES_DE_UN_NEGOCIO = 300
export const TOPE_REPORTES_DE_UN_NEGOCIO = 100

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))

// ── Los lectores, uno por pedido ───────────────────────────────────────────────────────────────────────────────────

/** Los pedidos de Admin › Sales (lo mismo que dibuja Sales y la ficha: el mismo estado y los mismos ids). */
export const leerOrdenes = cache(() => vistaOrders())
export const leerActividad = cache(() => vistaDeActividad())
export const leerErrores = cache(() => vistaDeErrores())
export const leerUsuarios = cache(() => listarUsuarios())
const leerSesiones = cache(() => leerSesionesAgente(TOPE_SESIONES))
/** Los negocios (para su alta), sin el de la plataforma: no es un Customer. */
const leerNegocios = cache(async () => {
  const [wss, plataforma] = await Promise.all([listarWorkspaces(), wsSuperAdmin()])
  return wss.filter((w) => w.id !== plataforma)
})

// ── Lo de UN negocio, a fondo (lo que leía la subpágina vieja de la ficha) ─────────────────────────────────────────────

const accionDeFila = (a: Record<string, unknown>): AccionMako => ({
  creado: String(a.creado), usuario: a.usuario_id == null ? null : Number(a.usuario_id), ws: a.workspace_id == null ? null : Number(a.workspace_id),
  operacion: String(a.operacion), titulo: porId(String(a.operacion))?.titulo ?? String(a.operacion), area: (a.area as string | null) ?? null,
  canal: String(a.canal), tipo: String(a.tipo), ok: a.ok === true,
})

/** Sus últimas acciones de MaKo. `medido: false` = la tabla (mig 0398) no está. */
async function accionesDeUnNegocio(ws: number): Promise<{ acciones: AccionMako[]; medido: boolean }> {
  const { data, error } = await getSupabaseServer().from('actividad_acciones').select('creado, usuario_id, workspace_id, operacion, area, canal, tipo, ok')
    .eq('workspace_id', ws).order('creado', { ascending: false }).limit(TOPE_ACCIONES_DE_UN_NEGOCIO)
  if (error) {
    if (faltaLaTabla(error)) return { acciones: [], medido: false }
    throw new Error(error.message)
  }
  return { acciones: ((data ?? []) as Array<Record<string, unknown>>).map(accionDeFila), medido: true }
}

/** Sus últimos reportes (los tickets de ese negocio, las mismas columnas que lee `vistaDeErrores`). */
async function reportesDeUnNegocio(ws: number): Promise<Reporte[]> {
  const { data, error } = await getSupabaseServer().from('tickets').select('id, titulo, tipo, estado, prioridad, canal, created_at, usuario_nombre, usuario_email, workspace_id')
    .eq('workspace_id', ws).order('created_at', { ascending: false }).limit(TOPE_REPORTES_DE_UN_NEGOCIO)
  if (error) throw new Error(error.message)
  return ((data ?? []) as Array<Record<string, unknown>>).map((t) => ({
    id: Number(t.id), titulo: String(t.titulo ?? ''), tipo: String(t.tipo ?? ''), estado: String(t.estado ?? ''),
    prioridad: String(t.prioridad ?? ''), canal: String(t.canal ?? ''), creado: String(t.created_at ?? ''),
    quien: String((t.usuario_nombre as string) || (t.usuario_email as string) || ''),
    negocio: null, ws: Number(t.workspace_id),
  }))
}

type AFondo = { lectura: LecturaAFondo; medido: boolean; fallas: { acciones: string | null; reportes: string | null } }

const leerAFondo = cache(async (ws: number): Promise<AFondo> => {
  const [acc, rep] = await Promise.allSettled([accionesDeUnNegocio(ws), reportesDeUnNegocio(ws)])
  return {
    lectura: {
      ws,
      acciones: acc.status === 'fulfilled' ? acc.value.acciones : null,
      reportes: rep.status === 'fulfilled' ? rep.value : null,
    },
    medido: acc.status !== 'fulfilled' || acc.value.medido,
    fallas: {
      acciones: acc.status === 'rejected' ? mensaje(acc.reason) : null,
      reportes: rep.status === 'rejected' ? mensaje(rep.reason) : null,
    },
  }
})

// ── Todo junto ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type OpcionesEventos = {
  /** Los negocios que se leen a fondo (el filtro `customerIds` con el que se abre la pantalla). */
  negocios?: readonly number[]
  /**
   * Sólo interesan esos negocios (el Timeline de la ficha): no se lee lo que hizo MaKo en TODOS (`vistaDeActividad`, con el
   * uso de 70 días de todos), que para ellos se reemplaza por su lectura a fondo.
   */
  soloEsos?: boolean
}

export async function leerEventos(ahora = new Date(), opciones: OpcionesEventos = {}): Promise<VistaEventos> {
  const negocios = [...new Set(opciones.negocios ?? [])].slice(0, TOPE_NEGOCIOS_A_FONDO)
  const solo = opciones.soloEsos === true && negocios.length > 0
  const avisos: string[] = []
  const [ord, ing, alt, act, err, age, usr, fondo, lin] = await Promise.allSettled([
    leerOrdenes(),
    leerIngresos(),
    leerNegocios(),
    solo ? Promise.resolve(null) : leerActividad(),
    leerErrores(),
    leerSesiones(),
    solo ? leerUsuarios() : Promise.resolve(null),
    Promise.all(negocios.map((ws) => leerAFondo(ws))),
    // Los cambios de las líneas de MaKo son de la plataforma, no de un negocio: la ficha de uno no los lee.
    solo ? Promise.resolve(null) : leerCambiosDeLinea(),
  ])

  let pedidos: EntradasEventos['pedidos'] = null
  if (ord.status === 'fulfilled') {
    pedidos = ord.value.pedidos
    avisos.push(...ord.value.avisos.map((a) => `Pagos: ${a}`))
  } else avisos.push(`No pude leer los pagos: ${mensaje(ord.reason)}`)

  // Los avisos de lo cobrado ya vienen con los pagos (Sales lee lo mismo): de acá sólo el que no se pudo leer.
  let ingresos: EntradasEventos['ingresos'] = null
  if (ing.status === 'rejected') avisos.push(`No pude leer los cambios de suscripción: ${mensaje(ing.reason)}`)
  else if (!ing.value.ok) avisos.push(`No pude leer los cambios de suscripción: ${ing.value.error}`)
  else ingresos = { movimientos: ing.value.datos.movimientos, clientes: ing.value.datos.clientes }

  let altas: EntradasEventos['altas'] = null
  if (alt.status === 'fulfilled') altas = alt.value.map((w) => ({ ws: w.id, nombre: w.nombre, creado: w.created_at }))
  else avisos.push(`No pude leer las altas de los negocios: ${mensaje(alt.reason)}`)

  const aFondo: AFondo[] = fondo.status === 'fulfilled' ? fondo.value : []
  if (fondo.status === 'rejected') avisos.push(`No pude leer a fondo los negocios del filtro: ${mensaje(fondo.reason)}`)
  const nombreDe = (ws: number) => altas?.find((a) => a.ws === ws)?.nombre ?? `el negocio ${ws}`
  for (const f of aFondo) {
    if (f.fallas.acciones) avisos.push(`No pude leer todo lo que hizo MaKo en ${nombreDe(f.lectura.ws)}: ${f.fallas.acciones}`)
    if (f.fallas.reportes) avisos.push(`No pude leer todos los reportes de ${nombreDe(f.lectura.ws)}: ${f.fallas.reportes}`)
  }

  let actividad: EntradasEventos['actividad'] = null
  if (solo) {
    // Sin la lectura de todos: las personas (para decir quién) de la lista de usuarios, y lo medido, de la lectura a fondo.
    if (usr.status === 'rejected') avisos.push(`No pude leer las personas: ${mensaje(usr.reason)}`)
    const personas = usr.status === 'fulfilled' && usr.value ? usr.value.map((u) => ({ id: u.id, nombre: u.nombre, email: u.email })) : []
    actividad = { acciones: [], nombres: {}, personas, medido: aFondo.every((f) => f.medido) }
  } else if (act.status === 'fulfilled' && act.value) {
    actividad = { acciones: act.value.acciones, nombres: act.value.nombres, personas: act.value.personas, medido: act.value.medido }
    avisos.push(...act.value.avisos.map((a) => `Acciones de MaKo: ${a}`))
  } else if (act.status === 'rejected') avisos.push(`No pude leer lo que hizo MaKo: ${mensaje(act.reason)}`)

  let errores: EntradasEventos['errores'] = null
  if (err.status === 'fulfilled') {
    errores = { errores: err.value.errores, hayMas: err.value.hayMas, reportes: err.value.reportes, nombres: err.value.nombres }
    avisos.push(...err.value.avisos.map((a) => `Errores: ${a}`))
  } else avisos.push(`No pude leer los errores: ${mensaje(err.reason)}`)

  let agente: EntradasEventos['agente'] = null
  if (age.status === 'fulfilled') {
    agente = { sesiones: age.value.sesiones, nombres: Object.fromEntries(age.value.nombreWs) }
  } else avisos.push(`No pude leer las sesiones del agente: ${mensaje(age.reason)}`)

  const lineas = lin.status === 'fulfilled' ? lin.value : null
  if (lin.status === 'rejected') avisos.push(`No pude leer los cambios de las líneas de MaKo: ${mensaje(lin.reason)}`)

  return armarEventos({
    pedidos, ingresos, altas, actividad, errores, agente, lineas, aFondo: aFondo.map((f) => f.lectura), avisos: [...new Set(avisos)], ahora,
    topes: {
      acciones: TOPE_ACCIONES, reportes: TOPE_REPORTES, sesiones: TOPE_SESIONES,
      accionesDeUnNegocio: TOPE_ACCIONES_DE_UN_NEGOCIO, reportesDeUnNegocio: TOPE_REPORTES_DE_UN_NEGOCIO,
    },
  })
}

export type LecturaTimeline = { eventos: EventoDeTimeline[]; avisos: string[] }

/** El Timeline del Overview de la ficha: los últimos eventos del negocio, de la misma lectura que Analytics › Events. */
export const leerTimelineDelNegocio = cache(async (ws: number): Promise<LecturaTimeline> => {
  const v = await leerEventos(new Date(), { negocios: [ws], soloEsos: true })
  return { eventos: timelineDelNegocio(v.eventos, ws), avisos: v.avisos }
})

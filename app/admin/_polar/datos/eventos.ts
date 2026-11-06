// =============================================================================
// Admin › Analytics › Events: TODO lo que pasa en MaKo, en la lista de eventos de Polar (6/11/2026)
// =============================================================================
// Polar lista los eventos de su API (`useInfiniteEvents`, `useEventHistogram`, `useEventTypeStats`) y los filtra en su
// servidor. MaKo no tiene una tabla de eventos: junta lo que ya leen cinco lectores (cada uno con su propia lectura, en
// eventos-server.ts) y lo filtra EN MEMORIA, con las mismas reglas que la pantalla de Polar:
//   · pago     → cada pago que entró a la plataforma (lib/admin-ingresos.ts → `entradas`), con su negocio (`ws:<n>`);
//   · mako     → lo que hizo MaKo por un negocio (lib/actividad.ts → `acciones`, la tabla actividad_acciones);
//   · error    → los errores de la app agrupados por huella (lib/admin-errores.ts → `errores`);
//   · reporte  → lo que reportaron las personas (lib/admin-errores.ts → `reportes`, los tickets);
//   · agente   → cada sesión del Claude Code de un cliente (lib/agente-sesiones.ts, lo que era /admin/agente).
// `?tipo=error` y `?tipo=agente` (los links de las pantallas viejas) abren filtrado: `tiposDeUrl`.
//
// ⚠️ CADA LECTOR TIENE SU TOPE (las últimas 100 acciones, los 500 errores más recientes, 40 reportes, 200 sesiones). Lo
//    que queda afuera NO se calla: `cortes` dice desde cuándo falta cada cosa, y la pantalla lo muestra si el rango llega
//    hasta ahí. Un «no hay eventos» sobre un pedazo que no se leyó sería mentir.
// ⚠️ SIN CONTENIDO DE UN NEGOCIO más allá de lo que ya mostraban las pantallas viejas (Errors, Agents): el título de un
//    error ya saneado, el acta y los mensajes de una sesión del agente.
// Puro (sin server-only): lo usan la vista del navegador y los tests. Los tipos de los lectores con `server-only` se
// importan sólo como tipos.
// =============================================================================

import type { Entrada } from '@/lib/admin-ingresos-reglas'
import { medioTxt } from '@/lib/admin-ingresos-reglas'
import type { AccionMako } from '@/lib/actividad'
import type { Persona } from '@/lib/actividad-reglas'
import { estadoDeError, ROTULO_ESTADO_ERROR, type FilaError } from '@/lib/admin-errores-reglas'
import type { Reporte } from '@/lib/admin-errores'
import type { SesionAgente } from '@/lib/agente-sesiones'
import { cortarSinPartir } from '@/lib/unicode-seguro'

export const NOMBRES_EVENTO = ['pago', 'mako', 'error', 'reporte', 'agente'] as const
export type NombreEvento = (typeof NOMBRES_EVENTO)[number]

/** El rótulo de cada tipo (el `label` de un event type de Polar), en el orden en que se listan a igual cantidad. */
export const TIPOS_EVENTO: Record<NombreEvento, { label: string; orden: number }> = {
  pago: { label: 'Pagos recibidos', orden: 0 },
  mako: { label: 'Acciones de MaKo', orden: 1 },
  agente: { label: 'Agentes de los clientes', orden: 2 },
  error: { label: 'Errores de la app', orden: 3 },
  reporte: { label: 'Reportes de las personas', orden: 4 },
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
  mako: ['mako'],
  actividad: ['mako'],
  reporte: ['reporte'],
}

export const esNombreEvento = (s: string): s is NombreEvento => (NOMBRES_EVENTO as readonly string[]).includes(s)

/** Los tipos que abre `?tipo=<x>` (null = el valor no nombra ninguno). */
export function tiposDeUrl(tipo: string | string[] | undefined): NombreEvento[] | null {
  const valores = (Array.isArray(tipo) ? tipo : tipo ? [tipo] : []).flatMap((v) => v.split(','))
  const out = new Set<NombreEvento>()
  for (const v of valores) for (const n of ALIAS_TIPO[v.trim().toLowerCase()] ?? []) out.add(n)
  return out.size ? NOMBRES_EVENTO.filter((n) => out.has(n)) : null
}

export type NegocioEvento = { ws: number; nombre: string }
/**
 * Un renglón del detalle: el rótulo, el valor y si se puede copiar. Con `fecha`, `valor` es un ISO y lo formatea el
 * NAVEGADOR (en la zona de quien mira): formateado acá, en el server, saldría en la hora de Vercel (UTC).
 */
export type CampoEvento = { label: string; valor: string; mono?: boolean; copiar?: boolean; fecha?: boolean }
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
  /** La plata del evento, en centavos de dólar (sólo los pagos). */
  monto: number | null
  /** Cuántas veces pasó (los errores agrupados). */
  veces: number | null
  /** Una acción que salió mal. */
  falla: boolean
  campos: CampoEvento[]
  secciones: SeccionEvento[]
  /** Todo lo que se puede buscar, sin mayúsculas ni tildes. */
  texto: string
}

/** Lo que un lector deja afuera por su tope: antes de `desde` faltan esos eventos. */
export type CorteFuente = { nombre: NombreEvento; desde: string; tope: number }

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

const conTexto = (e: Omit<EventoAdmin, 'texto'>): EventoAdmin => ({
  ...e,
  texto: normalizar([e.label, TIPOS_EVENTO[e.nombre].label, e.persona ?? '', ...e.negocios.map((n) => n.nombre), ...e.campos.map((c) => c.valor)].join(' ')),
})

/** Lo que leyó cada lector (null = no se pudo leer: su aviso va en `avisos`). */
export type EntradasEventos = {
  ingresos: { entradas: readonly Entrada[]; clientes: ReadonlyArray<{ clave: string; ws: number | null; nombre: string }> } | null
  actividad: { acciones: readonly AccionMako[]; nombres: Readonly<Record<number, string>>; personas: readonly Persona[]; medido: boolean } | null
  errores: { errores: readonly FilaError[]; hayMas: boolean; reportes: readonly Reporte[]; nombres: Readonly<Record<number, string>> } | null
  agente: { sesiones: readonly SesionAgente[]; nombres: Readonly<Record<number, string>> } | null
  avisos: string[]
  ahora: Date
  /** Los topes de cada lector (para decir qué quedó afuera). */
  topes: { acciones: number; reportes: number; sesiones: number }
}

/** Los pagos: uno por pago que entró, con el negocio que lo pagó si tiene cuenta. */
export function eventosDePagos(entradas: readonly Entrada[], clientes: ReadonlyArray<{ clave: string; ws: number | null; nombre: string }>): EventoAdmin[] {
  const wsDe = new Map(clientes.map((c) => [c.clave, c.ws]))
  return entradas.map((e, i) => {
    const ws = e.cliente ? wsDe.get(e.cliente) ?? null : null
    const monto = e.usd == null ? null : Math.round(e.usd * 100)
    return conTexto({
      id: `pago:${e.id ?? i}`,
      nombre: 'pago',
      label: 'Pago recibido',
      // El mediodía UTC cae en el mismo día en toda América: el día se filtra y se cuenta bien en la zona de quien mira.
      timestamp: `${e.fecha}T12:00:00.000Z`,
      soloDia: true,
      negocios: ws != null ? [{ ws, nombre: e.nombre }] : [],
      persona: ws == null ? e.nombre : null,
      monto,
      veces: null,
      falla: false,
      campos: [
        { label: 'Monto', valor: monto == null ? 'Sin su valor en dólares (no suma)' : `US$ ${(monto / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })}` },
        { label: 'Medio', valor: medioTxt(e.medio) },
        { label: 'Tipo', valor: e.recurrente ? 'De una suscripción' : 'Pago único' },
        ...(ws == null ? [{ label: 'Cliente', valor: `${e.nombre} (sin cuenta de MaKo)` }] : []),
      ],
      secciones: [],
    })
  })
}

/** Lo que hizo MaKo: una acción o una lectura por renglón de actividad_acciones. */
export function eventosDeAcciones(acciones: readonly AccionMako[], nombres: Readonly<Record<number, string>>, personas: readonly Persona[]): EventoAdmin[] {
  const quien = new Map(personas.map((p) => [p.id, p.nombre || p.email]))
  return acciones.map((a, i) => {
    const persona = a.usuario != null ? quien.get(a.usuario) ?? null : null
    return conTexto({
      id: `mako:${a.creado}:${a.operacion}:${i}`,
      nombre: 'mako',
      label: a.ok ? a.titulo : `${a.titulo} (falló)`,
      timestamp: a.creado,
      negocios: negocio(nombres, a.ws),
      persona,
      monto: null,
      veces: null,
      falla: !a.ok,
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

const masViejo = (eventos: readonly EventoAdmin[]): string | null =>
  eventos.reduce<string | null>((m, e) => (m == null || e.timestamp < m ? e.timestamp : m), null)

export function armarEventos(e: EntradasEventos): VistaEventos {
  const avisos = [...e.avisos]
  const cortes: CorteFuente[] = []
  const eventos: EventoAdmin[] = []
  if (e.ingresos) eventos.push(...eventosDePagos(e.ingresos.entradas, e.ingresos.clientes))
  if (e.actividad) {
    if (!e.actividad.medido) avisos.push('Lo que hace MaKo todavía no se mide (falta la migración 0398).')
    const acciones = eventosDeAcciones(e.actividad.acciones, e.actividad.nombres, e.actividad.personas)
    eventos.push(...acciones)
    const desde = masViejo(acciones)
    if (desde && e.actividad.acciones.length >= e.topes.acciones) cortes.push({ nombre: 'mako', desde, tope: e.topes.acciones })
  }
  if (e.errores) {
    const errores = eventosDeErrores(e.errores.errores, e.errores.nombres, e.ahora.getTime())
    const reportes = eventosDeReportes(e.errores.reportes, e.errores.nombres)
    eventos.push(...errores, ...reportes)
    const dErr = masViejo(errores)
    if (dErr && e.errores.hayMas) cortes.push({ nombre: 'error', desde: dErr, tope: e.errores.errores.length })
    const dRep = masViejo(reportes)
    if (dRep && e.errores.reportes.length >= e.topes.reportes) cortes.push({ nombre: 'reporte', desde: dRep, tope: e.topes.reportes })
  }
  if (e.agente) {
    const sesiones = eventosDeSesiones(e.agente.sesiones, e.agente.nombres)
    eventos.push(...sesiones)
    const desde = masViejo(sesiones)
    if (desde && e.agente.sesiones.length >= e.topes.sesiones) cortes.push({ nombre: 'agente', desde, tope: e.topes.sesiones })
  }
  const vistos = new Map<number, NegocioEvento>()
  for (const ev of eventos) for (const n of ev.negocios) if (!vistos.has(n.ws)) vistos.set(n.ws, n)
  return {
    eventos,
    negocios: [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    cortes,
    avisos,
    earliest: masViejo(eventos) ?? e.ahora.toISOString(),
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

/** Los cortes que tocan una lista que arranca en `desde`: los lectores que no llegan tan atrás. */
export const cortesVisibles = (cortes: readonly CorteFuente[], desde: Date): CorteFuente[] =>
  cortes.filter((c) => desde.getTime() < Date.parse(c.desde))

/** Lo que dice un corte, en una línea (`fecha` formatea el día en la zona de quien mira). */
export function textoDeCorte(c: CorteFuente, fecha: (iso: string) => string): string {
  const que: Record<NombreEvento, string> = {
    pago: 'pagos', mako: 'acciones de MaKo', error: 'errores', reporte: 'reportes', agente: 'sesiones del agente',
  }
  return `Antes del ${fecha(c.desde)} faltan ${que[c.nombre]}: se leen los ${c.tope} más recientes.`
}

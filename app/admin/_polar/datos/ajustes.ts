// =============================================================================
// Admin › Settings — los datos del recibo y los interruptores de cobros, como los ajustes de Polar
// =============================================================================
// Puro y SIN `server-only`: lo usan las vistas (SettingsPage, SettingsSectionPage y sus secciones) y
// tests/admin-polar-productos.test.ts, que EJECUTA estas funciones. La lectura vive en ajustes-server.ts.
//
// Dónde vive cada cosa (cada dato, UN lugar):
//   · General = «quién emite» cada recibo (lib/recibos-reglas.ts → `Emisor`: nombre, documento, dirección, correo de
//     contacto). Se guarda con `guardarEmisorAction` (app/admin/cobros/recibos-actions.ts).
//   · Payments = el precio de cada plan en la moneda de la Mercado Pago de MaKo (`preciosLocalesAction` /
//     `guardarPrecioLocalAction`) y lo que paga una agencia por cada cliente (`precioClienteAgenciaAction` /
//     `guardarPrecioClienteAgenciaAction`, app/admin/cobros/actions.ts).
//   · Customer Notifications = lo que le llega a quien paga: el asunto y la primera frase del correo del recibo (los otros
//     dos campos del `Emisor`) y el recibo por WhatsApp a quien paga solo (`guardarWaSoloAction`).
//
// ⚠️ CADA PANTALLA MANDA SÓLO LO QUE TOCÓ (punto 15 de la revisión del 6/11/2026): `guardarEmisor` (lib/recibos.ts) guarda el
//    emisor ENTERO, así que `guardarEmisorAction` recibe los campos cambiados (`cambiosDelEmisor`), los mezcla en el server sobre
//    lo que está guardado (`leerEmisor()` + `emisorConCambios`) y revalida Settings. Antes cada pantalla mandaba el emisor
//    entero con SU copia: escribir el asunto en Customer Notifications y después cambiar la dirección en General (con el emisor
//    precargado por `prefetch` o por el botón atrás) grababa el asunto viejo encima, sin aviso.
// ⚠️ LO ESCRITO NO SE PIERDE AL SALIR (punto 16): `guardadoDiferido` guarda un segundo después del último cambio (el
//    `useAutoSave` de Polar) y, al desmontar, guarda YA lo pendiente en vez de descartarlo. Los guardados van en fila y cada uno
//    calcula lo pendiente cuando le toca: nunca dos veces lo mismo, ni un valor viejo encima de uno nuevo.
// =============================================================================

import type { Emisor } from '@/lib/recibos-reglas'
import type { PrecioClienteAgencia } from '@/lib/agencia-cobro-reglas'

export type { Emisor, PrecioClienteAgencia }

/** El precio de un plan en la moneda de la Mercado Pago de MaKo (la forma de `preciosLocalesAction`). */
export type PrecioPlanLocal = { id: string; nombre: string; precioUsd: number; local: number | null; activo: boolean }

export type DatosGeneral = { ok: true; emisor: Emisor } | { ok: false; error: string }

/**
 * «Ver ejemplo» de Settings › General (decisión del Cerebro, 6/11/2026): el PDF de un recibo con los datos del emisor de hoy,
 * sin número y con datos ficticios. La ruta pide el super admin en su primera línea (tests/admin-cobros.test.ts).
 */
export const RUTA_EJEMPLO_RECIBO = '/api/admin/recibos/ejemplo'

export type DatosPagos = {
  /** La moneda de la Mercado Pago de MaKo (null = no está conectada) y cada plan con su precio ahí. null = no se pudo leer. */
  locales: { moneda: string | null; planes: PrecioPlanLocal[] } | null
  errorLocales: string | null
  precioAgencia: PrecioClienteAgencia | null
  errorAgencia: string | null
  /** ¿La plataforma tiene Mercado Pago conectado? (con qué se cobra el lugar de un cliente de agencia). */
  conMercadoPago: boolean
}

export type DatosNotificaciones = { ok: true; emisor: Emisor; waSolo: boolean } | { ok: false; error: string }

/**
 * Un precio en pesos como lo escribe una persona: «130.000» y «130.000,50» llevan punto de miles (la regla de la pantalla de
 * antes, revisión del 23/10/2026). Vacío = sacar el precio (`null`); lo que no se entiende es `undefined`: NO borra el precio.
 */
export function numeroLocal(s: string): number | null | undefined {
  const t = s.trim()
  if (!t) return null
  const x = Number(t.replace(/[\s.]/g, '').replace(',', '.'))
  return Number.isFinite(x) && x > 0 ? x : undefined
}

/** Un monto chico (dólares, el precio de la agencia): «47», «47.5» o «47,5». Vacío = null; lo que no se entiende, undefined. */
export function numeroSimple(s: string): number | null | undefined {
  const t = s.trim()
  if (!t) return null
  const x = Number(t.replace(',', '.'))
  return Number.isFinite(x) && x > 0 ? x : undefined
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Los cambios de una pantalla: sólo los campos que tocó. */
export type CambiosEmisor = Partial<Record<keyof Emisor, string | null>>

const CLAVES_EMISOR: readonly (keyof Emisor)[] = ['nombre', 'documento', 'direccion', 'correo', 'asunto', 'intro']

/** Como lo guarda `emisorDe` (lib/recibos-reglas.ts): los espacios de más no son un cambio. */
const comoSeGuarda = (v: string | null | undefined): string => String(v ?? '').replace(/\s+/g, ' ').trim()

/**
 * Lo que una pantalla tiene distinto de lo guardado: sólo esos campos viajan (punto 15). Un nombre vacío no es un cambio (el
 * nombre sale en cada recibo: lo frena `problemaDelPerfil`, y `emisorConCambios` no lo pisa).
 */
export function cambiosDelEmisor(guardado: Emisor, valores: CambiosEmisor): CambiosEmisor {
  const out: CambiosEmisor = {}
  for (const k of CLAVES_EMISOR) {
    if (!(k in valores)) continue
    const v = comoSeGuarda(valores[k])
    if (k === 'nombre' && !v) continue
    if (v !== comoSeGuarda(guardado[k])) out[k] = v || null
  }
  return out
}

/** Lo que el server acepta de un pedido: sólo las claves del emisor, cada una texto o null (lo demás se tira). */
export function cambiosDelPedido(raw: unknown): CambiosEmisor {
  const out: CambiosEmisor = {}
  if (!raw || typeof raw !== 'object') return out
  const o = raw as Record<string, unknown>
  for (const k of CLAVES_EMISOR) {
    if (!Object.prototype.hasOwnProperty.call(o, k)) continue
    const v = o[k]
    if (v === null) out[k] = null
    else if (typeof v === 'string') out[k] = v
  }
  return out
}

/**
 * El guardado de General y de Customer Notifications (puntos 15 y 16): un segundo después del último cambio (`cambio()`), y YA
 * al salir (`salir()`, desde el cleanup de un efecto sin dependencias). `pendiente()` dice lo que falta guardar en el momento en
 * que le toca (contra lo último guardado; `null` = nada), y los envíos van en fila:
 *   · nunca dos veces lo mismo: sin un cambio desde el último envío, `salir()` no manda nada, y lo pendiente se recalcula
 *     después de que el anterior volvió;
 *   · nunca un valor viejo encima de uno nuevo: un envío sale cuando el anterior terminó, con lo que hay escrito en ESE momento.
 * Lo que falla no corta la fila (cada pantalla dice el error en `enviar`).
 */
export function guardadoDiferido<C>(o: { pendiente: () => C | null; enviar: (c: C) => Promise<unknown>; demoraMs: number }) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let sucio = false
  let fila: Promise<unknown> = Promise.resolve()
  const mandar = (): Promise<unknown> => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!sucio) return fila
    sucio = false
    fila = fila
      .then(() => {
        const c = o.pendiente()
        return c == null ? undefined : o.enviar(c)
      })
      .catch(() => undefined)
    return fila
  }
  return {
    /** Algo cambió: se guarda `demoraMs` después del último cambio. */
    cambio() {
      sucio = true
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void mandar(), o.demoraMs)
    },
    /** Guardar YA lo pendiente (al desmontar): no se descarta. Devuelve la fila, para esperarla. */
    salir: mandar,
  }
}

/**
 * «Guardado», en gris, un rato en la misma fila (punto 16, los precios de Payments y Cliente de agencia: salen en /planes, y
 * sin esto no se distinguía «se guardó» de «no pasó nada»). `alCambiar(true)` al marcar y `alCambiar(false)` a los `ms`; marcar
 * de nuevo reinicia la cuenta. General y Notifications no lo llevan: Polar guarda en silencio ahí, y se copia.
 */
export function marcaDeGuardado(alCambiar: (visible: boolean) => void, ms = 2000) {
  let t: ReturnType<typeof setTimeout> | null = null
  return {
    marcar() {
      if (t) clearTimeout(t)
      alCambiar(true)
      t = setTimeout(() => {
        t = null
        alCambiar(false)
      }, ms)
    },
    limpiar() {
      if (t) clearTimeout(t)
      t = null
    },
  }
}

/** El emisor completo con los cambios encima: lo que arma `guardarEmisorAction` en el server, sobre lo guardado (ver la cabecera). */
export function emisorConCambios(base: Emisor, cambios: Partial<Record<keyof Emisor, string | null>>): Emisor {
  const limpio = (v: string | null | undefined): string | null => {
    const t = (v ?? '').trim()
    return t ? t : null
  }
  const out: Emisor = { ...base }
  for (const k of Object.keys(cambios) as (keyof Emisor)[]) {
    if (k === 'nombre') out.nombre = (cambios.nombre ?? '').trim() || base.nombre
    else out[k] = limpio(cambios[k])
  }
  return out
}

/** ¿Hay algo distinto de lo guardado? (sin mirar los espacios de los bordes). */
export const mismoEmisor = (a: Emisor, b: Emisor): boolean =>
  (Object.keys(a) as (keyof Emisor)[]).every((k) => (a[k] ?? '').toString().trim() === (b[k] ?? '').toString().trim())

/** Lo que frena el guardado del perfil (como el «Organization name is required» de Polar). null = se puede guardar. */
export function problemaDelPerfil(v: { nombre: string; correo: string }): { campo: 'nombre' | 'correo'; mensaje: string } | null {
  if (!v.nombre.trim()) return { campo: 'nombre', mensaje: 'El nombre sale en cada recibo: no puede quedar vacío.' }
  if (v.correo.trim() && !EMAIL_RE.test(v.correo.trim())) return { campo: 'correo', mensaje: 'Revisa el correo de contacto.' }
  return null
}

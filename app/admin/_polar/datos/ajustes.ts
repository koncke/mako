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
// ⚠️ `guardarEmisor` GUARDA EL EMISOR ENTERO (`emisorDe(e)` sobre lo que llega): un pedido con sólo el asunto deja el nombre
//    en el de fábrica y el documento vacío. Por eso General y Customer Notifications mandan SIEMPRE el emisor completo, con
//    sus cambios encima (`emisorConCambios`).
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

/** El emisor completo con los cambios encima (lo que se le manda a `guardarEmisorAction`: ver la cabecera). */
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

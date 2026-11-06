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

import { textoCorreo, type DatosDelTexto, type Emisor } from '@/lib/recibos-reglas'
import type { PrecioClienteAgencia } from '@/lib/agencia-cobro-reglas'

export type { Emisor, PrecioClienteAgencia }

/** El precio de un plan en la moneda de la Mercado Pago de MaKo (la forma de `preciosLocalesAction`). */
export type PrecioPlanLocal = { id: string; nombre: string; precioUsd: number; local: number | null; activo: boolean }

export type DatosGeneral = { ok: true; emisor: Emisor } | { ok: false; error: string }

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

// ── Customer Notifications: los datos que puede llevar el correo del recibo ─────────────────────────────────────────

/**
 * Los datos de cada pago que el asunto y la primera frase pueden llevar (los que reemplaza `textoCorreo`, lib/recibos-reglas.ts).
 * La pantalla los ofrece con su nombre («N.º del recibo»), nunca con las llaves: al tocar uno se agrega su marca al campo, y
 * abajo se ve cómo llega con un pago de ejemplo.
 */
export type DatoDelCorreo = { marca: string; rotulo: string }
export const DATOS_DEL_ASUNTO: readonly DatoDelCorreo[] = [
  { marca: '{{numero}}', rotulo: 'N.º del recibo' },
  { marca: '{{nombre}}', rotulo: 'A nombre de' },
]
export const DATOS_DE_LA_FRASE: readonly DatoDelCorreo[] = [
  { marca: '{{monto}}', rotulo: 'Monto' },
  { marca: '{{concepto}}', rotulo: 'Concepto' },
  { marca: '{{fecha}}', rotulo: 'Fecha' },
  { marca: '{{medio}}', rotulo: 'Medio de pago' },
  { marca: '{{numero}}', rotulo: 'N.º del recibo' },
  { marca: '{{nombre}}', rotulo: 'A nombre de' },
]

/** Un pago de EJEMPLO (ficticio) para mostrar cómo llega el correo. */
export const PAGO_DE_EJEMPLO: DatosDelTexto = {
  numero: 12, monto: 'US$ 97', concepto: 'MaKo Pro', fecha: '5 nov 2026', medio: 'transferencia', aNombre: 'Estudio Norte',
}

/** El texto con un dato más al final (con un espacio en el medio si hace falta). */
export function conDato(texto: string, marca: string): string {
  if (!texto) return marca
  return /\s$/.test(texto) ? `${texto}${marca}` : `${texto} ${marca}`
}

/**
 * Cómo llega el correo con el pago de ejemplo: el asunto y la primera frase ya con los datos puestos (lo que escribió la
 * persona, o el texto de siempre si el campo está vacío). Es la MISMA cuenta que arma el correo de verdad (`textoCorreo`).
 */
export function vistaPreviaDelCorreo(asunto: string, intro: string, pago: DatosDelTexto = PAGO_DE_EJEMPLO): { asunto: string; intro: string } {
  const t = textoCorreo({ ...pago, leyenda: null, contacto: '', titulo: 'Recibo', asunto: asunto.trim() || null, intro: intro.trim() || null })
  return { asunto: t.asunto, intro: t.cuerpo.split('\n')[2] ?? '' }
}

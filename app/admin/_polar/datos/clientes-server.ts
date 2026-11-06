// =============================================================================
// Admin › Customers: las lecturas del server (lo que Polar pide con useCustomers, useTopCustomers, useSubscriptions y
// useEventCustomerStats). Las conversiones a las props de cada vista, en app/admin/_polar/datos/clientes.ts (puro).
// =============================================================================
// ⚠️ CRUZA NEGOCIOS: sólo el super admin. Cada page.tsx llama a `exigirSuperAdmin()` ANTES de llamar a estas.
// ⚠️ UNA LECTURA POR PEDIDO: el layout (la lista de la izquierda) y la página leen lo mismo, y `cache` de React lo lee una
//    vez por render. Ninguna tira: devuelven `{ ok: false, error }` y la vista dice «no pude leer» (no es un vacío).

import 'server-only'
import { cache } from 'react'
import { vistaDeClientes, type VistaClientes } from '@/lib/clientes-plataforma'
import { vistaDeIngresos, type VistaIngresos } from '@/lib/admin-ingresos'
import { resumenEntre } from '@/lib/costos-ia'
import { wsSuperAdmin } from '@/lib/workspace'
import { CAPA_DEFAULT, CAPAS_VENDIBLES } from '@/lib/capas'
import { avisoAltaAMano } from '@/lib/plan-esencial-reglas'
import { partirEnElReparto, ventanaDelMes, type GastoParaRepartir, type Lectura } from './clientes'
import type { OpcionesAlta } from './alta'

const motivo = (e: unknown) => (e instanceof Error ? e.message : String(e))

export const leerClientes = cache(async (): Promise<Lectura<VistaClientes>> => {
  try {
    const v = await vistaDeClientes()
    return { ok: true, datos: v, avisos: v.avisos }
  } catch (e) {
    return { ok: false, error: motivo(e) }
  }
})

export const leerIngresos = cache(async (): Promise<Lectura<VistaIngresos>> => {
  try {
    const v = await vistaDeIngresos()
    return { ok: true, datos: v, avisos: v.avisos }
  } catch (e) {
    return { ok: false, error: motivo(e) }
  }
})

/**
 * El gasto de IA de una ventana, partido en el día desde el que se reparte por negocio (`REPARTO_DESDE`, ./clientes.ts): lo de
 * antes se lee aparte (sólo su total cuenta) y lo de después, con su corte por workspace. Son las mismas filas que una lectura
 * entera, en dos ventanas que no se pisan. Sin los meses con datos (`resumenEntre` no los pide: Customers no los usa).
 */
async function gastoParaRepartir(rotulo: string, desde: string | null, hasta: string | null): Promise<GastoParaRepartir> {
  const partes = partirEnElReparto(desde, hasta)
  const [antes, despues, plataforma] = await Promise.all([
    partes.antes ? resumenEntre(rotulo, partes.antes.desde, partes.antes.hasta) : null,
    partes.despues ? resumenEntre(rotulo, partes.despues.desde, partes.despues.hasta) : null,
    wsSuperAdmin(),
  ])
  return { periodo: rotulo, antes, despues, plataforma }
}

/** El gasto de IA de un mes ('YYYY-MM'). */
export const leerCostos = cache(async (periodo: string): Promise<Lectura<GastoParaRepartir>> => {
  try {
    const v = ventanaDelMes(periodo)
    return { ok: true, datos: await gastoParaRepartir(periodo, v.desde, v.hasta), avisos: [] }
  } catch (e) {
    return { ok: false, error: motivo(e) }
  }
})

/** El gasto de IA de una ventana exacta (Cost Drivers con el selector de rango de Polar: `ventanaDeCostos`, ./clientes.ts). */
export const leerCostosEntre = cache(async (rotulo: string, desde: string | null, hasta: string): Promise<Lectura<GastoParaRepartir>> => {
  try {
    return { ok: true, datos: await gastoParaRepartir(rotulo, desde, hasta), avisos: [] }
  } catch (e) {
    return { ok: false, error: motivo(e) }
  }
})

/**
 * Los planes del formulario de alta (el de Customers, ./alta.ts): los que se venden, con su aviso de plan a mano. Se arman en
 * el server para no llevar el catálogo de capas entero al navegador. No lee la base.
 */
export function opcionesDeAlta(): OpcionesAlta {
  return {
    planes: CAPAS_VENDIBLES.map((c) => ({ id: c.id, nombre: c.nombre, descripcion: c.descripcion, aviso: avisoAltaAMano(c.id) })),
    planPorDefecto: CAPA_DEFAULT,
  }
}

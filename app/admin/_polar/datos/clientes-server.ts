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
import { resumenDelPeriodo, type ResumenPeriodo } from '@/lib/costos-ia'
import type { Lectura } from './clientes'

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

/** El gasto de IA de un mes ('YYYY-MM'). */
export const leerCostos = cache(async (periodo: string): Promise<Lectura<ResumenPeriodo>> => {
  try {
    return { ok: true, datos: await resumenDelPeriodo(periodo), avisos: [] }
  } catch (e) {
    return { ok: false, error: motivo(e) }
  }
})

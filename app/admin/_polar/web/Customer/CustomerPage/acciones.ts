'use client'

// =============================================================================
// Las escrituras de la ficha de un negocio: lo que Polar hace con sus mutaciones de @/hooks/queries (useUpdateCustomer,
// useDeleteCustomer, useUpdateMember), en MaKo por las rutas de siempre de Admin. Las mismas acciones que tenía la grilla vieja
// (app/admin/AdminView.tsx): /api/admin/workspaces (nombre, capa, plan_a_mano, estado, eliminar) y /api/admin/usuarios
// (reinvitar, estado, rolws, nombre). Cada ruta vuelve a preguntar si es el super admin (`getSesionAdmin`).
// ⚠️ Una respuesta que no es `ok` devuelve su `error` tal cual: el motivo («Es el único admin de ese cliente…») es lo que la
//    persona necesita para decidir, y traducirlo a «no se pudo» lo tira.
// =============================================================================

import type { AccionMiembro, AccionNegocio } from '@/app/admin/_polar/datos/cliente'

export type ResultadoAccion = { ok: true; datos: Record<string, unknown> } | { ok: false; error: string }

async function post(ruta: string, cuerpo: unknown): Promise<ResultadoAccion> {
  try {
    const r = await fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
    const j = (await r.json().catch(() => null)) as ({ ok?: boolean; error?: string } & Record<string, unknown>) | null
    if (!j) return { ok: false, error: `El servidor contestó ${r.status} sin explicar por qué.` }
    if (!j.ok) return { ok: false, error: typeof j.error === 'string' && j.error ? j.error : 'No se pudo.' }
    return { ok: true, datos: j }
  } catch {
    return { ok: false, error: 'No hubo respuesta del servidor: revisa la conexión y vuelve a intentarlo.' }
  }
}

export const accionDelNegocio = (a: AccionNegocio) => post('/api/admin/workspaces', a)
export const accionDelMiembro = (a: AccionMiembro) => post('/api/admin/usuarios', a)

/** Lo que devuelve `enOrden`: la última respuesta (la que falló, si falló) y la de CADA paso que corrió, en orden. */
export type ResultadoEnOrden<T> = ResultadoAccion & { pasos: Array<{ accion: T; resultado: ResultadoAccion }> }

/**
 * Varias en orden; se corta en la primera que falla (lo de antes ya quedó guardado, y se dice cuál falló).
 * ⚠️ `pasos` lleva la respuesta de cada uno (punto 18 de la revisión del 6/11/2026): «Editar negocio» manda `capa` y después
 *    `plan_a_mano`, y el `aviso` del mail del cambio de plan viene en la respuesta de `capa`. Con sólo la última, el
 *    `plan_a_mano` lo tapaba y un mail que no salió se cerraba como si todo hubiera salido bien.
 */
export async function enOrden<T>(acciones: readonly T[], correr: (a: T) => Promise<ResultadoAccion>): Promise<ResultadoEnOrden<T>> {
  let ultimo: ResultadoAccion = { ok: true, datos: {} }
  const pasos: ResultadoEnOrden<T>['pasos'] = []
  for (const a of acciones) {
    ultimo = await correr(a)
    pasos.push({ accion: a, resultado: ultimo })
    if (!ultimo.ok) break
  }
  return { ...ultimo, pasos }
}

/**
 * «Ir a Customers» después de eliminar un negocio (punto 20): `push` y después `refresh`. Los layouts compartidos (la lista de
 * la izquierda y el índice de ⌘K) no se vuelven a dibujar con un `push` solo, y el negocio borrado seguía ahí, con un 404 al
 * tocarlo. El molde es el de CheckoutLinkListSidebar.
 */
export function irALaLista(router: { push: (href: string) => void; refresh: () => void }) {
  router.push('/admin/customers')
  router.refresh()
}

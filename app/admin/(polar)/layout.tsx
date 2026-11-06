// =============================================================================
// /admin — la tab Admin del super admin, copiada del dashboard de Polar (polarsource/polar, Apache-2.0) (6/11/2026)
// =============================================================================
// Martín, 6/11/2026, textual: «borres todo… copia por completo… no es solamente el diseño, es también las
// funcionalidades… cómo distribuyen cada página… seas criterioso». La fuente es UNA: el dashboard de Polar
// (clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/), su layout, su barra y sus páginas, portadas archivo
// por archivo en app/admin/_polar (el porqué y lo que se sacó: docs/investigacion-admin.md y docs/relevo/nube-admin-polar.md).
//
// La barra de Polar, en el orden que pidió Martín: Overview · Customers · Analytics · Sales · Products · Finance · Settings.
// Sin la barra de arriba, el logo, el selector de organización ni la cuenta del pie: el perfil y el modo oscuro viven en
// la barra de MaKo, a la izquierda.
//
// ⚠️ Es un grupo de rutas (`(polar)`): las otras subrutas de /admin (/admin/dev, /admin/ui, /admin/approvals,
//    /admin/operaciones…) son otras tabs del super admin y NO llevan este layout.
// ⚠️ SÓLO EL SUPER ADMIN (app/admin/_polar/datos/guarda.ts), acá y en cada página.
// ⚠️ LAS PÁGINAS QUE REDIRIGEN LO HACEN ACÁ, EN LA CARGA (punto 31 de docs/admin/revision-cerebro-6-11.md): desde que Admin
//    tiene su loading.tsx, un `redirect()` de una página va adentro del stream (el React #310 de /general). Este layout queda
//    afuera del loader y devuelve el 307. Qué hace cada ruta lo dice `redireccionDeLaCarga` (./layout-reglas.ts, con su test);
//    navegando no se redirige acá (el redirect quedaría guardado en este nodo: lib/pedido-actual.ts), decide la página.
// ⚠️ EL ÍNDICE DE ⌘K NO SE CAMBIA POR LISTAS VACÍAS (punto 23): `indiceDeBusqueda` no tira, y si no pudo leer viaja con su
//    `error` («No pude leer los negocios» en ⌘K, nunca «No hay resultados»).

import type { ReactNode } from 'react'
import { redirect, RedirectType } from 'next/navigation'
import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { indiceDeBusqueda } from '@/app/admin/_polar/datos/busqueda'
import { AdminShell } from '@/app/admin/_polar/AdminShell'
import { esNavegacionDelCliente, pedidoActual } from '@/lib/pedido-actual'
import { rutaConWs } from '@/lib/workspace'
import { leerNegocio } from '@/app/admin/_polar/datos/cliente-server'
import { rutaDeEventosDelNegocio } from '@/app/admin/_polar/datos/cliente'
import { destinoDePagoDevuelto, vistaCheckouts } from '@/app/admin/_polar/datos/ventas-server'
import { rutaDeCheckoutLink } from '@/app/admin/_polar/datos/checkout-link'
import { propsDeMetricas } from '@/app/admin/_polar/datos/metricas'
import { vistaDeIngresos } from '@/lib/admin-ingresos'
import { correccionDeMetricas, redireccionDeLaCarga } from './layout-reglas'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** A dónde manda la carga de esta ruta, como lo haría su página. `null` = a ningún lado. */
async function destinoDeLaCarga(): Promise<{ destino: string; reemplazar: boolean } | null> {
  if (await esNavegacionDelCliente()) return null
  const { ruta, query } = await pedidoActual()
  const r = redireccionDeLaCarga(ruta, query)
  if (!r) return null
  if (r.tipo === 'ir') return { destino: r.conWs ? await rutaConWs(r.destino) : r.destino, reemplazar: r.reemplazar }
  // Las que piden leer: si la lectura falla, no se redirige (la página lo dice con su aviso, o da su 404).
  if (r.tipo === 'eventos-del-negocio') {
    const ficha = await leerNegocio(r.ws).catch(() => null)
    return ficha ? { destino: rutaDeEventosDelNegocio(r.ws), reemplazar: true } : null
  }
  if (r.tipo === 'pago-devuelto') {
    const destino = await destinoDePagoDevuelto(r.pago).catch(() => null)
    return destino ? { destino: await rutaConWs(destino), reemplazar: false } : null
  }
  if (r.tipo === 'link-de-venta') {
    const vista = await vistaCheckouts().catch(() => null)
    const esLink = !!vista && !vista.checkouts.some((c) => c.id === r.id) && vista.linksDeVenta.includes(r.id)
    return esLink ? { destino: rutaDeCheckoutLink(r.id), reemplazar: false } : null
  }
  const vista = await vistaDeIngresos().catch(() => null)
  const destino = vista ? correccionDeMetricas(query, propsDeMetricas(vista).earliestDateISOString) : null
  return typeof destino === 'string' ? { destino, reemplazar: true } : null
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await exigirSuperAdmin()
  const salto = await destinoDeLaCarga()
  if (salto) redirect(salto.destino, salto.reemplazar ? RedirectType.replace : undefined)
  const indice = await indiceDeBusqueda()
  return <AdminShell indice={indice}>{children}</AdminShell>
}

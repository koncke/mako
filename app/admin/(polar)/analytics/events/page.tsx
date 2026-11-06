// Copiado de polarsource/polar (Apache-2.0) y modificado para MaKo, clients/apps/web/src/app/(main)/dashboard/[organization]/(header)/analytics/events/page.tsx. Aviso: lib/avisos/LICENSE-POLAR y lib/avisos/NOTICE-POLAR.
//
// Admin › Analytics › Events: TODO lo que pasa (los pagos y lo devuelto, los cambios de suscripción, las altas, lo que hizo MaKo,
// los errores, los reportes y las sesiones del agente de los clientes), leído por `leerEventos` y filtrado en el navegador
// (EventsPage.tsx). Es también el «Events» de la ficha de un negocio (como Polar: `?customerIds=<ws>&range=allTime`); los
// negocios de `?customerIds=` se leen además a fondo (sus últimas acciones y reportes, no sólo los que entran entre los de
// todos), y el resto del filtro sigue en el navegador.
// `?tipo=error` y `?tipo=agente` son los links de las pantallas viejas (Errors, Agents): se traducen al filtro de tipos de
// Polar (`eventTypes`), desde siempre (como mostraban esas pantallas), y la URL queda la de esta pantalla.
// ⚠️ SÓLO EL SUPER ADMIN, antes de leer nada (cruza todos los negocios).

import { exigirSuperAdmin } from '@/app/admin/_polar/datos/guarda'
import { leerEventos } from '@/app/admin/_polar/datos/eventos-server'
import { negociosDeUrl, tiposDeUrl } from '@/app/admin/_polar/datos/eventos'
import { redirect, RedirectType } from 'next/navigation'
import EventsPage from './EventsPage'

export const dynamic = 'force-dynamic'

export const metadata = { title: 'Events' }

export default async function Page(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await exigirSuperAdmin()
  const searchParams = await props.searchParams

  if (searchParams.tipo !== undefined) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === 'tipo' || v === undefined) continue
      for (const x of Array.isArray(v) ? v : [v]) params.append(k, x)
    }
    const tipos = tiposDeUrl(searchParams.tipo)
    if (tipos && !params.has('eventTypes')) params.set('eventTypes', tipos.join(','))
    // Las pantallas viejas mostraban la lista entera (no los últimos 3 meses): el link abre desde siempre.
    if (tipos && !params.has('range') && !params.has('startDate')) params.set('range', 'allTime')
    const q = params.toString()
    redirect(`/admin/analytics/events${q ? `?${q}` : ''}`, RedirectType.replace)
  }

  const vista = await leerEventos(new Date(), { negocios: negociosDeUrl(searchParams.customerIds) })
  return <EventsPage vista={vista} />
}

// =============================================================================
// La puerta de Admin: SÓLO el super admin, en la primera línea de cada página y antes de leer nada
// =============================================================================
// `getSesionAdmin` (el rol global), no `rol_ws`: ése vale 'admin' para el dueño de cada negocio. /admin está además en
// `SOLO_ADMIN` del proxy, y cada acción vuelve a preguntar. Va en CADA page.tsx y no sólo en el layout: al navegar adentro
// de Admin el layout no se vuelve a correr, la página sí (y es la que lee los datos que cruzan negocios).

import 'server-only'
import { redirect } from 'next/navigation'
import { getSesionAdmin } from '@/lib/auth'
import { requireSesion } from '@/lib/tab-access'

export async function exigirSuperAdmin() {
  await requireSesion()
  const sesion = await getSesionAdmin()
  if (!sesion) redirect('/inicio')
  return sesion
}

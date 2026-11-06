// =============================================================================
// La lectura de Admin › Analytics › Costs: el mes que se mira y el anterior (para comparar)
// =============================================================================
// ⚠️ CRUZA TODOS LOS NEGOCIOS: sólo el super admin (lo pregunta la página antes de llamar). `resumenDelPeriodo` pagina sin
//    el techo de 1000 filas (su cabecera). Si el mes que se mira no se puede leer, sube el error (la pantalla dice «No pude
//    leer»); si falla el anterior, se avisa y la pantalla sigue sin esas comparaciones. El gasto por negocio no se lee acá:
//    vive en Customers › Cost Drivers.

import 'server-only'
import { resumenDelPeriodo } from '@/lib/costos-ia'
import { armarCostos, mesAnterior, type VistaCostos } from './costos'

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function leerCostos(periodo: string, hoy = new Date()): Promise<VistaCostos> {
  const avisos: string[] = []
  const [actual, previo] = await Promise.allSettled([
    resumenDelPeriodo(periodo),
    resumenDelPeriodo(mesAnterior(periodo)),
  ])
  if (actual.status === 'rejected') throw actual.reason
  if (previo.status === 'rejected') avisos.push(`el mes anterior (sin comparaciones): ${mensaje(previo.reason)}`)
  return armarCostos({
    periodo,
    actual: actual.value,
    previo: previo.status === 'fulfilled' ? previo.value : null,
    hoy,
    avisos,
  })
}

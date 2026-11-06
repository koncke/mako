// =============================================================================
// La lectura de Admin › Analytics › Costs: el mes que se mira, el anterior (para comparar) y los nombres de los negocios
// =============================================================================
// ⚠️ CRUZA TODOS LOS NEGOCIOS: sólo el super admin (lo pregunta la página antes de llamar). `resumenDelPeriodo` pagina sin
//    el techo de 1000 filas (su cabecera). Si el mes que se mira no se puede leer, sube el error (la pantalla dice «No pude
//    leer»); si falla el anterior o los nombres, se avisa y la pantalla sigue sin esas comparaciones o con «Negocio N».

import 'server-only'
import { resumenDelPeriodo } from '@/lib/costos-ia'
import { listarWorkspaces } from '@/lib/workspace'
import { armarCostos, mesAnterior, type VistaCostos } from './costos'

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function leerCostos(periodo: string, hoy = new Date()): Promise<VistaCostos> {
  const avisos: string[] = []
  const [actual, previo, wss] = await Promise.allSettled([
    resumenDelPeriodo(periodo),
    resumenDelPeriodo(mesAnterior(periodo)),
    listarWorkspaces(),
  ])
  if (actual.status === 'rejected') throw actual.reason
  if (previo.status === 'rejected') avisos.push(`el mes anterior (sin comparaciones): ${mensaje(previo.reason)}`)
  const nombres: Record<number, string> = {}
  if (wss.status === 'fulfilled') for (const w of wss.value) nombres[w.id] = w.nombre
  else avisos.push(`los nombres de los negocios: ${mensaje(wss.reason)}`)
  return armarCostos({
    periodo,
    actual: actual.value,
    previo: previo.status === 'fulfilled' ? previo.value : null,
    nombres,
    hoy,
    avisos,
  })
}

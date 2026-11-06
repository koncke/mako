// =============================================================================
// La lectura de Admin › Analytics › Costs: el mes que se mira y el anterior (para comparar)
// =============================================================================
// ⚠️ CRUZA TODOS LOS NEGOCIOS: sólo el super admin (lo pregunta la página antes de llamar). `resumenDelPeriodo` pagina sin
//    el techo de 1000 filas (su cabecera). Si el mes que se mira no se puede leer, sube el error (la pantalla dice «No pude
//    leer»); si falla el anterior, se avisa y la pantalla sigue sin esas comparaciones; si falla lo que entró, se avisa y la
//    pantalla sigue sin el margen bruto. El gasto por negocio no se lee acá: vive en Customers › Cost Drivers.

import 'server-only'
import { gastoPorDia, resumenDelPeriodo, type Corte } from '@/lib/costos-ia'
import { vistaDeIngresos } from '@/lib/admin-ingresos'
import { CATALOGO_MODELOS } from '@/lib/model-registry'
import { armarCostos, mesAnterior, nombresDeFeatures, type VistaCostos } from './costos'

const NOMBRE_DE_FEATURE = nombresDeFeatures(CATALOGO_MODELOS)

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function leerCostos(periodo: string, hoy = new Date()): Promise<VistaCostos> {
  const avisos: string[] = []
  const [actual, previo, ingresos] = await Promise.allSettled([
    resumenDelPeriodo(periodo),
    resumenDelPeriodo(mesAnterior(periodo)),
    // Lo que entró, para el margen bruto: la misma lista que suma Revenue en Overview (la tarjeta «Margen bruto» lleva acá).
    vistaDeIngresos(hoy),
  ])
  if (actual.status === 'rejected') throw actual.reason
  if (previo.status === 'rejected') avisos.push(`el mes anterior (sin comparaciones): ${mensaje(previo.reason)}`)
  if (ingresos.status === 'rejected') avisos.push(`lo que entró (sin el margen bruto): ${mensaje(ingresos.reason)}`)
  return armarCostos({
    periodo,
    actual: actual.value,
    previo: previo.status === 'fulfilled' ? previo.value : null,
    hoy,
    avisos,
    nombreDeFeature: NOMBRE_DE_FEATURE,
    entradas: ingresos.status === 'fulfilled' ? ingresos.value.entradas : null,
  })
}

/**
 * El gasto de IA de MaKo por día (UTC) desde `desde` (YYYY-MM-DD), en UNA lectura: lo usa el margen bruto de Overview
 * (app/admin/_polar/datos/resumen-server.ts), que necesita varios meses. Cada día suma lo mismo que en esta pantalla (el
 * mismo `costoDe` de lib/costos-ia.ts). Si no se puede leer, sube el error: la tarjeta dice «No pude leer», nunca un 0%.
 */
export function leerGastoPorDia(desde: string): Promise<Corte[]> {
  return gastoPorDia(desde)
}

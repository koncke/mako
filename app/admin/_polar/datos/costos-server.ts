// =============================================================================
// La lectura de Admin › Analytics › Costs: el mes que se mira y el anterior (para comparar)
// =============================================================================
// ⚠️ CRUZA TODOS LOS NEGOCIOS: sólo el super admin (lo pregunta la página antes de llamar). `resumenDelPeriodo` pagina sin
//    el techo de 1000 filas (su cabecera). Si el mes que se mira no se puede leer, sube el error (la pantalla dice «No pude
//    leer»); si falla el anterior, se avisa y la pantalla sigue sin esas comparaciones. El gasto por negocio no se lee acá:
//    vive en Customers › Cost Drivers.
// ⚠️ LOS MESES DEL SELECTOR SE LEEN UNA VEZ (punto 33 de la revisión del 6/11/2026): `resumenDelPeriodo` ya no los pide solo
//    (eran dos lecturas de la tabla de uso por cada entrada, una por mes). Si no se pueden leer, el selector ofrece el mes
//    mirado y se avisa.
// Lo cobrado del mes (la tarjeta «AI margin», punto 12) sale de la misma vista de ingresos que Revenue (`leerIngresos`, con
//    `cache`). Si no se puede leer, se avisa y la tarjeta dice «–».

import 'server-only'
import { gastoPorDia, mesesConDatos, resumenDelPeriodo, type Corte } from '@/lib/costos-ia'
import { leerIngresos } from './clientes-server'
import { leerClientes } from './clientes-server'
import { fijoDeMartin } from '@/lib/costos-fijos'
import { economiaDelMes, type Economia } from '@/lib/economia-unitaria'
import { armarCostos, cobradoDelMes, mesAnterior, type VistaCostos } from './costos'

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function leerCostos(periodo: string, hoy = new Date()): Promise<VistaCostos> {
  const avisos: string[] = []
  const [actual, previo, meses, ingresos] = await Promise.allSettled([
    resumenDelPeriodo(periodo),
    resumenDelPeriodo(mesAnterior(periodo)),
    mesesConDatos({ estricto: true }),
    leerIngresos(),
  ])
  if (actual.status === 'rejected') throw actual.reason
  if (previo.status === 'rejected') avisos.push(`el mes anterior (sin comparaciones): ${mensaje(previo.reason)}`)
  if (meses.status === 'rejected') avisos.push(`los meses con gasto (el selector sólo ofrece éste): ${mensaje(meses.reason)}`)
  let cobrado: number | null = null
  if (ingresos.status === 'rejected') avisos.push(`los ingresos (sin el margen): ${mensaje(ingresos.reason)}`)
  else if (!ingresos.value.ok) avisos.push(`los ingresos (sin el margen): ${ingresos.value.error}`)
  else cobrado = cobradoDelMes(ingresos.value.datos.entradas, periodo)
  return armarCostos({
    periodo,
    actual: actual.value,
    previo: previo.status === 'fulfilled' ? previo.value : null,
    hoy: hoy.toISOString().slice(0, 10),
    mesesConDatos: meses.status === 'fulfilled' ? meses.value : [],
    cobrado,
    avisos,
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

/**
 * La economía por cliente del mes: lo VIVO (cuántos pagan y cuánto facturan) cruzado con el gasto
 * fijo DECLARADO (`lib/costos-fijos.ts`, que no se puede leer por API) y el gasto de IA del mes.
 *
 * ⚠️ Lo que no se pudo leer entra como `null` y sale como `null`: la pantalla dice «no pude leer»
 * en vez de un 0. Es la misma regla que el resto de esta pantalla — un 0 puede querer decir «no
 * tengo permiso», y ahí deja de ser un dato.
 *
 * ⚠️ Las pruebas NO cuentan como clientes: no facturan, y meterlas bajaría el fijo por cliente
 * fingiendo una escala que no existe.
 */
export async function leerEconomia(iaDelMesUsd: number | null): Promise<Economia> {
  const clientes = await leerClientes()
  if (!clientes.ok) {
    return economiaDelMes({
      clientesQuePagan: 0,
      mrrUsd: null,
      iaDelMesUsd,
      fijoMensualUsd: fijoDeMartin(),
    })
  }
  const pagan = clientes.datos.filas.filter((f) => !f.prueba && f.mrrUsd > 0)
  return economiaDelMes({
    clientesQuePagan: pagan.length,
    mrrUsd: pagan.reduce((a, f) => a + f.mrrUsd, 0),
    iaDelMesUsd,
    fijoMensualUsd: fijoDeMartin(),
  })
}

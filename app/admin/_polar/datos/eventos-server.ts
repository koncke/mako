// =============================================================================
// La lectura de Admin › Analytics › Events: los cinco lectores de siempre, juntos y sin que uno tumbe a los demás
// =============================================================================
// ⚠️ CRUZA TODOS LOS NEGOCIOS: sólo el super admin (lo pregunta la página antes de llamar). Cada lector que falla deja su
//    aviso y los demás siguen: «no pude leer los pagos» es otra cosa que «no hubo pagos», y la pantalla lo dice.
// Los topes de cada lector viven en su módulo; acá se pasan para que la pantalla diga qué quedó afuera (`cortes`).

import 'server-only'
import { vistaDeIngresos } from '@/lib/admin-ingresos'
import { vistaDeActividad } from '@/lib/actividad'
import { TOPE_REPORTES, vistaDeErrores } from '@/lib/admin-errores'
import { leerSesionesAgente } from '@/lib/agente-sesiones'
import { armarEventos, type EntradasEventos, type VistaEventos } from './eventos'

/** Lo que lee `vistaDeActividad` de actividad_acciones (su `.limit(100)`). */
export const TOPE_ACCIONES = 100
/** Las sesiones del agente que se leen (el default de `leerSesionesAgente`). */
export const TOPE_SESIONES = 200

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e))

export async function leerEventos(ahora = new Date()): Promise<VistaEventos> {
  const avisos: string[] = []
  const [ing, act, err, age] = await Promise.allSettled([
    vistaDeIngresos(ahora),
    vistaDeActividad(ahora),
    vistaDeErrores(),
    leerSesionesAgente(TOPE_SESIONES),
  ])

  let ingresos: EntradasEventos['ingresos'] = null
  if (ing.status === 'fulfilled') {
    ingresos = { entradas: ing.value.entradas, clientes: ing.value.clientes }
    avisos.push(...ing.value.avisos.map((a) => `Pagos: ${a}`))
  } else avisos.push(`No pude leer los pagos: ${mensaje(ing.reason)}`)

  let actividad: EntradasEventos['actividad'] = null
  if (act.status === 'fulfilled') {
    actividad = { acciones: act.value.acciones, nombres: act.value.nombres, personas: act.value.personas, medido: act.value.medido }
    avisos.push(...act.value.avisos.map((a) => `Acciones de MaKo: ${a}`))
  } else avisos.push(`No pude leer lo que hizo MaKo: ${mensaje(act.reason)}`)

  let errores: EntradasEventos['errores'] = null
  if (err.status === 'fulfilled') {
    errores = { errores: err.value.errores, hayMas: err.value.hayMas, reportes: err.value.reportes, nombres: err.value.nombres }
    avisos.push(...err.value.avisos.map((a) => `Errores: ${a}`))
  } else avisos.push(`No pude leer los errores: ${mensaje(err.reason)}`)

  let agente: EntradasEventos['agente'] = null
  if (age.status === 'fulfilled') {
    agente = { sesiones: age.value.sesiones, nombres: Object.fromEntries(age.value.nombreWs) }
  } else avisos.push(`No pude leer las sesiones del agente: ${mensaje(age.reason)}`)

  return armarEventos({
    ingresos, actividad, errores, agente, avisos, ahora,
    topes: { acciones: TOPE_ACCIONES, reportes: TOPE_REPORTES, sesiones: TOPE_SESIONES },
  })
}

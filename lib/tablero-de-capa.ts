// =============================================================================
// Qué tablero le toca a una CAPA
// =============================================================================
// Este producto tiene dos tableros con la misma pantalla y tablas distintas: el del
// super-admin de la agencia (`plan_tareas` + `plan_proyectos`) y el de cada cliente
// (`experimento_tareas` + `tarea_categorias`). Elegir mal no da error: da CERO FILAS,
// y eso se lee como «este cliente no tiene trabajo».
//
// ⚠️ VIVE ACÁ, SIN `server-only`, Y ES UNA LÍNEA A PROPÓSITO. El predicado estaba
// escrito DOS veces —`app/api/agente/plan/route.ts` y `lib/plan-propuesta.ts`, las dos
// como `(await getWorkspace(ws))?.capa === 'superadmin'`— y la versión que decide por
// SESIÓN (`tableroActual`) vive en un módulo con `server-only`, así que ningún test
// podía importar ninguna de las tres. Es la regla de la casa: la condición va en un
// módulo que se pueda testear, aunque sea de una línea — sobre todo si es de una línea,
// porque son las que se vuelven a escribir en vez de importarse.

/** Cuál de los dos tableros. Mismo tipo que `lib/tablero-actual.ts`. */
export type QueTablero = 'dueno' | 'cliente';

/**
 * El tablero de un workspace, a partir de su capa.
 *
 * ⚠️ EN POSITIVO: 'dueno' SÓLO para la capa de la plataforma. Escrito al revés («todos
 * menos los clientes») cualquier capa nueva nacería leyendo las tablas del dueño, que
 * para ella están vacías. Y una capa que no se reconoce cae a 'cliente', que es el caso
 * normal y el que no miente: de los 9 workspaces de producción, 8 son clientes.
 */
export const tableroDeCapa = (capa: string | null | undefined): QueTablero =>
  capa === 'superadmin' ? 'dueno' : 'cliente';

/** Las dos tablas de ese tablero, y la columna por la que una tarea nombra su proyecto. */
export function tablasDe(que: QueTablero): { tareas: string; proyectos: string; col: string } {
  return que === 'dueno'
    ? { tareas: 'plan_tareas', proyectos: 'plan_proyectos', col: 'labels' }
    : { tareas: 'experimento_tareas', proyectos: 'tarea_categorias', col: 'categorias' };
}

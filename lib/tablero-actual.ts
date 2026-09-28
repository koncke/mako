// =============================================================================
// tablero-actual — CUÁL de los dos tableros es el de quien está mirando
// =============================================================================
// Este producto tiene DOS tableros con la misma pantalla (`app/plan/board/BoardShell`)
// y tablas distintas:
//
//   · el del super-admin de la agencia  → `plan_tareas` + `plan_proyectos`
//   · el de cada cliente                → `experimento_tareas` + `tarea_categorias`
//
// La regla de cuál te toca vivía escrita UNA sola vez, adentro de `app/plan/page.tsx`,
// como un `redirect` — o sea que sólo la sabía la ruta que redirige. Cualquier otra
// pantalla que quisiera leer «el tablero» tenía que elegir una tabla a mano, y la que
// lo hizo eligió mal.
//
// ⚠️ EL BUG QUE ESTO CIERRA, MEDIDO EL 26/09/2026 CONTRA PRODUCCIÓN:
//
//     ws   experimento_tareas   tarea_categorias   plan_tareas   plan_proyectos
//      1         212                   19                0             0
//      9           0                    0              396            71   ← el super-admin
//     11          68                    9                0             0
//     13          19                    6                0             0
//
// Customer Success leía `experimento_tareas` SIEMPRE. En el workspace del super-admin
// —donde viven sus tres clientes— esa tabla tiene cero filas, así que su tab de clientes
// decía «sin trabajo suyo en el tablero» para los tres. No fallaba el cruce, ni los
// permisos, ni los datos: estaba leyendo la tabla vacía. Se reportó así: «no tengo forma
// de asignar proyectos o tareas a clientes».
//
// ⚠️ Y LA DECISIÓN ES LA MISMA QUE LA DE `/plan`, A PROPÓSITO. Si Customer Success
// eligiera con otro criterio, habría un workspace donde la tab muestra un tablero y el
// link «abrir en el tablero» lleva al otro.

import 'server-only';
import { getUsuarioActual } from './auth';
import { estaImpersonando, getWorkspace } from './workspace';
import { tableroDeCapa, type QueTablero as QueTableroPuro } from './tablero-de-capa';

/** Cuál de los dos tableros corresponde al workspace que se está mirando.
 *  ⚠️ Se RE-EXPORTA del módulo puro (`lib/tablero-de-capa.ts`) en vez de declararse acá:
 *  dos alias estructurales del mismo par de strings compilan igual y divergen el día
 *  que uno gane un tercer valor. */
export type QueTablero = QueTableroPuro;

/**
 * `dueno` = el super-admin de la agencia mirando SU workspace (no impersonando).
 * `cliente` = todo lo demás, incluido un admin que impersona a un cliente.
 *
 * Es literalmente la condición de `app/plan/page.tsx`, extraída para que no haya dos.
 * Un admin impersonando ve el tablero del cliente: Mauricio es un cliente más, no el
 * dueño (AGENTS.md, «OWNER_WS NO es la plataforma: es un cliente»).
 */
export async function tableroActual(): Promise<QueTablero> {
  const sesion = await getUsuarioActual();
  if (sesion?.rol === 'admin' && !(await estaImpersonando())) return 'dueno';
  return 'cliente';
}

/**
 * Cuál de los dos tableros le toca a UN WORKSPACE, mirándolo desde afuera.
 *
 * ⚠️ NO ES LO MISMO QUE `tableroActual()`, Y CONFUNDIRLAS ES EL BUG. Aquélla contesta
 * por QUIEN MIRA («soy el super-admin y no estoy impersonando») y por eso sirve para
 * la pantalla propia. Ésta contesta por el workspace MIRADO, que es lo que hace falta
 * cuando el super-admin abre la ficha de un cliente: envolver una lectura en
 * `runWithWorkspace(13, …)` NO cambia la sesión, así que `tableroActual()` adentro
 * sigue diciendo 'dueno' y se termina leyendo `plan_tareas` del ws13 — cero filas, sin
 * un solo error, y la ficha diciendo «no tiene trabajo». Es exactamente el bug del
 * 26/09/2026 con las tablas invertidas, servido por el otro lado.
 *
 * ⚠️ DECIDE POR LA CAPA, y eso está MEDIDO contra producción (28/09/2026):
 *
 *     ws  capa         experimento_tareas  plan_tareas
 *      1  completo            212               0
 *      9  superadmin            0             408   ← el único con capa superadmin
 *     11  completo             68               0
 *     13  agencia              19               0
 *     14  completo             13               0
 *
 * O sea: la capa `superadmin` y las tablas del dueño son el mismo conjunto de uno.
 * Se decide por la CAPA y no por el id porque el id cambia y la capa dice por qué.
 */
export async function tableroDeWorkspace(ws: number): Promise<QueTablero> {
  return tableroDeCapa((await getWorkspace(ws))?.capa);
}

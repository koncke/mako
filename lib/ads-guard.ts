// =============================================================================
// ads-guard — quién puede operar Ads Manager, y sobre QUÉ cuenta
// =============================================================================
// Se usa al inicio de cada handler:
//   `const no = await guardAdsWs(); if (no) return no;`
//
// Hasta la tarea #170 esto era `guardAdsDueno` y preguntaba «¿sos la agencia?»,
// porque lib/meta-ads-create.ts estaba cableado a la cuenta de Meta de Mauricio y
// dejar entrar a un cliente habría sido gastarle la plata a otro. Ese cableado se
// fue con la #170: ahora el token, la cuenta y la página salen de credWs por
// workspace, así que la pregunta correcta es «¿administrás ESTE workspace?».
// =============================================================================

import 'server-only';
import { getSesionAdmin } from './auth';
import { adminDeWorkspaceActual } from './workspace';

/** El super admin entró sin un negocio elegido: no hay cuenta de Meta sobre la que operar. */
const SIN_NEGOCIO = 'sin-negocio' as const;

/**
 * El workspace sobre el que esta sesión puede operar Ads Manager; `'sin-negocio'` si es el super
 * admin sin un negocio elegido; o null si no puede.
 *
 * En POSITIVO: pasa UNO, y nada más: el admin DE ESTE workspace (adminDeWorkspaceActual,
 * lib/workspace.ts), sea el admin del negocio o el super admin mirándolo con `?ws=`.
 *
 * ⚠️ EL SUPER ADMIN SIN NEGOCIO NO CAE AL ws1 (17/10/2026). Hasta ese día devolvía `OWNER_WS`: «el
 * admin de agencia sin workspace propio opera el ws1, como siempre». Ese contrato es de cuando MaKo
 * era el dashboard de la agencia de Mauricio. Hoy el ws1 es un CLIENTE con plata real, y Martín
 * abriendo /ads-manager sin el `?ws=` pausaba, represupuestaba o borraba campañas de Mauricio (y
 * veía su cuenta como si fuera «la» cuenta: `credWs` sin workspace también cae al ws1). Sin negocio
 * elegido no se opera nada: se pide elegirlo (tests/ads-guard-sin-negocio.test.ts).
 *
 * ⚠️ SIGUE EXIGIENDO ROL ADMIN, y eso no es un detalle heredado: con las
 * credenciales por workspace, el rol es LO ÚNICO que separa a un closer o un
 * setter de pausar, represupuestar y BORRAR campañas con plata puesta. Ese fue el
 * bug que cerró la auditoría #167 y no se vuelve a abrir. Nunca esWorkspaceDueno()
 * a secas, nunca sin rol.
 *
 * ⚠️ Y el ws sale SIEMPRE del request. Jamás del body ni del query: eso sería un
 * IDOR con la cuenta publicitaria de otro cliente del otro lado.
 */
async function wsQuePuedeOperar(): Promise<number | typeof SIN_NEGOCIO | null> {
  const admin = await adminDeWorkspaceActual();
  if (admin != null) return admin;
  // adminDeWorkspaceActual devuelve null por DOS motivos distintos —no es admin, o
  // es admin y no resolvió workspace—. El segundo, si es el super admin, se dice.
  return (await getSesionAdmin()) != null ? SIN_NEGOCIO : null;
}

/**
 * El workspace con el que opera esta sesión, o el 403 ya armado. Para las rutas que
 * además NECESITAN el número: /api/meta-write se lo pasa explícito a lib/meta-write,
 * que no puede deducirlo solo (ver ahí por qué el de la sesión no alcanza).
 */
export async function wsDeAdsManager(): Promise<number | Response> {
  const ws = await wsQuePuedeOperar();
  if (ws === SIN_NEGOCIO) return sinNegocio();
  return ws != null ? ws : sinPermiso();
}

/** null = puede seguir. Response = el 403 ya armado. */
export async function guardAdsWs(): Promise<Response | null> {
  const ws = await wsQuePuedeOperar();
  if (ws === SIN_NEGOCIO) return sinNegocio();
  return ws != null ? null : sinPermiso();
}

/** ¿El super admin está mirando el Ads Manager sin un negocio elegido? Para que la página lo diga. */
export async function adsSinNegocio(): Promise<boolean> {
  return (await wsQuePuedeOperar()) === SIN_NEGOCIO;
}

/** El super admin sin negocio: qué falta y dónde se elige. Nunca «no tienes permiso», que manda a buscar mal. */
function sinNegocio(): Response {
  return Response.json(
    {
      ok: false,
      error:
        'Elige primero el negocio cuyos anuncios quieres ver: sin un negocio elegido, MaKo no opera ' +
        'ninguna cuenta de Meta. Entra desde el panel de administración al negocio y vuelve a abrir Ads Manager.',
    },
    { status: 409 },
  );
}

/**
 * El texto dice QUÉ falta y descarta explícitamente la causa equivocada. Un 403 que
 * solo dice «no podés» sobre una pantalla de Ads Manager manda a revisar la cuenta
 * de Meta, que es el lugar donde el problema no está — eso ya costó una sesión
 * entera de diagnóstico el 05/09/2026.
 */
function sinPermiso(): Response {
  return Response.json(
    {
      ok: false,
      error:
        'Ads Manager lo maneja quien administra este espacio de trabajo. Tu usuario no tiene ' +
        'ese rol aquí, así que no puede crear ni modificar campañas. No es un problema de tu ' +
        'cuenta de Meta ni de tu pixel: pídeselo a quien administra tu cuenta.',
    },
    { status: 403 },
  );
}

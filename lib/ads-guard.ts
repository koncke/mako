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
import { adminDeWorkspaceActual, OWNER_WS } from './workspace';

/**
 * El workspace sobre el que esta sesión puede operar Ads Manager, o null.
 *
 * En POSITIVO: nombra lo que PASA, no lo que se excluye. Pasan dos, y nada más:
 *   · el admin DE ESTE workspace (adminDeWorkspaceActual, lib/workspace.ts:192);
 *   · el admin de AGENCIA sin workspace propio → la cuenta del dueño, que es el
 *     contrato de siempre y el único `null` que sigue pasando.
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
async function wsQuePuedeOperar(): Promise<number | null> {
  const admin = await adminDeWorkspaceActual();
  if (admin != null) return admin;
  // adminDeWorkspaceActual devuelve null por DOS motivos distintos —no es admin, o
  // es admin y no resolvió workspace— y desde afuera no se distinguen. El de
  // agencia sin workspace administra la cuenta del dueño, como siempre.
  return (await getSesionAdmin()) != null ? OWNER_WS : null;
}

/**
 * null = puede seguir. Response = el 403 ya armado.
 *
 * El texto dice QUÉ falta y descarta explícitamente la causa equivocada. Un 403 que
 * solo dice «no podés» sobre una pantalla de Ads Manager manda a revisar la cuenta
 * de Meta, que es el lugar donde el problema no está — eso ya costó una sesión
 * entera de diagnóstico el 05/09/2026.
 */
export async function guardAdsWs(): Promise<Response | null> {
  if ((await wsQuePuedeOperar()) != null) return null;
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

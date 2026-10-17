// =============================================================================
// sesion-accion — el corte de sesión PROPIO de una server action
// =============================================================================
// Una server action es un endpoint POST con un id que viaja en el bundle: cualquiera que lo
// conozca la puede llamar. Hasta el 17/10/2026, 83 de las 145 acciones de app/crm (las 46 de
// app/crm/actions.ts entre ellas) no miraban la sesión: las cubría SÓLO el proxy, que valida la
// firma de la cookie con cripto pura y sin tocar la base —la cookie de un usuario suspendido sigue
// siendo válida hasta 30 días—. Y sin sesión resuelta, `getWorkspaceActual()` cae al ws1, que es
// Mauricio, un cliente. Una red que depende enteramente de otra red no es una red.
//
// `exigirSesion()` va como PRIMERA línea de la acción y TIRA: las acciones devuelven tipos muy
// distintos, y tirar es lo único uniforme. Sólo le pasa a quien no tiene una sesión válida contra
// la base (suspendido, borrado, firma vencida, el alumno de un curso), que de todos modos tiene
// que volver a entrar. `getRolWsEfectivo` está cacheada por request: no cuesta una query más.
//
// El guard que lo exige en TODA acción de app/crm: tests/crm-acciones-sesion.test.ts.
// =============================================================================

import 'server-only';
import { getRolWsEfectivo } from './workspace';

export const SIN_SESION = 'Tu sesión no está activa en este negocio. Vuelve a iniciar sesión.';

/** Tira si el pedido no trae una sesión válida contra la base. */
export async function exigirSesion(): Promise<void> {
  let rol: Awaited<ReturnType<typeof getRolWsEfectivo>> = null;
  try { rol = await getRolWsEfectivo(); } catch { rol = null; }
  if (rol == null) throw new Error(SIN_SESION);
}

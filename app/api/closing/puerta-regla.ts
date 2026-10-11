// =============================================================================
// puerta-regla — quién puede usar las rutas de Closing (la regla, pura y con test)
// =============================================================================
// Decisión 6 de Martín (11/10/2026): Closing va COMPLETO al Dashboard, y sus tareas (sincronizar,
// re-analizar, revisar a mano, re-evaluar con MaKo) quedan para el admin y el closer, «como hoy en
// /closing; un setter no». Hasta ese día las rutas sólo pedían sesión y Fathom: un setter podía gastar IA
// con un `fetch` a mano.
//
// La regla vive acá, sin server-only, para que tests/graficos-closing.test.ts la pruebe con cada rol;
// ./puerta.ts junta los datos (sesión, capa, Fathom) y la aplica. Se escribe EN POSITIVO: entra el admin y
// el closer, y nadie más (un rol nuevo no entra por olvido).
//
// ⚠️ NO la usa /api/closing/analizar-lead: ésa la dispara el CRM (la ficha del lead) y tiene su propia
//    regla (decisión de otra corrida). Sumarle esta puerta le cerraría el botón a quien hoy lo usa.

/** Por qué no entra, con su código HTTP. `null` = entra. */
export type Cierre = { status: number; error: string } | null;

export const ROLES_CLOSING: readonly string[] = ['admin', 'closer'];

/**
 * @param rol            el rol EFECTIVO en el workspace (getRolWsEfectivo); null = sin sesión.
 * @param dashboardEnCapa ¿la capa del workspace tiene la tab Dashboard (`graphics`)? Es donde vive Closing.
 * @param fathom         ¿Fathom está conectado? `null` = esta ruta no lo exige acá (el transcript contesta
 *                       vacío sin Fathom, y eso lo decide su ruta).
 */
export function reglaDePuerta(rol: string | null | undefined, dashboardEnCapa: boolean, fathom: boolean | null): Cierre {
  if (rol == null) return { status: 401, error: 'Sin sesión: vuelve a entrar' };
  if (!ROLES_CLOSING.includes(rol)) return { status: 403, error: 'Sólo el admin de la cuenta o un closer' };
  // 404 y no 403: a quien no le corresponde, la pantalla no existe (AGENTS.md).
  if (!dashboardEnCapa) return { status: 404, error: 'No existe' };
  if (fathom === false) return { status: 403, error: 'Conecta Fathom en Integraciones' };
  return null;
}

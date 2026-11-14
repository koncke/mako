// =============================================================================
// editor-landing/replicar-candado — copiar la landing de otro negocio es SÓLO de MaKo Pro (14/11/2026)
// =============================================================================
// Martín: «Copiar páginas de la competencia… Eso no lo puede hacer el de 47, sí lo puede hacer el de 97» (lib/topes-plan.ts,
// `FUNCIONES_SOLO_PRO`, 'replicar-landing'). Lo frena CADA puerta que copia una página de afuera, no la pantalla:
//   · `replicar()` (./replicar.ts) y `leerParaReplicar()` (./replicar-lectura.ts), lo primero que hacen: cualquiera que las
//     llame (hoy, las dos rutas y la API de MaKo; mañana, la que se sume) queda con el candado;
//   · las rutas de la pantalla (app/api/landing-generator/replicar y ./leer): 403 con `pasarAPro`, como el scraper
//     (app/crm/grupo-wa-actions.ts, `candadoDePro`);
//   · el esquema `modo: 'importar'` de app/api/landing-generator/ia (baja una página de afuera y arma su esquema: es la
//     puerta vieja de Replicar, que la pantalla ya no usa pero la ruta sigue atendiendo);
//   · la operación `replicar_landing` de la API de MaKo (lib/api-mako/areas/landing.run.ts), al proponer y al ejecutar.
// La pantalla (Replicar, la caja de crear, «Copiar su sitio» de Competitor Spy) muestra el candado, pero no es la defensa.
// ⚠️ ANTE LA DUDA, SE DEJA PASAR (lib/plan-esencial.ts): si no se puede leer el plan, no hay candado.
// =============================================================================

import 'server-only';
import { getWorkspaceActual, rutaConWs } from '../workspace';
import { esEsencialDe, esEsencialDeLaSesion } from '../plan-esencial';
import { RUTA_CAMBIAR_PLAN, textoSoloPro } from '../topes-plan';

/**
 * El texto del candado si el negocio paga MaKo Esencial, o null. `ws`: el negocio (la API de MaKo pasa `ctx.ws`); sin él, el
 * del pedido (la sesión, o el `runWithWorkspace` de la API). Nunca tira: si no se puede leer, null.
 */
export async function candadoDeReplicar(ws?: number | null): Promise<string | null> {
  try {
    const w = ws === undefined ? await getWorkspaceActual() : ws;
    return w != null && (await esEsencialDe(w)) ? textoSoloPro('replicar-landing') : null;
  } catch {
    return null;
  }
}

/** El de las rutas de la pantalla: el texto y a dónde lleva «Pasar a Pro» (la forma de `candadoDePro` del scraper). */
export async function candadoDeReplicarEnPantalla(): Promise<{ error: string; pasarAPro: string } | null> {
  if (!(await esEsencialDeLaSesion())) return null;
  return { error: textoSoloPro('replicar-landing'), pasarAPro: await rutaConWs(RUTA_CAMBIAR_PLAN) };
}

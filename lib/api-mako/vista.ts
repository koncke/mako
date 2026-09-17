// =============================================================================
// api-mako/vista — con qué mira el registro quien pide: canal, alcance, rol y capa
// =============================================================================
// Vive aparte de ejecutar.ts porque lo usan DOS momentos distintos y los dos tienen
// que contestar igual: al PROPONER (ejecutar.ts decide si la operación existe para
// quien la pide) y al CONFIRMAR (acciones.ts vuelve a mirar el gating antes de
// ejecutar). Si viviera en ejecutar.ts, acciones.ts tendría que importarlo de ahí y
// ejecutar.ts ya importa acciones.ts: un ciclo.
//
// La capa sale del WORKSPACE (lib/capas.ts), nunca de la sesión: por HTTP no hay
// sesión, y un cliente `pm` no tiene CRM venga por donde venga.
// =============================================================================

import 'server-only';
import { getWorkspace } from '@/lib/workspace';
import { tabsDeCapa, type Vista } from './registro';
import type { Ctx } from './tipos';

export async function vistaDe(ctx: Ctx): Promise<Vista> {
  let tabs: readonly string[] | null;
  try {
    const w = await getWorkspace(ctx.ws);
    tabs = tabsDeCapa(w?.capa ?? 'completo');
  } catch (err) {
    // FAIL-CLOSED. Antes un error dejaba `tabs = null`, que significa «ve todo»: con
    // la base lenta, un cliente `pm` veía el CRM y las bandejas de otras capas. Sin
    // capa no se sabe qué tabs compró, así que no ve ninguna operación con tab.
    console.error(`[api-mako] no pude leer la capa del ws ${ctx.ws}; la vista queda sin tabs:`, err instanceof Error ? err.message : err);
    tabs = [];
  }
  return { canal: ctx.canal, alcance: ctx.alcance, ws: ctx.ws, rol: ctx.rol, tabs };
}

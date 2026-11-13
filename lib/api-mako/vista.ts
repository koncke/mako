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
import { puedeVerKey } from '@/lib/movil-rutas';
import { tabsDeCapa, tabsDelRegistro, type Vista } from './registro';
import type { Ctx } from './tipos';

export async function vistaDe(ctx: Ctx): Promise<Vista> {
  let tabs: readonly string[] | null;
  let plataforma = false;
  let capa: string | null = null;
  try {
    const w = await getWorkspace(ctx.ws);
    capa = w?.capa ?? 'completo';
    tabs = tabsDeCapa(capa);
    // La plataforma se resuelve por CAPA, como `wsSuperAdmin()`, nunca por número.
    plataforma = w?.capa === 'superadmin';
  } catch (err) {
    // FAIL-CLOSED. Antes un error dejaba `tabs = null`, que significa «ve todo»: con
    // la base lenta, un cliente `pm` veía el CRM y las bandejas de otras capas. Sin
    // capa no se sabe qué tabs compró, así que no ve ninguna operación con tab.
    console.error(`[api-mako] no pude leer la capa del ws ${ctx.ws}; la vista queda sin tabs:`, err instanceof Error ? err.message : err);
    tabs = [];
  }
  // EL EQUIPO EN EL GRUPO DE LA APP (13/11/2026, el Cerebro: «nunca más de lo que su rol ve en pantalla»): sólo las pestañas que la app le muestra a ESE rol con ESTA
  // capa, con la misma regla de la barra (`puedeVerKey`, lib/movil-rutas.ts). Sin capa leída, ninguna. Y siempre como 'miembro': lo de quien administra no existe.
  if (ctx.rolWs) {
    const rolWs = ctx.rolWs;
    const soloTabs = capa == null ? [] : tabsDelRegistro().filter((t) => puedeVerKey(t, rolWs, capa));
    return { canal: ctx.canal, alcance: ctx.alcance, ws: ctx.ws, rol: 'miembro', tabs, plataforma, soloTabs, ...(ctx.permisos ? { permisos: ctx.permisos } : {}) };
  }
  return { canal: ctx.canal, alcance: ctx.alcance, ws: ctx.ws, rol: ctx.rol, tabs, plataforma, ...(ctx.permisos ? { permisos: ctx.permisos } : {}) };
}

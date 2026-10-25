// =============================================================================
// plan-esencial — ¿el negocio paga MaKo Esencial por la pasarela? (23/10/2026)
// =============================================================================
// La regla está en lib/plan-esencial-reglas.ts (pura). Esto la lee contra la base: el de la sesión (una vez por request) y
// el de un negocio dado (para lo que corre sin sesión, como MaKo por WhatsApp).
// ⚠️ ANTE LA DUDA, NO HAY CANDADO NI TOPE: si no se puede leer la suscripción, se deja pasar. Sacarle una tab a quien paga es
//    peor que dejarle ver una de más un rato (lo pidió el Cerebro, 23/10/2026: «que nunca un cliente que paga Pro… pierda una
//    tab»).
import 'server-only';
import { cache } from 'react';
import { getCapaActual, getWorkspaceActual, wsSuperAdmin } from './workspace';
import { getSupabaseServer } from './supabase';
import { esEsencialPorPasarela } from './plan-esencial-reglas';
import { FILTRO_SUSCRIPCION_DE_MAKO } from './prueba-plan-reglas';

/** El negocio `ws`, con la capa que tiene hoy (si se sabe; si no, se lee). */
export async function esEsencialDe(ws: number, capaDeHoy?: string | null): Promise<boolean> {
  try {
    const plataforma = await wsSuperAdmin();
    let capa = capaDeHoy;
    if (capa === undefined) {
      const { data } = await getSupabaseServer().from('workspaces').select('capa').eq('id', ws).maybeSingle();
      capa = (data as { capa?: string } | null)?.capa ?? null;
    }
    // Lo barato primero: sin capa `completo`, o el ws1 o la plataforma, no hace falta leer cobros.
    if (!esEsencialPorPasarela({ ws, wsPlataforma: plataforma, capa, capaVendida: 'completo' })) return false;
    // La MISMA lectura que `suscripcionDeMakoDe` (lib/cobros.ts: su suscripción pagada más reciente, en la plataforma), sin
    // importar el módulo: lib/cobros alcanza una IA en su grafo, y esto lo importan /api/auth/me y todas las páginas
    // (tests/d6b-rutas.test.ts). tests/plan-esencial.test.ts ata los filtros de las dos.
    // Con la PRUEBA GRATIS autorizada (25/10/2026): el negocio en prueba tiene los topes de su plan desde el primer día.
    const { data, error } = await getSupabaseServer().from('cobros').select('alta_capa')
      .eq('workspace_id', plataforma).eq('alta_ws', ws).eq('tipo', 'suscripcion').or(FILTRO_SUSCRIPCION_DE_MAKO)
      .order('pagado_at', { ascending: false, nullsFirst: false }).order('id', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    const capaVendida = (data as { alta_capa?: string | null } | null)?.alta_capa ?? null;
    return esEsencialPorPasarela({ ws, wsPlataforma: plataforma, capa, capaVendida });
  } catch (e) {
    console.warn(`[plan-esencial] no pude leer el plan del negocio ${ws}; sin candado:`, e instanceof Error ? e.message : String(e));
    return false;
  }
}

export const esEsencialDeLaSesion = cache(async (): Promise<boolean> => {
  try {
    const ws = await getWorkspaceActual();
    return ws == null ? false : await esEsencialDe(ws, await getCapaActual());
  } catch {
    return false;
  }
});

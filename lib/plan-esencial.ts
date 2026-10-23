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
    // Recién acá, y por import dinámico: lib/cobros.ts es pesado y lo importan todas las páginas a través de tab-access.
    const { suscripcionDeMakoDe } = await import('./cobros');
    const s = await suscripcionDeMakoDe(ws);
    return esEsencialPorPasarela({ ws, wsPlataforma: plataforma, capa, capaVendida: s?.alta_capa ?? null });
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

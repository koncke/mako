// =============================================================================
// plan-esencial — ¿el negocio de ESTA sesión paga MaKo Esencial por la pasarela? (23/10/2026)
// =============================================================================
// La regla está en lib/plan-esencial-reglas.ts (pura). Esto la lee contra la base, una vez por request.
// ⚠️ ANTE LA DUDA, NO HAY CANDADO: si no se puede leer la suscripción, se deja pasar. Sacarle una tab a quien paga es peor que
//    dejarle ver una de más un rato (lo pidió el Cerebro, 23/10/2026: «que nunca un cliente que paga Pro… pierda una tab»).
import 'server-only';
import { cache } from 'react';
import { getCapaActual, getWorkspaceActual, wsSuperAdmin } from './workspace';
import { esEsencialPorPasarela } from './plan-esencial-reglas';

export const esEsencialDeLaSesion = cache(async (): Promise<boolean> => {
  try {
    const ws = await getWorkspaceActual();
    if (ws == null) return false;
    const [plataforma, capa] = await Promise.all([wsSuperAdmin(), getCapaActual()]);
    if (!esEsencialPorPasarela({ ws, wsPlataforma: plataforma, capa, capaVendida: 'completo' })) return false;
    // Recién acá, y por import dinámico: lib/cobros.ts es pesado y lo importan todas las páginas a través de tab-access.
    const { suscripcionDeMakoDe } = await import('./cobros');
    const s = await suscripcionDeMakoDe(ws);
    return esEsencialPorPasarela({ ws, wsPlataforma: plataforma, capa, capaVendida: s?.alta_capa ?? null });
  } catch (e) {
    console.warn('[plan-esencial] no pude leer el plan; sin candado:', e instanceof Error ? e.message : String(e));
    return false;
  }
});

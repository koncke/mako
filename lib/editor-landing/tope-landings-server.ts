import 'server-only';

// =============================================================================
// El tope del plan en Web Generator, con la base (la regla pura: tope-landings.ts)
// =============================================================================
// Lo llaman `publicar` (publicar.ts) y `conectarDominio` (dominios.ts) ANTES de crear: si no cabe, devuelven el
// cartel (`textoTope`) con status 402 y la pantalla ofrece «Pasar a Pro» (RUTA_CAMBIAR_PLAN). Si no se puede leer el
// plan, deja pasar (AGENTS.md, «Hacer cumplir un tope del plan»).
// =============================================================================

import { getSupabaseServer } from '../supabase';
import { getWorkspace, wsSuperAdmin } from '../workspace';
import { suscripcionDeMakoDe } from '../cobros';
import { topeParaDominio, topeParaPublicar } from './tope-landings';
import { falla, type FallaHttp } from './server';

/** null = puede; si no, la falla con el cartel del tope. `cual`: publicar una landing o conectarle un dominio. */
export async function frenoDeTope(ws: number, cual: 'publicar' | 'dominio', yaCuenta: boolean): Promise<FallaHttp | null> {
  if (yaCuenta) return null;
  try {
    const [w, plataforma, sus] = await Promise.all([getWorkspace(ws), wsSuperAdmin(), suscripcionDeMakoDe(ws)]);
    if (!w || sus == null) return null;
    let q = getSupabaseServer().from('landing_docs').select('id', { count: 'exact', head: true }).eq('workspace_id', ws).is('papelera_at', null);
    q = cual === 'publicar' ? q.not('publicado', 'is', null) : q.not('dominio', 'is', null);
    const { count, error } = await q;
    if (error) return null;
    const pedido = { ws, wsPlataforma: plataforma, capa: String(w.capa ?? ''), cobradoPorPasarela: true, usadas: count ?? 0, yaCuenta };
    const r = cual === 'publicar' ? topeParaPublicar(pedido) : topeParaDominio(pedido);
    return r.ok ? null : falla(r.texto, 402);
  } catch {
    return null;
  }
}

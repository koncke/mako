// =============================================================================
// /ads-analyst/guiones — lista completa de guiones (ruta "ver todos")
// =============================================================================
// La tab /ads-analyst previsualiza 6 guiones; esta ruta muestra los N con el
// mismo toggle tabla/tarjetas y el modal de embudo. Solo lee.
// =============================================================================

import { getScriptAnalystView, type ScriptAnalystView } from '@/lib/ads-analyst';
import { getAngles, DEFAULT_ANGLES, type Angle } from '@/lib/script-angles';
import { getAvatares, type Avatar } from '@/lib/script-avatares';
import { requireRolWs } from '@/lib/tab-access';
import { GuionesFull } from '../ScriptsBrowser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

const EMPTY: ScriptAnalystView = {
  scripts: [],
  counts: { enVista: 0, analizadas: 0, pendientes: 0, descartadas: 0, sinTranscript: 0, errores: 0, total: 0 },
  lastSync: null,
};

export default async function GuionesPage() {
  await requireRolWs([], { nav: 'script' }); // solo admin-cliente/agencia; closer/setter → /leads
  let data: ScriptAnalystView = EMPTY;
  let errorMsg: string | null = null;
  let angles: Angle[] = DEFAULT_ANGLES;
  let avatares: Avatar[] = [];
  try {
    data = await getScriptAnalystView();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }
  try {
    [angles, avatares] = await Promise.all([getAngles(), getAvatares()]);
  } catch { /* si falla, ángulos default y sin avatares */ }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 70px' }}>
      <header style={{ marginBottom: 22 }}>
        <a href="/ads-analyst" style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.06em', color: 'var(--faint)', textDecoration: 'none' }}>← Ads Analyst</a>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 13, marginTop: 8 }}>
          <h1 style={{ fontWeight: 600, fontSize: 40, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Todos los guiones</h1>
          <span style={{ fontSize: 15, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{data.scripts.length}</span>
        </div>
      </header>

      {errorMsg ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '32px', fontSize: 14, color: 'var(--dim)' }}>
          No se pudo leer la base (en local faltan las claves de Supabase). Los datos se ven en el deploy.
        </div>
      ) : data.scripts.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '32px', fontSize: 14, color: 'var(--dim)' }}>
          Todavía no hay guiones analizados. Sincronizá desde la tab de Ads Analyst.
        </div>
      ) : (
        <GuionesFull scripts={data.scripts} angles={angles} avatares={avatares} />
      )}
    </main>
  );
}

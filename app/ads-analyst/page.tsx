// =============================================================================
// /ads-analyst — Ads Analyst
// =============================================================================
// Analiza los GUIONES de los video ads: cruza el análisis cualitativo de Claude
// (ángulo, gancho, beats, diagnóstico — guardado en script_analyses) con las
// métricas de Meta×CRM de TODO el histórico del anuncio (spend, hook rate,
// retención por cuartiles, agendas, cierres, frecuencia). Sin filtro de fecha:
// un guion se juzga por su desempeño acumulado, no por un período.
//
// La data cualitativa la llena /api/ads-analyst/sync + el cron, después de
// que transcribe-ads haya generado los transcripts. La página solo lee.
// =============================================================================

import { getScriptAnalystView, getDrafts, type ScriptAnalystView, type ScriptDraft } from '@/lib/ads-analyst';
import { getAngles, DEFAULT_ANGLES, type Angle } from '@/lib/script-angles';
import { getAvatares, type Avatar } from '@/lib/script-avatares';
import { ScriptsBrowser } from './ScriptsBrowser';
import { Icon } from '../_components/icons';
import { requireRolWs } from '@/lib/tab-access';
import { integracionConectada } from '@/lib/credenciales';
import { PanelActivacion } from '../_components/PanelActivacion';
import { tabActivacion } from '@/lib/tab-activacion';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

const EMPTY: ScriptAnalystView = {
  scripts: [],
  counts: { enVista: 0, analizadas: 0, pendientes: 0, descartadas: 0, sinTranscript: 0, errores: 0, total: 0 },
  lastSync: null,
};

export default async function ScriptAnalystPage() {
  await requireRolWs([], { nav: 'script' });

  const tabScript = tabActivacion('script');
  if (tabScript && !(await integracionConectada('meta'))) return <PanelActivacion tab={tabScript} />;
  let data: ScriptAnalystView = EMPTY;
  let errorMsg: string | null = null;
  let drafts: ScriptDraft[] = [];
  let angles: Angle[] = DEFAULT_ANGLES;
  let avatares: Avatar[] = [];
  try {
    data = await getScriptAnalystView();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }
  try {
    drafts = await getDrafts();
  } catch { /* el historial no es crítico para la vista */ }
  try {
    [angles, avatares] = await Promise.all([getAngles(), getAvatares()]);
  } catch { /* si falla, ángulos default y sin avatares */ }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 70px' }}>
      <header style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
          Ads Analyst · histórico completo
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', color: 'var(--accent)' }}><Icon name="notepencil" size={34} /></span>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Ads Analyst</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)', fontSize: 12.5, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)' }} />Meta Ads
          </span>
        </div>
      </header>

      <ScriptsBrowser data={data} errorMsg={errorMsg} drafts={drafts} angles={angles} avatares={avatares} />
    </main>
  );
}

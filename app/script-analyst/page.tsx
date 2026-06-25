// =============================================================================
// /script-analyst — Scripts Analyst
// =============================================================================
// Analiza los GUIONES de los video ads: cruza el análisis cualitativo de Claude
// (ángulo, gancho, beats, diagnóstico — guardado en script_analyses) con las
// métricas vivas de Meta×CRM (spend, hook rate, retención por cuartiles, agendas,
// cierres, frecuencia). La página solo lee; el componente cliente dispara el sync
// y muestra los patrones, el cuadrante de retención y el embudo por guion.
//
// La data cualitativa la llena /api/script-analyst/sync + el cron script-analyst
// -sync, después de que transcribe-ads haya generado los transcripts.
// =============================================================================

import { getScriptAnalystView, type ScriptAnalystView } from '@/lib/script-analyst';
import { ayerEnTijuana, hoyEnTijuana, esFechaValida, primerDiaDelMesDeFecha, fmtDDMMYYYY } from '@/lib/date-utils';
import { FechaFiltro } from '../_components/FechaFiltro';
import { ScriptsBrowser } from './ScriptsBrowser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

const EMPTY: ScriptAnalystView = {
  scripts: [],
  counts: { enVista: 0, analizadas: 0, pendientes: 0, descartadas: 0, sinTranscript: 0, errores: 0, total: 0 },
  lastSync: null,
};

function fmtPeriodoLabel(desde: string, hasta: string): string {
  return `${fmtDDMMYYYY(desde)} – ${fmtDDMMYYYY(hasta)}`;
}

export default async function ScriptAnalystPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const ayerReal = ayerEnTijuana();
  const hoyReal = hoyEnTijuana();
  const params = await searchParams;
  const desdeParam = params.desde;
  const hastaParam = params.hasta;
  const filtroActivo =
    !!desdeParam && !!hastaParam && esFechaValida(desdeParam) && esFechaValida(hastaParam) &&
    desdeParam <= hastaParam && hastaParam <= hoyReal;

  const rangoDesde = filtroActivo ? desdeParam! : primerDiaDelMesDeFecha(ayerReal);
  const rangoHasta = filtroActivo ? hastaParam! : ayerReal;

  let data: ScriptAnalystView = EMPTY;
  let errorMsg: string | null = null;
  try {
    data = await getScriptAnalystView(rangoDesde, rangoHasta);
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 70px' }}>
      <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap', marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
            Script Analyst · {fmtPeriodoLabel(rangoDesde, rangoHasta)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
            <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Scripts Analyst</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)', fontSize: 12.5, fontWeight: 600 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)' }} />Meta Ads
            </span>
          </div>
        </div>
        <FechaFiltro hoyReal={hoyReal} />
      </header>

      <ScriptsBrowser data={data} errorMsg={errorMsg} />
    </main>
  );
}

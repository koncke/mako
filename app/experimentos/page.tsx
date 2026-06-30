// =============================================================================
// /experimentos — la única vista con verdades, y con datos
// =============================================================================
// Convierte hipótesis (lenguaje natural) en experimentos medibles contra el
// funnel real, los mide en vivo y, al cerrar, deja un aprendizaje respaldado por
// el dato. Es el único lugar del dashboard donde el sistema declara verdades; en
// el resto, MaKo sugiere abrir un experimento en vez de concluir.
//
// La data vive en `experimentos` (migración 0047). Esta página solo lee la vista
// inicial (resiliente: si Supabase no está, arranca vacía); el componente cliente
// dispara sugerencias, arranques y cierres.
// =============================================================================

import { getExperimentosView, type ExperimentosView } from '@/lib/experimentos';
import { ExperimentosBrowser } from './ExperimentosBrowser';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

const EMPTY: ExperimentosView = {
  activos: [],
  propuestos: [],
  aprendizajes: [],
  descartados: [],
  counts: { activos: 0, propuestos: 0, cerrados: 0, validadas: 0 },
};

export default async function ExperimentosPage() {
  let data: ExperimentosView = EMPTY;
  let errorMsg: string | null = null;
  try {
    data = await getExperimentosView();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
  }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 70px' }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
          Experimentos · la única verdad, con datos
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13, flexWrap: 'wrap' }}>
          <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Experimentos</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 11px', borderRadius: 999, background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)', fontSize: 12.5, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--good)' }} />Funnel real
          </span>
        </div>
        <p style={{ marginTop: 10, fontSize: 15, color: 'var(--dim)', maxWidth: 720, lineHeight: 1.55 }}>
          En todo el dashboard MaKo te <strong>sugiere</strong> qué probar — nunca te da una conclusión.
          Acá una hipótesis se vuelve una prueba medible, se sigue contra el dato real y, al cerrar,
          queda una <strong>verdad de tu negocio</strong>.
        </p>
      </header>

      <ExperimentosBrowser data={data} errorMsg={errorMsg} />
    </main>
  );
}

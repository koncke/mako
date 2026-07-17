// =============================================================================
// /experimentos — la única vista con verdades, y con datos
// =============================================================================
// Tres tabs: Retro · Experiments · Conclusions.
//   Retro        → MaKo lee el funnel + experimentos + conclusiones + tareas de un
//                  período y deja un reporte + un plan (probá esto / hacé esto).
//   Experiments  → hipótesis → prueba medible contra el dato real → cierre.
//   Conclusions  → las verdades validadas (aprendizajes cerrados con dato).
// El tablero To-do vive en su propia ruta /todo.
//
// En el resto del dashboard MaKo sugiere abrir un experimento; solo acá se
// declaran verdades. La página solo lee (resiliente: en local sin Supabase cae a
// datos DEMO en desarrollo; en producción, dato real).
// =============================================================================

import { getExperimentosView, type ExperimentosView } from '@/lib/experimentos';
import { listRetros, type Retro } from '@/lib/retro';
import { ExperimentosApp } from './ExperimentosApp';
import { requireRolWs } from '@/lib/tab-access';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EMPTY_VIEW: ExperimentosView = {
  activos: [], propuestos: [], aprendizajes: [], descartados: [],
  counts: { activos: 0, propuestos: 0, cerrados: 0, validadas: 0 },
};

export default async function ExperimentosPage() {
  await requireRolWs([], { nav: 'experimentos' });
  let view: ExperimentosView = EMPTY_VIEW;
  let retros: Retro[] = [];
  let errorMsg: string | null = null;
  let dbDown = false;

  try { view = await getExperimentosView(); } catch (err) { errorMsg = err instanceof Error ? err.message : String(err); dbDown = true; }
  try { retros = await listRetros(); } catch { /* tab Retro arranca vacía */ }

  let demo = false;
  if (dbDown && process.env.NODE_ENV !== 'production') {
    const d = await import('./_demo');
    view = d.demoView; retros = d.demoRetros; demo = true; errorMsg = null;
  }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 70px' }}>
      <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: '0 0 22px', color: 'var(--ink)' }}>Experiments</h1>
      <ExperimentosApp exp={view} retros={retros} errorMsg={errorMsg} demo={demo} />
    </main>
  );
}

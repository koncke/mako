// =============================================================================
// /experimentos — la única vista con verdades, y con datos
// =============================================================================
// Cuatro tabs: Retro · Experiments · To-do · Conclusions.
//   Retro        → MaKo lee el funnel + experimentos + conclusiones + tareas del
//                  período y deja un reporte + un plan (probá esto / hacé esto).
//   Experiments  → hipótesis → prueba medible contra el dato real → cierre.
//   To-do        → tablero kanban de las tareas a ejecutar.
//   Conclusions  → las verdades validadas (aprendizajes cerrados con dato).
//
// En el resto del dashboard MaKo sugiere abrir un experimento; solo acá se
// declaran verdades. La página solo lee (resiliente: en local sin Supabase cae a
// datos DEMO en desarrollo para poder ver el diseño; en producción, dato real).
// =============================================================================

import { getExperimentosView, type ExperimentosView } from '@/lib/experimentos';
import { listRetros, type Retro } from '@/lib/retro';
import { listTareas, type Tarea } from '@/lib/todo';
import { ExperimentosApp } from './ExperimentosApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

const EMPTY_VIEW: ExperimentosView = {
  activos: [], propuestos: [], aprendizajes: [], descartados: [],
  counts: { activos: 0, propuestos: 0, cerrados: 0, validadas: 0 },
};

export default async function ExperimentosPage() {
  let view: ExperimentosView = EMPTY_VIEW;
  let retros: Retro[] = [];
  let tareas: Tarea[] = [];
  let errorMsg: string | null = null;
  let dbDown = false;

  try { view = await getExperimentosView(); } catch (err) { errorMsg = err instanceof Error ? err.message : String(err); dbDown = true; }
  try { retros = await listRetros(); } catch { /* tab Retro arranca vacía */ }
  try { tareas = await listTareas(); } catch { /* tab To-do arranca vacía */ }

  // En local (sin Supabase) mostramos datos DEMO para poder ver e iterar el
  // diseño. En producción esto nunca corre (NODE_ENV === 'production').
  let demo = false;
  if (dbDown && process.env.NODE_ENV !== 'production') {
    const d = await import('./_demo');
    view = d.demoView; retros = d.demoRetros; tareas = d.demoTareas; demo = true; errorMsg = null;
  }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 70px' }}>
      <header style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8 }}>
          Experimentos · la única verdad, con datos
        </div>
        <h1 style={{ fontWeight: 600, fontSize: 46, letterSpacing: '-0.025em', lineHeight: 1, margin: 0, color: 'var(--ink)' }}>Experimentos</h1>
      </header>

      <ExperimentosApp exp={view} retros={retros} tareas={tareas} errorMsg={errorMsg} demo={demo} />
    </main>
  );
}

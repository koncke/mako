// =============================================================================
// /todo — tablero kanban de ejecución (tareas por estado, con drag & drop)
// =============================================================================
// La página SOLO lee (server component resiliente): trae tareas y categorías con
// try/catch independientes. En local (sin Supabase) getSupabaseServer tira, así
// que en desarrollo caemos a datos DEMO para poder ver e iterar el diseño; en
// producción nunca corre. Toda la interacción (crear/editar/mover/borrar) vive
// en TodoBoard ('use client') contra /api/todo con updates optimistas.
// =============================================================================

import { listTareas, listCategorias, type Tarea, type Categoria } from '@/lib/todo';
import { guardOnboarding } from '@/lib/tab-access';
import { TodoBoard } from './TodoBoard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MONO = "'Geist Mono', monospace";

export default async function TodoPage() {
  await guardOnboarding();
  let tareas: Tarea[] = [];
  let categorias: Categoria[] = [];
  let dbDown = false;

  try { tareas = await listTareas(); } catch { dbDown = true; }
  try { categorias = await listCategorias(); } catch { /* categorías arrancan vacías */ }

  // En local (sin Supabase) mostramos datos DEMO para poder ver e iterar el
  // diseño. En producción esto nunca corre (NODE_ENV === 'production').
  let demo = false;
  if (dbDown && process.env.NODE_ENV !== 'production') {
    const d = await import('@/app/experimentos/_demo');
    tareas = d.demoTareas;
    categorias = d.demoCategorias;
    demo = true;
  }

  return (
    <main style={{ flex: 1, minWidth: 0, padding: '34px 44px 70px' }}>
      <header style={{ marginBottom: 22 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--faint)' }}>
          To-do · tablero de ejecución
        </div>
      </header>

      <TodoBoard tareas={tareas} categorias={categorias} demo={demo} />
    </main>
  );
}

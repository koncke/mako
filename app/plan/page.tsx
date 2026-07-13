// =============================================================================
// /todo — role-aware
// =============================================================================
// Super-admin de la AGENCIA (sin impersonar) → su PLAN de ejecución (PlanBoard,
// localStorage, privado). Cliente (o admin impersonando) → su tablero kanban de
// tareas (TodoBoard, tenant-scoped por DB). Un mismo /todo, distinta vista por rol.

import { listTareas, listCategorias, type Tarea, type Categoria } from '@/lib/todo';
import { guardOnboarding } from '@/lib/tab-access';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual } from '@/lib/workspace';
import { OWNER_WS } from '@/lib/auth-session';
import { getPerfil } from '@/lib/perfil';
import { TodoBoard } from './TodoBoard';
import { PlanBoard } from './PlanBoard';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export default async function TodoPage() {
  // Nombre + foto del usuario logueado (para el change history del board).
  let user = { nombre: '', avatarUrl: '' };
  try { const p = await getPerfil(); user = { nombre: p.nombre, avatarUrl: p.avatarUrl }; } catch { /* fallback vacío */ }

  // Super-admin sin impersonar (no tiene workspace de cliente activo) → su plan.
  const sesion = await getUsuarioActual();
  if (sesion?.rol === 'admin') {
    const ws = await getWorkspaceActual();
    if (ws == null || ws === OWNER_WS) return <PlanBoard user={user} />;
  }

  // Cliente (o admin impersonando un cliente): tablero de tareas del negocio.
  await guardOnboarding();
  let tareas: Tarea[] = [];
  let categorias: Categoria[] = [];
  let dbDown = false;
  try { tareas = await listTareas(); } catch { dbDown = true; }
  try { categorias = await listCategorias(); } catch { /* categorías arrancan vacías */ }

  let demo = false;
  if (dbDown && process.env.NODE_ENV !== 'production') {
    const d = await import('@/app/experimentos/_demo');
    tareas = d.demoTareas;
    categorias = d.demoCategorias;
    demo = true;
  }

  // El BoardShell ya trae su propio header "Plan"; no envolvemos con subtítulo.
  return <TodoBoard tareas={tareas} categorias={categorias} demo={demo} user={user} />;
}

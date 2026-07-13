// =============================================================================
// /todo — role-aware
// =============================================================================
// Super-admin de la AGENCIA (sin impersonar) → su PLAN de ejecución (PlanBoard,
// localStorage, privado). Cliente (o admin impersonando) → su tablero kanban de
// tareas (TodoBoard, tenant-scoped por DB). Un mismo /todo, distinta vista por rol.

import { listTareas, listCategorias, type Tarea, type Categoria } from '@/lib/todo';
import { seedTodoBoardSiVacio } from '@/lib/todo-seeds';
import { guardOnboarding } from '@/lib/tab-access';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, getWorkspace } from '@/lib/workspace';
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

  // G4: cliente nuevo con el board en blanco → sembrarle los 6 proyectos + las tareas
  // de arranque (idempotente). Solo cuando NO hay ni tareas ni proyectos, para no
  // re-sembrar si el cliente ya empezó su plan. Para Mauricio (slug 'mauricio') marca
  // hechas las que ya tiene armadas.
  if (!dbDown && categorias.length === 0 && tareas.length === 0) {
    try {
      const wsId = await getWorkspaceActual();
      const esMauricio = wsId != null && (await getWorkspace(wsId))?.slug === 'mauricio';
      await seedTodoBoardSiVacio(esMauricio);
      [tareas, categorias] = await Promise.all([listTareas(), listCategorias()]);
    } catch (e) { console.error('[plan] seed board por defecto', e); }
  }

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

// =============================================================================
// /m/plan — el plan en el teléfono: Prioridades · Tareas · Proyectos · Recurrentes (v3)
// =============================================================================
// v3 (14/10/2026): las cuatro vistas del Plan de escritorio; Tareas y Proyectos son tableros
// (./tableros.ts arma los modelos, ./ListaPlan.tsx los dibuja): Tareas por ESTADO desde el
// 16/10/2026, como escritorio, y Proyectos por prioridad. Lo de abajo es la
// v2, que sigue valiendo para la lista de Prioridades y para marcar hecha.
// =============================================================================
// El prototipo es `#plan` de docs/prototipos/mako-mobile-v2.html: el segmentado, una lista
// con casilla redonda, el proyecto como punto de su color y el plazo; al final, UNA fila
// gris «El tablero y los proyectos · En la computadora». Sólo lectura más UN gesto: marcar
// hecha (con Deshacer). Editar, reordenar, cambiar la prioridad, el Kanban y debatir con
// el Perro se quedan en la computadora.
//
// · CUÁL tablero → `leerPlanHoy` (lib/plan-hoy.ts) lo decide por SESIÓN, igual que /plan:
//   el dueño ve el suyo; un cliente (o un admin mirándolo), el del cliente. Esta página no
//   lee `?ws=`.
// · «Hoy» = `listaHoy(prioridades, hoy)`: `plan.hoy` viene SIN las de prioridades (Today
//   pinta las dos juntas) y acá son pestañas (formato.ts lo explica).
// · Los borradores del plan NO van acá: se confirman en el Inbox, que ya los cuenta.
// · `maxDuration` 60: marcar hecha corre la server action desde esta página.
// =============================================================================

import './plan.css';
import { requireMovil } from '@/lib/movil-guard';
import { leerPlanHoyConTablero, type PlanHoy } from '@/lib/plan-hoy';
import type { BoardTask, Label } from '@/app/plan/board/types';
import { proyectosDelTablero, recurrentesDelTablero, tareasDelTablero } from './tableros';
import { ComputadoraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { ListaPlan } from './ListaPlan';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const EN_LA_COMPUTADORA = 'Editar el plan';

export default async function PlanMovil() {
  await requireMovil({ navKey: 'todo' });

  let plan: PlanHoy;
  let tareas: BoardTask[];
  let proyectos: Label[];
  try {
    ({ plan, tareas, proyectos } = await leerPlanHoyConTablero());
  } catch (e) {
    console.error('[m/plan] leerPlanHoy:', e instanceof Error ? e.message : e);
    return (
      <PantallaM>
        <ErrorM frase="No pudimos leer el plan. No es nada tuyo." />
        <ComputadoraM que={EN_LA_COMPUTADORA} />
      </PantallaM>
    );
  }

  // El kanban de Tareas por ESTADO (16/10/2026): columnas con su conteo real y las tarjetas.
  const kanban = tareasDelTablero({ tareas, proyectos, hoy: plan.fecha, conNum: plan.tablero === 'dueno' });
  return (
    <PantallaM>
      <ListaPlan
        listas={{ prioridades: plan.prioridades, tareas: kanban.tareas }}
        columnasTareas={kanban.columnas}
        proyectos={proyectosDelTablero({ tareas, proyectos })}
        recurrentes={recurrentesDelTablero({ tareas, proyectos })}
        fecha={plan.fecha}
        abiertas={plan.abiertas}
      />
      {/* Una lectura llegó al tope de 1000 filas: no se afirma que esto es todo. */}
      {plan.recortado && <p className="m-plan-nota">Puede faltar parte del plan.</p>}
      <ComputadoraM que={EN_LA_COMPUTADORA} />
    </PantallaM>
  );
}

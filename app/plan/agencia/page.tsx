// =============================================================================
// /plan/agencia — el plan de ejecución de MaKo (solo la agencia)
// =============================================================================
// Vive en su PROPIO segmento y no adentro de /plan a propósito, y no es cosmético:
// PlanBoard es 'use client' y trae el seed adentro (proyectos, scoring, fechas y
// el razonamiento estratégico crudo). Next bundlea por ruta, así que mientras
// /plan/page.tsx lo importaba —aunque solo lo renderizara para el admin— su chunk
// viajaba en el JS de /plan para TODOS: cualquier cliente lo leía en DevTools →
// Sources. Y no era solo el roadmap: el detalle del proyecto de auditoría describe
// por escrito los agujeros abiertos, o sea que era un mapa de ataque.
//
// next/dynamic NO alcanzaba: el chunk se emite igual. Lo único que saca el código
// del bundle de una ruta es que esa ruta no lo importe.
//
// El guard es el mismo que tenía /plan: super-admin de la agencia SIN impersonar.
// Un admin impersonando a un cliente ve el tablero del cliente, no este.
// localStorage es por ORIGEN, no por path: el board conserva sus datos (mako_plan_v2)
// al mudarse de /plan a /plan/agencia.
// =============================================================================

import { redirect } from 'next/navigation';
import { getUsuarioActual } from '@/lib/auth';
import { estaImpersonando, rutaConWs } from '@/lib/workspace';
import { getPerfil } from '@/lib/perfil';
import { listPlanBoard } from '@/lib/plan-board';
import type { BoardTask, Label } from '../board/types';
import { PlanBoard } from '../PlanBoard';
import type { Dep } from '../board/dependencias';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * ⚠️ LA VISTA SE LEE EN EL SERVER, no en un `useEffect` del board. Es la regla de la casa
 * («la tab viaja en `?tab=` leída en el server», AGENTS.md) y acá el porqué se ve: si el
 * board arranca en «prioridades» y corrige después de hidratar, cada refresh es un parpadeo
 * —ves Prioridades y salta a Kanban— y encima React avisa por hidratación desalineada.
 * Leyéndola acá, el primer HTML ya viene con la vista correcta.
 */
export default async function PlanAgenciaPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  const sesion = await getUsuarioActual();
  if (sesion?.rol !== 'admin' || (await estaImpersonando())) redirect(await rutaConWs('/plan'));

  // Nombre + foto del usuario logueado (para el change history del board).
  let user = { nombre: '', avatarUrl: '' };
  try { const p = await getPerfil(); user = { nombre: p.nombre, avatarUrl: p.avatarUrl }; } catch { /* fallback vacío */ }

  // El board del /plan ahora vive en Supabase (mig 0093), se carga server-side.
  // vacío = todavía no se migró desde localStorage → PlanBoard muestra el botón migrar.
  let tareas: BoardTask[] = [];
  let proyectos: Label[] = [];
  let deps: Dep[] = [];
  try { const b = await listPlanBoard(); tareas = b.tareas; proyectos = b.proyectos; deps = b.deps; } catch (e) { console.error('[plan/agencia] listPlanBoard', e); }
  const vacio = tareas.length === 0 && proyectos.length === 0;

  return <PlanBoard user={user} tareas={tareas} proyectos={proyectos} deps={deps} vacio={vacio} vistaInicial={vista} />;
}

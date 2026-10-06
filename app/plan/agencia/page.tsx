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
import { clientesGanadosOVacio } from '@/lib/clientes-ganados';
import type { BoardTask, Label } from '../board/types';
import { PlanBoard } from '../PlanBoard';
import type { Dep } from '../board/dependencias';
import { leerClienteDeUrl } from '../board/filtro-cliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * ⚠️ LA VISTA SE LEE EN EL SERVER, no en un `useEffect` del board. Es la regla de la casa
 * («la tab viaja en `?tab=` leída en el server», AGENTS.md) y acá el porqué se ve: si el
 * board arranca en «prioridades» y corrige después de hidratar, cada refresh es un parpadeo
 * —ves Prioridades y salta a Kanban— y encima React avisa por hidratación desalineada.
 * Leyéndola acá, el primer HTML ya viene con la vista correcta.
 */
export default async function PlanAgenciaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const vista = typeof params.vista === 'string' ? params.vista : undefined;
  const sesion = await getUsuarioActual();
  // ⚠️ EL QUERY VIAJA CON EL REDIRECT, también en esta dirección. Es el espejo del reenvío de
  // /plan → /plan/agencia (ver app/plan/page.tsx): un admin IMPERSONANDO que abre un link de
  // éstos —`?cliente=`, `?tarea=`— caía en /plan pelado, sin el filtro ni la tarjeta, y sin un
  // error que lo explique.
  if (sesion?.rol !== 'admin' || (await estaImpersonando())) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'string') sp.set(k, v);
      else if (Array.isArray(v) && v[0]) sp.set(k, v[0]);
    }
    const qs = sp.toString();
    redirect(await rutaConWs(`/plan${qs ? `?${qs}` : ''}`));
  }

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

  // Los clientes del workspace para el picker del detalle (mig 0172). `…OVacio` y no
  // `clientesGanados` a secas: si la consulta de leads falla, el tablero se tiene que
  // dibujar igual con el picker vacío. Que un error leyendo el CRM deje a alguien sin su
  // tablero entero es el peor intercambio posible.
  const clientes = await clientesGanadosOVacio();

  return <PlanBoard user={user} tareas={tareas} proyectos={proyectos} deps={deps} vacio={vacio} vistaInicial={vista} clientes={clientes} clienteInicial={leerClienteDeUrl(params.cliente)} />;
}

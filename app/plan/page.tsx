// =============================================================================
// /todo — role-aware
// =============================================================================
// Super-admin de la AGENCIA (sin impersonar) → su PLAN de ejecución (PlanBoard,
// localStorage, privado). Cliente (o admin impersonando) → su tablero kanban de
// tareas (TodoBoard, tenant-scoped por DB). Un mismo /todo, distinta vista por rol.

import { redirect } from 'next/navigation';
import { listTareas, listCategorias, type Tarea, type Categoria } from '@/lib/todo';
import { seedTodoBoardSiVacio, autocompletarPorSenales } from '@/lib/todo-seeds';
import { guardOnboarding, requireCapa } from '@/lib/tab-access';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, estaImpersonando, rutaConWs, getRolWsEfectivo } from '@/lib/workspace';
import { leerColumnasPlan } from '@/lib/plan-columnas-server';
import { getPerfil, getTarjetaPlan } from '@/lib/perfil';
import { TodoBoard } from './TodoBoard';
import { leerEstadoArranque } from '@/lib/onboarding-arranque-server';
import { getPropuesta } from '@/lib/plan-propuesta';
import { clientesGanadosOVacio } from '@/lib/clientes-ganados';
import { leerClienteDeUrl } from './board/filtro-cliente';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export default async function TodoPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // Nombre + foto del usuario logueado (para el change history del board).
  let user = { nombre: '', avatarUrl: '' };
  try { const p = await getPerfil(); user = { nombre: p.nombre, avatarUrl: p.avatarUrl }; } catch { /* fallback vacío */ }

  // Super-admin (Martín) SIN impersonar → su plan de ejecución, que vive en
  // /plan/agencia. Se REDIRIGE en vez de renderizarlo acá: PlanBoard es 'use
  // client' y trae el seed adentro, así que importarlo desde esta página metía su
  // chunk —roadmap, scoring y el detalle de los agujeros de seguridad— en el JS
  // que se le manda a TODOS los clientes, aunque solo se renderizara para el admin.
  // Si un admin IMPERSONA a un cliente (incl. Mauricio/ws1), cae al tablero del
  // cliente — Mauricio es un cliente más, no el dueño.
  const sesion = await getUsuarioActual();
  if (sesion?.rol === 'admin' && !(await estaImpersonando())) {
    // ⚠️ EL QUERY VIAJA CON EL REDIRECT. Sin esto, un link de MaKo tipo
    // `/plan?reunion=123` o `/plan?tarea=abc` funciona para un CLIENTE y para el
    // super-admin no: rebota a /plan/agencia pelado y aterriza en el tablero general,
    // sin nada abierto y sin ningún error — que es exactamente cómo se reportó
    // («abrí el link y solo me lleva al plan»). Es el mismo modo de falla que el
    // `?ws=` que se pierde en un redirect, ya documentado en AGENTS.md.
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(await searchParams)) {
      if (typeof v === 'string') sp.set(k, v);
      else if (Array.isArray(v) && v[0]) sp.set(k, v[0]);
    }
    const qs = sp.toString();
    redirect(await rutaConWs(`/plan/agencia${qs ? `?${qs}` : ''}`));
  }

  // Cliente (o admin impersonando un cliente): tablero de tareas del negocio.
  await requireCapa('todo');
  await guardOnboarding();
  let tareas: Tarea[] = [];
  let categorias: Categoria[] = [];
  let dbDown = false;
  try { tareas = await listTareas(); } catch { dbDown = true; }
  try { categorias = await listCategorias(); } catch { /* categorías arrancan vacías */ }

  // G4: cliente nuevo con el board en blanco → sembrarle su plan de arranque
  // (idempotente). Solo cuando NO hay ni tareas ni proyectos, para no re-sembrar si
  // ya empezó. El seed se personaliza solo: recorta por fase y canal del negocio y
  // marca hecho lo que las señales ya dan por resuelto (lib/plan-senales.ts).
  if (!dbDown && categorias.length === 0 && tareas.length === 0) {
    try {
      await seedTodoBoardSiVacio();
      [tareas, categorias] = await Promise.all([listTareas(), listCategorias()]);
    } catch (e) { console.error('[plan] seed board por defecto', e); }
  } else if (!dbDown && tareas.length) {
    // El board ya existe: cerrar solas las tarjetas del arranque cuyo trabajo ya
    // está hecho (conectó Meta, cargó el funnel…). Sin candidatas no consulta nada.
    try { if (await autocompletarPorSenales(tareas)) tareas = await listTareas(); }
    catch (e) { console.error('[plan] autocompletar por señales', e); }
  }

  let demo = false;
  if (dbDown && process.env.NODE_ENV !== 'production') {
    const d = await import('./_demo');
    tareas = d.demoTareas;
    categorias = d.demoCategorias;
    demo = true;
  }

  // Workspace actual (para scopear el opt-in de auto-load de reuniones por cliente,
  // así la preferencia no se comparte entre impersonaciones en el mismo browser).
  const wsActual = await getWorkspaceActual().catch(() => null);

  // El BoardShell ya trae su propio header "Plan"; no envolvemos con subtítulo.
  // La vista viaja en `?vista=` y se lee ACÁ, en el server: si el board la corrigiera
  // después de hidratar, cada refresh sería un parpadeo de Prioridades. Mismo trato que el
  // tablero del dueño — la persistencia de la pantalla no es una comodidad de super-admin.
  // `?cliente=` va por el MISMO camino que `?vista=` y por la misma razón: leído acá, el primer
  // HTML ya viene filtrado (lo pone el botón «Ver en el Plan» de la ficha de un cliente). El
  // reenvío de arriba ya lo lleva hasta /plan/agencia para el super admin.
  const { vista, cliente } = await searchParams;
  // Los clientes del workspace para el picker del detalle (mig 0172). `…OVacio` y no
  // `clientesGanados` a secas: si la consulta de leads falla, el tablero se tiene que
  // dibujar igual con el picker vacío. Que un error leyendo el CRM deje a alguien sin su
  // tablero entero es el peor intercambio posible.
  const clientes = await clientesGanadosOVacio();
  // Los nombres de las columnas de ESTE negocio (lib/plan-columnas.ts) y si quien mira los puede cambiar: el admin,
  // como el funnel del CRM. Leídos acá para que el primer HTML ya diga el nombre del negocio, sin parpadeo.
  // La tarjeta de quien mira («Personalizar tarjetas», 21/10/2026): de SU fila, con el HTML, por el mismo camino que las
  // columnas. `getTarjetaPlan` nunca tira (sin fila propia, la de siempre y sin guardar).
  const [configColumnas, rol, tarjeta, borrador] = await Promise.all([leerColumnasPlan(), getRolWsEfectivo().catch(() => null), getTarjetaPlan(), borradorPendiente()]);

  return <TodoBoard tareas={tareas} categorias={categorias} demo={demo} user={user} wsId={wsActual} vistaInicial={typeof vista === 'string' ? vista : undefined} clientes={clientes} clienteInicial={leerClienteDeUrl(cliente)}
    columnas={demo ? null : { config: configColumnas, editables: rol === 'admin' }} tarjeta={demo ? null : tarjeta}
    apertura={demo ? null : { borrador, esAdmin: rol === 'admin' }} />;
}

/**
 * El borrador del plan del onboarding, SÓLO si sigue pendiente (5/11/2026, lib/aperturas/plan.ts): su link quedó en el estado del
 * onboarding y se mira cómo está ahora. Cualquier lectura que falla es null: MaKo calla (nunca ofrece un borrador que no existe).
 */
async function borradorPendiente(): Promise<{ id: string; n: number } | null> {
  try {
    const b = (await leerEstadoArranque()).planBorrador;
    if (!b?.id) return null;
    const p = await getPropuesta(b.id);
    return p?.estado === 'pendiente' ? { id: b.id, n: b.n } : null;
  } catch {
    return null;
  }
}

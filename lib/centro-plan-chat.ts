// =============================================================================
// Un chat maneja el Plan de SU jefe a pedido FIRMADO de Martín (17/10/2026, lo que quedó sin hacer de la D)
// =============================================================================
// Martín (feedback del 17/10, su punto 9): si pide en un chat «tráeme las más prioritarias» o «ciérrala», el chat lo hace
// sin que él abra el Plan. La puerta es el cartero de la PC (`cartero.mjs plan prioridades --trabajo <id>` /
// `plan cerrar #870 --trabajo <id>`), con SU token, por la ruta del cartero (`?plan=1`). Las reglas, en
// lib/centro-plan-chat-reglas.ts.
//
// ⚠️ REVISIÓN DE SEGURIDAD (la primera versión la tiró la revisión del Cerebro, 17/10/2026). Lo que limita a quien tenga el
//    token o a un chat que se haga pasar por otro:
//   · todo pedido trae el TRABAJO FIRMADO de Martín que lo originó: la fila de la cola sólo la escribe su sesión con
//     segundo factor, y `entregado` quiere decir que la PC verificó su firma. Tiene que ser para ESA sesión, de hace menos
//     de un día y, para cerrar, nombrar la tarea por número (`trabajoAutoriza`);
//   · sólo DOS operaciones: leer las abiertas del proyecto del jefe o CERRAR una (cerrar no es borrar, y es reversible);
//   · sólo el proyecto del JEFE de esa sesión; la tarea se busca por número ADENTRO de ese proyecto;
//   · lo que vuelve a la PC es de forma fija y corto (la PC además lo pasa por `textoRemoto`): un título del Plan es texto
//     que entra al contexto de un modelo.
// «Cámbiale el nombre» NO está: la API del Plan no tiene una operación para renombrar una tarea (lib/api-mako/areas/
// plan.def.ts), y sumarla es del área Plan.

import 'server-only';
import { wsSuperAdmin } from './workspace';
import { leerCarteros, trabajoDeLaCola } from './operaciones';
import { ctxDeMaKo } from './centro-plan-auto';
import { cerrarTareaDelPlan, leerPlanDelJefe } from './centro-plan';
import { proyectoDelChat } from './centro-plan-reglas';
import { TOPE_PRIORIDADES, ordenarPorPrioridad, sanearPedidoDePlan, tareaDelPedido, trabajoAutoriza, type RespuestaPlanChat } from './centro-plan-chat-reglas';

const corto = (s: string | null, max: number) => (s == null ? null : s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max));

/** Lo que pide un chat por la PC. Devuelve lo que el chat le muestra a Martín (o el error, en una frase). */
export async function planDesdeElChat(entrada: unknown): Promise<RespuestaPlanChat> {
  const p = sanearPedidoDePlan(entrada);
  if (!p.ok) return p;
  const w = await trabajoDeLaCola(p.trabajo);
  const no = trabajoAutoriza(w, p, Date.now());
  if (no) return { ok: false, error: no };
  const { carteros } = await leerCarteros();
  const chat = carteros.flatMap((k) => k.chats).find((c) => c.local === p.sesion);
  if (!chat) return { ok: false, error: 'No conozco esta sesión: espera la próxima vuelta del Runner y vuelve a pedirlo.' };
  if (!proyectoDelChat(chat.titulo)) return { ok: false, error: 'Este chat no tiene un proyecto en el Plan: el Plan es de los jefes.' };
  const ws = await wsSuperAdmin();
  const ctx = { ...ctxDeMaKo(ws), actor: `MaKo · Ops Center (${chat.titulo.slice(0, 60)})` };
  const plan = await leerPlanDelJefe(ctx, chat.titulo);
  if (!plan.ok) return { ok: false, error: plan.motivo };
  if (p.op === 'prioridades') {
    return {
      ok: true, proyecto: corto(plan.proyecto, 80),
      tareas: ordenarPorPrioridad(plan.tareas).slice(0, Math.min(p.n, TOPE_PRIORIDADES))
        .map((t) => ({ num: t.num, titulo: corto(t.titulo, 120) ?? '', prioridad: corto(t.prioridad, 20), deadline: corto(t.deadline, 10) })),
    };
  }
  const t = tareaDelPedido(plan.tareas, p.num);
  if (!t) return { ok: false, error: `La #${p.num} no está abierta en el proyecto de este chat.` };
  const r = await cerrarTareaDelPlan(ctx, chat.titulo, { id: t.id, evidencia: p.evidencia || `La cerró el chat a pedido firmado de Martín (trabajo ${p.trabajo.slice(0, 8)}).` });
  return r.ok ? { ok: true, cerrada: { num: t.num } } : { ok: false, error: r.error };
}

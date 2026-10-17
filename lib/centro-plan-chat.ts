// =============================================================================
// Un chat maneja el Plan de SU jefe a pedido de Martín (17/10/2026, lo que quedó sin hacer de la D)
// =============================================================================
// Martín (feedback del 17/10, su punto 9): si pide en un chat «tráeme las más prioritarias» o «bórralas», el chat lo hace
// sin que él abra el Plan. La puerta es el cartero de la PC (`cartero.mjs plan prioridades` / `plan cerrar #870`), con SU
// token, por la ruta del cartero (`?plan=1`). Las reglas puras, en lib/centro-plan-chat-reglas.ts.
//
// ⚠️ REVISIÓN DE SEGURIDAD PEDIDA (es una puerta nueva de la PC a MaKo). Lo que limita a quien tenga el token:
//   · sólo DOS operaciones: leer las abiertas del proyecto del jefe y CERRAR una (cerrar no es borrar: queda con su
//     historial, y `cerrar_tareas_plan` es reversible). Ni crear, ni borrar, ni mover, ni renombrar;
//   · sólo el proyecto del JEFE del chat que pide: la sesión tiene que estar en la última foto que subió un Runner
//     (`operaciones_carteros`) y su nombre decide el proyecto (`proyectoDelChat`); el Cerebro no tiene proyecto;
//   · la tarea a cerrar se busca ADENTRO de ese proyecto por su número: un número de otro proyecto no existe para él;
//   · todo queda en el historial con el actor «MaKo · Ops Center (<chat>)».
// «Cámbiale el nombre» NO está: la API del Plan no tiene una operación para renombrar una tarea (lib/api-mako/areas/
// plan.def.ts), y sumarla es del área Plan.

import 'server-only';
import { wsSuperAdmin } from './workspace';
import { leerCarteros } from './operaciones';
import { ctxDeMaKo } from './centro-plan-auto';
import { cerrarTareaDelPlan, leerPlanDelJefe } from './centro-plan';
import { proyectoDelChat } from './centro-plan-reglas';
import { TOPE_PRIORIDADES, sanearPedidoDePlan, tareaDelPedido, type RespuestaPlanChat } from './centro-plan-chat-reglas';

/** Lo que pide un chat por la PC. Devuelve lo que el chat le muestra a Martín (o el error, en una frase). */
export async function planDesdeElChat(entrada: unknown): Promise<RespuestaPlanChat> {
  const p = sanearPedidoDePlan(entrada);
  if (!p.ok) return p;
  const { carteros } = await leerCarteros();
  const chat = carteros.flatMap((k) => k.chats).find((c) => c.local === p.sesion);
  if (!chat) return { ok: false, error: 'No conozco esta sesión: espera la próxima vuelta del Runner y vuelve a pedirlo.' };
  if (!proyectoDelChat(chat.titulo)) return { ok: false, error: `«${chat.titulo}» no tiene un proyecto en el Plan: el Plan es de los jefes.` };
  const ws = await wsSuperAdmin();
  const ctx = { ...ctxDeMaKo(ws), actor: `MaKo · Ops Center (${chat.titulo.slice(0, 60)})` };
  const plan = await leerPlanDelJefe(ctx, chat.titulo);
  if (!plan.ok) return { ok: false, error: plan.motivo };
  if (p.op === 'prioridades') {
    return { ok: true, proyecto: plan.proyecto, tareas: plan.tareas.slice(0, Math.min(p.n, TOPE_PRIORIDADES)).map((t) => ({ num: t.num, titulo: t.titulo, prioridad: t.prioridad, deadline: t.deadline, avance: t.avance })) };
  }
  const t = tareaDelPedido(plan.tareas, p.num);
  if (!t) return { ok: false, error: `La #${p.num} no está abierta en el proyecto de «${chat.titulo}».` };
  const r = await cerrarTareaDelPlan(ctx, chat.titulo, { id: t.id, evidencia: p.evidencia || `Lo cerró «${chat.titulo}» a pedido de Martín.` });
  return r.ok ? { ok: true, cerrada: { num: t.num, titulo: t.titulo } } : { ok: false, error: r.error };
}

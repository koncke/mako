// =============================================================================
// «Tráeme las más prioritarias» desde un chat: el Plan de su jefe, de SÓLO LECTURA (17/10/2026)
// =============================================================================
// Martín (feedback del 17/10, su punto 9) quería que un chat manejara el Plan a pedido. Lo que quedó después de dos
// revisiones adversariales del Cerebro: SÓLO LEER. Un chat no cierra tareas (lib/centro-plan-chat-reglas.ts, la cabecera);
// Martín las marca hechas desde el Centro. La puerta es `cartero.mjs plan prioridades --trabajo <id>` → la ruta del cartero
// (`?plan=1`).
// ⚠️ REVISIÓN DE SEGURIDAD. Lo que limita a quien tenga el token o a un chat que se haga pasar por otro:
//   · el chat y su proyecto salen del PEDIDO firmado de Martín (`destino_titulo` de esa fila de la cola, que escribe sólo su
//     sesión con segundo factor), no de una sesión que declara quien llama; un pedido viejo o una respuesta a una pregunta
//     no valen (`pedidoAutoriza`);
//   · sólo las abiertas del proyecto de ese jefe, ordenadas por prioridad, en forma fija y corta (la PC además las pasa por
//     `textoRemoto`: un título del Plan es texto que entra al contexto de un modelo).

import 'server-only';
import { wsSuperAdmin } from './workspace';
import { trabajoDeLaCola } from './operaciones';
import { ctxDeMaKo } from './centro-plan-auto';
import { leerPlanDelJefe } from './centro-plan';
import { proyectoDelChat } from './centro-plan-reglas';
import { TOPE_PRIORIDADES, ordenarPorPrioridad, pedidoAutoriza, sanearPedidoDePlan, type RespuestaPlanChat } from './centro-plan-chat-reglas';

const corto = (s: string | null, max: number) => (s == null ? null : s.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max));

/** Las más prioritarias del proyecto del jefe al que Martín le mandó el pedido firmado. */
export async function planDesdeElChat(entrada: unknown): Promise<RespuestaPlanChat> {
  const p = sanearPedidoDePlan(entrada);
  if (!p.ok) return p;
  const w = await trabajoDeLaCola(p.trabajo);
  const no = pedidoAutoriza(w, Date.now());
  if (no || !w) return { ok: false, error: no ?? 'Ese pedido no existe.' };
  const chat = w.titulo;
  if (!chat || !proyectoDelChat(chat)) return { ok: false, error: 'Ese pedido no es de un jefe: el Plan es de los jefes.' };
  const ws = await wsSuperAdmin();
  const plan = await leerPlanDelJefe(ctxDeMaKo(ws), chat);
  if (!plan.ok) return { ok: false, error: plan.motivo };
  return {
    ok: true, proyecto: corto(plan.proyecto, 80),
    tareas: ordenarPorPrioridad(plan.tareas).slice(0, Math.min(p.n, TOPE_PRIORIDADES))
      .map((t) => ({ num: t.num, titulo: corto(t.titulo, 120) ?? '', prioridad: corto(t.prioridad, 20), deadline: corto(t.deadline, 10) })),
  };
}

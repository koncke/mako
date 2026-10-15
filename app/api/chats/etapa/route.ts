// =============================================================================
// /api/chats/etapa — «Elegir etapa» de la cabecera de la conversación (el Lifecycle de respond.io)
// =============================================================================
// POST { leadId, etapa } → { ok, pendientes?: string[] }
//                        · { ok: false, necesitaFicha: true, error } cuando la etapa pide una DECISIÓN que no es
//                          un dato suelto: una etapa de reunión (agendarla o marcar que ya ocurrió, con la hora:
//                          commit 46890b96) o la nutrición manual (su plazo ES el movimiento). La pantalla abre la
//                          ficha del lead, que tiene ese asistente. Va con 200: no es un error, es una respuesta.
//
// ⚠️ EL MISMO CHOKE POINT QUE EL CRM. Qué etapa abre el asistente lo decide `pideWizardAlElegir`
// (app/crm/mover-etapa.ts, la regla de las dos fichas del CRM), y el movimiento es `setLeadStageAction`
// (app/crm/actions.ts): el mismo que el arrastre del tablero y que el teléfono (app/m/crm/acciones.ts). Mueve
// SIEMPRE y lo que la etapa pide y falta vuelve como `pendientes` (decisión del 17/09: guardar nunca se bloquea),
// deja el historial con el autor de la sesión y manda a Meta lo que corresponda.
//   · La acción no tiene guarda de la tab CRM: la puerta es `puertaChats`.
//   · Sin los toques de Meta (asistencia, calificado): desde Chats no se ofrecen (son conversiones que no se
//     deshacen), igual que en el teléfono.
//   · Las etapas son las del embudo del NEGOCIO (`getFunnelDefault`, lo mismo que pinta el tablero). Leídas en
//     error no se mueve nada: la plantilla no son las etapas del cliente.
//   · Su `updateTag` lanza fuera de una server action (y la acción se lo traga): se invalida con `revalidateTag`.

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getLead } from '@/lib/leads';
import { etapaVigenteDe } from '@/lib/funnel-etapas';
import { puertaChats, etapasDeChats } from '@/lib/chats';
import { idDelFunnelDefault } from '@/lib/funnels';
import { pideWizardAlElegir } from '@/app/crm/mover-etapa';
import { setLeadStageAction } from '@/app/crm/actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 30;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: Request) {
  const puerta = await puertaChats();
  if (!puerta.ok) return err(puerta.status, puerta.error);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const leadId = Number(body?.leadId);
  const etapa = typeof body?.etapa === 'string' ? body.etapa.trim() : '';
  if (!Number.isSafeInteger(leadId) || leadId <= 0) return err(400, 'Falta el lead.');
  if (!etapa) return err(400, 'Falta la etapa.');
  try {
    const [lead, { stages, falla }, def] = await Promise.all([getLead(leadId), etapasDeChats(), idDelFunnelDefault().catch(() => undefined)]);
    if (!lead) return err(404, 'Ese lead no está.');
    // ⚠️ UN LEAD DE OTRO PRODUCTO SE MUEVE EN LA FICHA (verificado el 15/10/2026). El menú de Chats ofrece las etapas
    // del funnel del NEGOCIO, y las claves se numeran por funnel (st0, st1…): la misma clave es otra etapa en otro
    // producto, así que mover con ella lo mandaba a otra columna de SU tablero. Sin saber cuál es el default, tampoco.
    const casa = lead.funnel_id == null ? null : Number(lead.funnel_id);
    if (def === undefined || (casa != null && casa !== def)) {
      return NextResponse.json({ ok: false, necesitaFicha: true, error: 'Cámbiala en la ficha.' });
    }
    if (falla) return err(503, 'No pude leer las etapas.');
    if (!stages.some((s) => s.key === etapa)) return err(400, 'Esa etapa no existe.');
    if (etapaVigenteDe(lead, stages) === etapa) return NextResponse.json({ ok: true, pendientes: [] });
    if (pideWizardAlElegir(stages, etapa)) return NextResponse.json({ ok: false, necesitaFicha: true, error: 'Complétala en la ficha.' });
    const r = await setLeadStageAction(leadId, etapa);
    try { revalidateTag(TAG.leads, { expire: 0 }); revalidateTag(TAG.pagos, { expire: 0 }); } catch { /* vence sola por TTL */ }
    if (!r.ok) return err(422, r.mensaje || 'No se pudo mover.');
    return NextResponse.json({ ok: true, pendientes: (r.pendientes ?? []).map((p) => p.label) });
  } catch (e) {
    console.error(`[api:chats/etapa] ${leadId} → ${etapa}: ${msg(e)}`);
    return err(500, 'No se pudo mover.');
  }
}

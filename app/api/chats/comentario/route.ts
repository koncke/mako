// =============================================================================
// /api/chats/comentario — «Agregar comentario» del composer (sólo lo ve el equipo)
// =============================================================================
// POST { leadId, texto } → { ok, mensaje: MensajeChat } — el comentario ya guardado, para sumarlo al hilo.
//
// ⚠️ UN COMENTARIO ES UNA NOTA DEL LEAD (decisión 3 de docs/diseno-chats.md): una fila de `lead_audit` con
// `campo = 'Nota'`, escrita por `addLeadNoteAction` (app/crm/actions.ts) — la MISMA que la caja de notas de la
// ficha, la del teléfono y la que lee MaKo. Sin lead no hay comentario: primero «Agregar al CRM».
//
// Lo que esta puerta agrega (el molde de app/m/crm/acciones.ts, `notaLeadAction`):
//   · el lead tiene que ser de este negocio ANTES de escribir (`addLeadNoteAction` no lo verifica);
//   · el texto se RECHAZA si pasa el tope, no se recorta (`TOPE_NOTA`, el mismo del alta);
//   · la nota se RELEE: `logLeadEvent` se traga el error del insert, así que «ok» sólo si la nota está.

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getLead, getLeadAudit } from '@/lib/leads';
import { autorLegible } from '@/lib/chats-reglas';
import { puertaChats } from '@/lib/chats';
import type { MensajeChat } from '@/lib/chats-tipos';
import { addLeadNoteAction } from '@/app/crm/actions';
import { TOPE_NOTA } from '@/app/crm/notas-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: Request) {
  const puerta = await puertaChats();
  if (!puerta.ok) return err(puerta.status, puerta.error);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const leadId = Number(body?.leadId);
  const texto = typeof body?.texto === 'string' ? body.texto.trim() : '';
  if (!Number.isSafeInteger(leadId) || leadId <= 0) return err(400, 'Primero agrégalo al CRM.');
  if (!texto) return err(400, 'Comentario vacío.');
  if (texto.length > TOPE_NOTA) return err(400, 'El comentario es muy largo.');
  try {
    if (!(await getLead(leadId))) return err(404, 'Ese lead no está.');
    const desde = Date.now() - 60_000;
    await addLeadNoteAction(leadId, texto);
    try { revalidateTag(TAG.leads, { expire: 0 }); } catch { /* vence sola por TTL */ }
    const nota = (await getLeadAudit(leadId))
      .find((r) => r.campo === 'Nota' && (r.valor_nuevo ?? '').trim() === texto && Date.parse(r.created_at) >= desde);
    if (!nota) return err(500, 'No se guardó.');
    const mensaje: MensajeChat = {
      id: `nota:${nota.id}`, tipo: 'comentario', canal: null, cuenta: null, saliente: true,
      // El CRM firma con el email; el hilo lo muestra con el nombre de quien lo escribió (que es quien pidió esto).
      autor: puerta.yo.nombre || autorLegible(nota.autor),
      texto, formato: 'text', mediaUrl: null, mediaMime: null, fecha: nota.created_at, status: null, error: null,
    };
    return NextResponse.json({ ok: true, mensaje });
  } catch (e) {
    console.error(`[api:chats/comentario] ${leadId}: ${msg(e)}`);
    return err(500, 'No se guardó.');
  }
}

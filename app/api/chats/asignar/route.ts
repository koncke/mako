// =============================================================================
// /api/chats/asignar — «Asignar» / «Quitar asignación» de la tab Chats
// =============================================================================
// POST { leadId, setter: string | null } → { ok }
//
// ⚠️ EL ASIGNADO ES `leads.setter` (decisión 2 de docs/diseno-chats.md: una cosa, un lugar), y se escribe por el
// MISMO camino que la ficha del CRM: `saveLeadMetaAction` (app/crm/actions.ts), que lee el antes y el después y
// deja la línea «Setter» en el historial con el autor de la sesión. Así el CRM lo ve igual, se puede deshacer
// desde el historial, y el hilo de Chats lo muestra como evento («Asignada a X por Y»).
//
// Por qué la acción y no `saveLeadMeta` a secas: la acción NO tiene guarda propia de la tab CRM (no la frena a un
// closer o un setter) y es la que escribe el historial; sin ella, asignar desde Chats no dejaría rastro. La puerta
// de acá (`puertaChats`) es la que decide quién entra.
//   · Su `updateTag` sólo corre dentro de una server action: desde una ruta lanza y la acción se lo traga. Por
//     eso acá se invalida con `revalidateTag` (el arreglo de lib/api-mako/areas/crm.helpers.ts, `invalidar`).
//   · El nombre se valida contra el equipo del negocio (el mismo lector que el desplegable del CRM): el navegador
//     no puede escribir cualquier texto en `leads.setter`. MaKo no se asigna a mano: se asigna solo al pasar a
//     una nutrición automática (la regla de `asignar_closer_setter` de la API de MaKo).

import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { getLead } from '@/lib/leads';
import { MAKO_SETTER } from '@/lib/pipeline';
import { puertaChats } from '@/lib/chats';
import { getEquipoAction, saveLeadMetaAction } from '@/app/crm/actions';

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
  if (!Number.isSafeInteger(leadId) || leadId <= 0) return err(400, 'Falta el lead.');
  if (body?.setter !== null && typeof body?.setter !== 'string') return err(400, 'Falta a quién asignar.');
  const setter = typeof body.setter === 'string' ? body.setter.trim() || null : null;
  if (setter && setter.toLowerCase() === MAKO_SETTER.toLowerCase()) return err(400, 'MaKo se asigna solo.');
  try {
    const lead = await getLead(leadId);
    if (!lead) return err(404, 'Ese lead no está.');
    if ((lead.setter?.trim() || null) === setter) return NextResponse.json({ ok: true });
    if (setter) {
      const equipo = await getEquipoAction();
      if (!equipo.some((m) => m.nombre === setter)) return err(400, 'No es del equipo.');
    }
    await saveLeadMetaAction(leadId, { setter });
    try { revalidateTag(TAG.leads, { expire: 0 }); } catch { /* vence sola por TTL */ }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(`[api:chats/asignar] ${leadId}: ${msg(e)}`);
    return err(500, 'No se asignó.');
  }
}

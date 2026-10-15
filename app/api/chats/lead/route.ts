// =============================================================================
// /api/chats/lead — «Agregar al CRM» de una persona de Instagram o Messenger
// =============================================================================
// POST { convId: number, funnelId: number | null } → { ok, leadId }
//                                                 · { ok: false, error, elegir? } — `elegir`: hay varios productos
//                                                   y no se eligió ninguno (la misma regla que el alta desde
//                                                   WhatsApp, `destinoDelAlta`).
//
// Crea el lead y lo une a SU fila por `lead_id`, NUNCA por teléfono ni por nombre (lib/canal-zernio.ts,
// `crearLeadDeConversacionSocial`). Desde ese momento la conversación es `lead:<id>`: la pantalla cambia de
// clave (`onClaveCambio`). Para WhatsApp el alta sigue siendo `crearLeadDesdeWhatsappAction` (no se duplica).

import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { TAG } from '@/lib/cache';
import { puertaChats } from '@/lib/chats';
import { crearLeadDeConversacionSocial } from '@/lib/canal-zernio';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const err = (status: number, error: string, extra?: Record<string, unknown>) => NextResponse.json({ ok: false, error, ...extra }, { status });

export async function POST(req: Request) {
  const puerta = await puertaChats();
  if (!puerta.ok) return err(puerta.status, puerta.error);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return err(400, 'JSON inválido'); }
  const convId = Number(body?.convId);
  if (!Number.isSafeInteger(convId) || convId <= 0) return err(400, 'Falta la conversación.');
  const f = body?.funnelId;
  const funnelId = f == null ? null : Number(f);
  if (funnelId != null && (!Number.isSafeInteger(funnelId) || funnelId <= 0)) return err(400, 'Ese funnel no existe.');
  const r = await crearLeadDeConversacionSocial(convId, funnelId);
  if (!r.ok) return err(r.elegir ? 409 : 400, r.error, r.elegir ? { elegir: r.elegir } : undefined);
  try { revalidateTag(TAG.leads, { expire: 0 }); revalidatePath('/crm'); } catch { /* vence sola por TTL */ }
  return NextResponse.json({ ok: true, leadId: r.leadId });
}

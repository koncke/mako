// =============================================================================
// /api/chats/contacto — los datos del lead para el drawer «Contacto» de la tab Chats
// =============================================================================
// GET ?leadId=<id> → { ok, lead: { id, nombre, telefono, email, empresa, instagram, etapaKey, etapaLabel,
//                                  setter, closer, origen, createdAt, etiquetas: {nombre,color}[] } }
// 404 si el lead no es de este negocio (getLead lee con el scope del workspace).

import { NextResponse, type NextRequest } from 'next/server';
import { puertaChats, contactoDeLead } from '@/lib/chats';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const err = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function GET(req: NextRequest) {
  const puerta = await puertaChats();
  if (!puerta.ok) return err(puerta.status, puerta.error);
  const leadId = Number(req.nextUrl.searchParams.get('leadId'));
  if (!Number.isSafeInteger(leadId) || leadId <= 0) return err(400, 'Falta el lead.');
  try {
    const lead = await contactoDeLead(leadId);
    if (!lead) return err(404, 'Ese lead no está.');
    return NextResponse.json({ ok: true, lead });
  } catch (e) {
    console.error(`[api:chats/contacto] ${leadId}: ${msg(e)}`);
    return err(500, 'No pude leer el contacto.');
  }
}

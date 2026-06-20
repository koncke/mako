// GET /api/contract?leadId= — redirige a una URL firmada para descargar el
// contrato guardado en Storage (bucket privado).
import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const leadId = Number(req.nextUrl.searchParams.get('leadId'));
  if (!Number.isFinite(leadId) || leadId <= 0) return Response.json({ error: 'leadId inválido' }, { status: 400 });

  const supabase = getSupabaseServer();
  const { data: lead, error } = await supabase.from('leads').select('contrato_path, contrato_nombre').eq('id', leadId).single();
  if (error || !lead?.contrato_path) return Response.json({ error: 'sin contrato' }, { status: 404 });

  const { data: signed, error: sErr } = await supabase.storage
    .from('contratos')
    .createSignedUrl(lead.contrato_path as string, 120, { download: (lead.contrato_nombre as string) || true });
  if (sErr || !signed?.signedUrl) return Response.json({ error: sErr?.message ?? 'no se pudo firmar' }, { status: 500 });

  return Response.redirect(signed.signedUrl, 302);
}

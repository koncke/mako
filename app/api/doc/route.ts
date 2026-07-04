// =============================================================================
// GET /api/doc?leadId=&kind=contrato|fiscal|comprobante&pagoId= — redirige a una
// URL firmada de Storage para PREVIEW inline del documento (el browser lo
// muestra, no lo descarga). Para descargar con nombre está /api/contract.
//   kind=contrato    → leads.contrato_path
//   kind=fiscal      → leads.deal_fiscal->doc_path
//   kind=comprobante → pagos.comprobante_path (pagoId requerido, del lead)
// getTenantDb scopea leads/pagos por workspace: un path ajeno nunca se firma.

import type { NextRequest } from 'next/server';
import { getTenantDb } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const KINDS = new Set(['contrato', 'fiscal', 'comprobante']);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const leadId = Number(sp.get('leadId'));
  const kind = sp.get('kind') ?? '';
  if (!Number.isFinite(leadId) || leadId <= 0) return Response.json({ error: 'leadId inválido' }, { status: 400 });
  if (!KINDS.has(kind)) return Response.json({ error: 'kind inválido' }, { status: 400 });

  const supabase = (await getTenantDb());
  let path: string | null = null;

  if (kind === 'comprobante') {
    const pagoId = Number(sp.get('pagoId'));
    if (!Number.isFinite(pagoId) || pagoId <= 0) return Response.json({ error: 'pagoId inválido' }, { status: 400 });
    // El pago tiene que ser del lead pedido Y del workspace (filtro del proxy).
    const { data } = await supabase
      .from('pagos')
      .select('comprobante_path')
      .eq('id', pagoId)
      .eq('lead_id', leadId)
      .maybeSingle();
    path = (data?.comprobante_path as string | null) ?? null;
  } else {
    const { data } = await supabase
      .from('leads')
      .select('contrato_path, deal_fiscal')
      .eq('id', leadId)
      .maybeSingle();
    if (kind === 'contrato') {
      path = (data?.contrato_path as string | null) ?? null;
    } else {
      const fiscal = (data?.deal_fiscal ?? null) as { doc_path?: string | null } | null;
      path = fiscal?.doc_path ?? null;
    }
  }

  if (!path) return Response.json({ error: 'sin documento' }, { status: 404 });

  // Por defecto SIN la opción download: el Content-Disposition queda inline y el
  // browser muestra el PDF/imagen embebido (el viewer de la tab Deal Details).
  // Con ?download=1 fuerza la descarga con el nombre del archivo.
  const descargar = sp.get('download') === '1';
  const { data: signed, error: sErr } = await supabase.storage
    .from('contratos')
    .createSignedUrl(path, 120, descargar ? { download: path.split('/').pop() || true } : undefined);
  if (sErr || !signed?.signedUrl) return Response.json({ error: sErr?.message ?? 'no se pudo firmar' }, { status: 500 });

  return Response.redirect(signed.signedUrl, 302);
}

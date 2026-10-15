// =============================================================================
// GET /api/doc?leadId=&kind=contrato|fiscal|comprobante&pagoId= — redirige a una
// URL firmada de Storage para PREVIEW inline del documento (el browser lo
// muestra, no lo descarga). Para descargar con nombre está /api/contract.
//   kind=contrato    → leads.contrato_path
//   kind=fiscal      → leads.deal_fiscal->doc_path
//   kind=comprobante → pagos.comprobante_path (pagoId requerido, del lead)
// getTenantDb acota la FILA (lead/pago) al workspace, pero NO la ruta: `.storage` pasa directo a la service
// role. Por eso la ruta se valida aparte (`rutaDeEsteLead`) antes de firmar.

import type { NextRequest } from 'next/server';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

const KINDS = new Set(['contrato', 'fiscal', 'comprobante']);

/**
 * ⚠️ SÓLO SE FIRMA UNA RUTA DE ESTE LEAD EN ESTE NEGOCIO (auditoría de seguridad del 14/10/2026). La ruta sale de
 * la fila del lead, y deal_fiscal.doc_path lo escribía el navegador: con la ruta de un archivo de otro negocio
 * guardada en un lead propio, esto la firmaba con la service role y redirigía al documento ajeno.
 * El prefijo `<ws>/<lead>/` solo NO alcanza: storage-js arma `${url}/object/sign/contratos/${path}` y fetch
 * normaliza los segmentos `..` y `%2e%2e` (WHATWG), así que `5/10/../../1/20/x.pdf` pasa el prefijo y firma
 * `1/20/x.pdf` — o, con un `..` más, un objeto de OTRO bucket. Las rutas que escribimos (extract-contract,
 * extract-deal-fiscal, extract-receipt) son `<ws>/<lead>/[fiscal/|comprobantes/]<ms>_<nombre>`, con el nombre ya
 * saneado a [\w.-]: un segmento vacío, `.`, `..`, `%`, `\`, `?` o `#` sólo puede ser una ruta armada a mano.
 * No se exporta (un route.ts sólo exporta los métodos y la config): tests/seguridad-crm-pagos-doc.test.ts la
 * ejecuta recortándola de este archivo. La misma función está en app/api/contract/route.ts.
 */
function rutaDeEsteLead(path: string, ws: number, leadId: number, aceptaLegado = false): boolean {
  // ⚠️ `aceptaLegado`: del 20/06 al 02/07/2026 extract-contract guardó `<lead>/<ms>_<nombre>`, SIN el workspace
  // (hasta 7ee06bb15). Medido en prod el 14/10: el contrato del lead 31 del ws1 sigue así y su objeto existe.
  // Se acepta SÓLO para contrato_path, que escribe únicamente el server; el id del lead es global, así que
  // `<lead>/` es de ese lead y de nadie más. Nunca para doc_path (deal_fiscal), que escribía el navegador.
  const prefijos = aceptaLegado ? [`${ws}/${leadId}/`, `${leadId}/`] : [`${ws}/${leadId}/`];
  const prefijo = prefijos.find((p) => path.startsWith(p));
  if (!prefijo) return false;
  const segmentos = path.slice(prefijo.length).split('/');
  return segmentos.every((s) => /^[\w.-]+$/.test(s) && s !== '.' && s !== '..');
}

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
  const ws = await getWorkspaceActual();
  if (ws == null || !rutaDeEsteLead(path, ws, leadId, kind === 'contrato')) return Response.json({ error: 'documento no disponible' }, { status: 403 });

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

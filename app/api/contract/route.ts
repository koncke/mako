// GET /api/contract?leadId= — redirige a una URL firmada para descargar el
// contrato guardado en Storage (bucket privado).
// getTenantDb acota la FILA del lead al workspace, pero NO la ruta: `.storage` pasa directo a la service role.
// Por eso la ruta se valida aparte (`rutaDeEsteLead`) antes de firmar.
import type { NextRequest } from 'next/server';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

/**
 * ⚠️ SÓLO SE FIRMA UNA RUTA DE ESTE LEAD EN ESTE NEGOCIO (auditoría de seguridad del 14/10/2026). Copia de la de
 * app/api/doc/route.ts, que explica el porqué: el prefijo solo no alcanza porque fetch normaliza `..` y `%2e%2e`
 * en la URL que arma storage-js. contrato_path hoy lo escribe sólo extract-contract con una ruta del server, pero
 * la firma no puede depender de que nadie más la escriba.
 * tests/seguridad-crm-pagos-doc.test.ts corre las dos copias con los mismos casos.
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
  const leadId = Number(req.nextUrl.searchParams.get('leadId'));
  if (!Number.isFinite(leadId) || leadId <= 0) return Response.json({ error: 'leadId inválido' }, { status: 400 });

  const supabase = (await getTenantDb());
  const { data: lead, error } = await supabase.from('leads').select('contrato_path, contrato_nombre').eq('id', leadId).single();
  if (error || !lead?.contrato_path) return Response.json({ error: 'sin contrato' }, { status: 404 });
  const ws = await getWorkspaceActual();
  if (ws == null || !rutaDeEsteLead(lead.contrato_path as string, ws, leadId, true)) return Response.json({ error: 'documento no disponible' }, { status: 403 });

  const { data: signed, error: sErr } = await supabase.storage
    .from('contratos')
    .createSignedUrl(lead.contrato_path as string, 120, { download: (lead.contrato_nombre as string) || true });
  if (sErr || !signed?.signedUrl) return Response.json({ error: sErr?.message ?? 'no se pudo firmar' }, { status: 500 });

  return Response.redirect(signed.signedUrl, 302);
}

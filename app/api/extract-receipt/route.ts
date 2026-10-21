// =============================================================================
// POST /api/extract-receipt — sube el comprobante de pago de una cuota y extrae
// monto/fecha/hora con OpenAI, para prellenar el pop-up "Marcar pagada" del CRM.
// =============================================================================
// Recibe multipart: file + leadId + pagoId. Verifica que el lead y el pago sean
// del workspace ANTES de tocar Storage (mismo patrón que extract-contract: el
// bucket no se scopea solo, así que el path se prefija con el workspace_id).
// Guarda comprobante_path/comprobante_nombre en la fila de pagos, pero NO marca
// el pago como pagado: eso lo decide la UI con su action (auditada).

import type { NextRequest } from 'next/server';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { getPromptText } from '@/lib/prompt-render';
import { RECEIPT_EXTRACT_DEFAULT } from '@/lib/prompt-defaults';
import { leerDocumentoIA } from '@/lib/ai-cheap';
import { normalizarMoneda } from '@/lib/pasarela-moneda';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;

// Parsea el JSON que devuelve la IA, tolerando cercas ```json o texto alrededor.
function parseJsonLoose(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text) as Record<string, unknown>; } catch { /* sigue */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { /* sigue */ } }
  return null;
}

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: 'form inválido' }, { status: 400 }); }
  const file = form.get('file') as File | null;
  const leadId = Number(form.get('leadId'));
  const pagoId = Number(form.get('pagoId'));
  if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'falta el archivo' }, { status: 400 });
  if (!Number.isFinite(leadId) || leadId <= 0) return Response.json({ error: 'leadId inválido' }, { status: 400 });
  if (!Number.isFinite(pagoId) || pagoId <= 0) return Response.json({ error: 'pagoId inválido' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) return Response.json({ error: `archivo muy grande (${(buf.length / 1048576).toFixed(1)} MB > 20 MB)` }, { status: 400 });
  const mime = file.type || 'application/octet-stream';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  // Seguridad multi-tenant: lead del workspace + pago de ese lead, ANTES de
  // escribir en Storage. getTenantDb ya filtra ambas tablas por workspace_id.
  const supabase = (await getTenantDb());
  const ws = await getWorkspaceActual();
  if (ws == null) return Response.json({ error: 'workspace no resuelto' }, { status: 403 });
  const { data: leadRow } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();
  if (!leadRow?.id) return Response.json({ error: 'lead no encontrado' }, { status: 404 });
  const { data: pagoRow } = await supabase.from('pagos').select('id, pagado').eq('id', pagoId).eq('lead_id', leadId).maybeSingle();
  if (!pagoRow?.id) return Response.json({ error: 'pago no encontrado' }, { status: 404 });
  // ⚠️ UNA CUOTA YA COBRADA NO CAMBIA DE COMPROBANTE DESDE ACÁ (21/10/2026, revisión de Pagos): con una vista vieja (otra
  // pestaña, o un link que se pagó mientras tanto), abrir «Marcar pagada» le pisaba el comprobante a una cuota cobrada
  // (el PDF del banco, el de Stripe) con la foto del chat, y cancelar no lo deshacía.
  if ((pagoRow as { pagado?: boolean | null }).pagado) return Response.json({ error: 'Esa cuota ya está cobrada: su comprobante no se cambia desde aquí.', ya_cobrada: true }, { status: 409 });

  // Subir el comprobante y registrarlo en la fila del pago.
  const safe = (file.name || 'comprobante').replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${ws}/${leadId}/comprobantes/${Date.now()}_${safe}`;
  const { error: upErr } = await supabase.storage.from('contratos').upload(path, buf, { contentType: mime, upsert: true });
  if (upErr) return Response.json({ error: `storage: ${upErr.message}` }, { status: 500 });
  const comprobante_nombre = file.name || safe;
  const { data: tocadas, error: dbErr } = await supabase
    .from('pagos')
    .update({ comprobante_path: path, comprobante_nombre })
    .eq('id', pagoId)
    .eq('lead_id', leadId)
    .eq('pagado', false)
    .select('id');
  if (dbErr) return Response.json({ error: `pagos: ${dbErr.message}` }, { status: 500 });
  if (!tocadas?.length) return Response.json({ error: 'Esa cuota ya está cobrada: su comprobante no se cambia desde aquí.', ya_cobrada: true }, { status: 409 });

  const prompt = await getPromptText('contracts.extract_receipt.user', RECEIPT_EXTRACT_DEFAULT);
  const isPdf = mime.includes('pdf') || (file.name || '').toLowerCase().endsWith('.pdf');

  // Lectura por cascade gratis (Gemini → OpenAI). El comprobante ya quedó subido
  // arriba, así que si la IA falla igual devolvemos el nombre para no perderlo.
  let text: string;
  try {
    const res = await leerDocumentoIA({ dataUrl, isPdf, nombreArchivo: file.name || 'comprobante', prompt, json: true, feature: 'extract_receipt' });
    text = res.text;
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err), comprobante_nombre }, { status: 502 });
  }
  const parsed = parseJsonLoose(text);
  if (!parsed) return Response.json({ error: 'no se pudo parsear la respuesta', comprobante_nombre }, { status: 502 });
  // ⚠️ EL MONTO Y LA MONEDA DEL COMPROBANTE, SIN CONVERTIR (21/10/2026): la pantalla decide (dólares, o la moneda del
  // negocio con su valor en dólares = el de la cuota). Un prompt viejo guardado en Configuraciones devuelve `monto_usd`:
  // sólo vale si NO lo convirtió (sin nota del tipo de cambio); convertido, el monto no se usa.
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  let monto = num(parsed.monto);
  let moneda = monto != null && typeof parsed.moneda === 'string' ? normalizarMoneda(parsed.moneda) : null;
  if (monto == null && num(parsed.monto_usd) != null && !(typeof parsed.nota === 'string' && parsed.nota.trim())) {
    monto = num(parsed.monto_usd);
    moneda = 'USD';
  }
  return Response.json({
    monto,
    moneda,
    fecha: typeof parsed.fecha === 'string' && parsed.fecha ? parsed.fecha : null,
    hora: typeof parsed.hora === 'string' && parsed.hora ? parsed.hora : null,
    nota: typeof parsed.nota === 'string' && parsed.nota ? parsed.nota : null,
    comprobante_nombre,
  });
}

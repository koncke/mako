// =============================================================================
// POST /api/extract-deal-fiscal — sube el documento fiscal DEL CLIENTE del deal
// (constancia/RFC/CUIT del lead), lo guarda en Storage (deal_fiscal.doc_path) y
// extrae razón/ID fiscal/domicilio/correo con OpenAI para prellenar la sección
// "Datos fiscales" del Deal Details. Solo devuelve los campos: la UI los aplica
// fill-if-empty y guarda con la acción del deal (auditada).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { leerDocumentoIA } from '@/lib/ai-cheap';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;

const PROMPT = `Eres un extractor de datos fiscales del CLIENTE al que se le factura. Te paso un documento fiscal (constancia de situación fiscal/RFC de México, comprobante de CUIT de Argentina, RUT, NIT, EIN…). Extrae los datos de facturación del cliente.
Devuelve SOLO un objeto JSON (usa null si el dato no aparece):
{ "razon": "razón social / nombre", "id_fiscal": "RFC/CUIT/NIT/EIN tal cual", "domicilio": "domicilio fiscal en una línea", "correo": "correo de facturación si aparece" }
No inventes. No agregues texto fuera del JSON.`;

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: 'form inválido' }, { status: 400 }); }
  const file = form.get('file') as File | null;
  const leadId = Number(form.get('leadId'));
  if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'falta el archivo' }, { status: 400 });
  if (!Number.isFinite(leadId) || leadId <= 0) return Response.json({ error: 'leadId inválido' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) return Response.json({ error: `archivo muy grande (${(buf.length / 1048576).toFixed(1)} MB > 20 MB)` }, { status: 400 });
  const mime = file.type || 'application/octet-stream';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  const supabase = (await getTenantDb());
  const ws = await getWorkspaceActual();
  if (ws == null) return Response.json({ error: 'workspace no resuelto' }, { status: 403 });
  const { data: leadRow } = await supabase.from('leads').select('id, deal_fiscal').eq('id', leadId).maybeSingle();
  if (!leadRow?.id) return Response.json({ error: 'lead no encontrado' }, { status: 404 });

  // Guardar el documento fiscal del cliente y registrar su path en deal_fiscal.
  const safe = (file.name || 'fiscal').replace(/[^\w.\-]+/g, '_').slice(-80);
  const path = `${ws}/${leadId}/fiscal/${Date.now()}_${safe}`;
  const { error: upErr } = await supabase.storage.from('contratos').upload(path, buf, { contentType: mime, upsert: true });
  if (upErr) return Response.json({ error: `storage: ${upErr.message}` }, { status: 500 });
  const doc_nombre = file.name || safe;
  const fiscalActual = (leadRow.deal_fiscal ?? {}) as Record<string, unknown>;
  const { error: dbErr } = await supabase.from('leads').update({ deal_fiscal: { ...fiscalActual, doc_path: path, doc_nombre } }).eq('id', leadId);
  if (dbErr) return Response.json({ error: `leads: ${dbErr.message}` }, { status: 500 });

  const isPdf = mime.includes('pdf') || (file.name || '').toLowerCase().endsWith('.pdf');

  try {
    let modelText: string;
    try {
      const out = await leerDocumentoIA({ dataUrl, isPdf, nombreArchivo: file.name || 'fiscal.pdf', prompt: PROMPT, json: true, feature: 'extract-deal-fiscal', motivo: `lead ${leadId}`, timeoutMs: 100000 });
      modelText = out.text;
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : String(e), doc_nombre }, { status: 502 });
    }
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(modelText || '{}'); } catch { return Response.json({ error: 'no se pudo parsear la respuesta', doc_nombre }, { status: 502 }); }
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    return Response.json({
      razon: str(parsed.razon),
      id_fiscal: str(parsed.id_fiscal),
      domicilio: str(parsed.domicilio),
      correo: str(parsed.correo),
      doc_nombre,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err), doc_nombre }, { status: 500 });
  }
}

// =============================================================================
// POST /api/extract-contract — extrae el plan de pagos de un contrato (PDF o
// imagen) con OpenAI, para autollenar el plan de pagos del lead en el CRM.
// =============================================================================
// Recibe el archivo (multipart 'file'). PDF → se manda como documento; imagen →
// como visión. Devuelve JSON con total, duración, fechas y cuotas.

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const oai = process.env.OPENAI_API_KEY;
  if (!oai) return Response.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 });

  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: 'form inválido' }, { status: 400 }); }
  const file = form.get('file') as File | null;
  const leadId = Number(form.get('leadId'));
  if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'falta el archivo' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) return Response.json({ error: `archivo muy grande (${(buf.length / 1048576).toFixed(1)} MB > 20 MB)` }, { status: 400 });
  const mime = file.type || 'application/octet-stream';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  // Guardar el archivo en Storage y registrarlo en el lead.
  let contrato_nombre: string | null = null;
  if (Number.isFinite(leadId) && leadId > 0) {
    try {
      const supabase = getSupabaseServer();
      const safe = (file.name || 'contrato').replace(/[^\w.\-]+/g, '_').slice(-80);
      const path = `${leadId}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from('contratos').upload(path, buf, { contentType: mime, upsert: true });
      if (!upErr) {
        contrato_nombre = file.name || safe;
        await supabase.from('leads').update({ contrato_path: path, contrato_nombre }).eq('id', leadId);
      } else {
        console.warn('[extract-contract] storage:', upErr.message);
      }
    } catch (e) { console.warn('[extract-contract] storage falló:', e instanceof Error ? e.message : String(e)); }
  }

  const prompt = 'Eres un asistente que extrae el PLAN DE PAGOS de un contrato de servicios profesionales. Lee el documento y devuelve SOLO JSON con esta forma exacta: {"total_usd": number|null, "duracion_meses": number|null, "fecha_cierre": "dd/mm/aaaa"|null, "fecha_inicio": "dd/mm/aaaa"|null, "cuotas": [{"monto": number, "fecha": "dd/mm/aaaa"}]}. Definiciones: total_usd = monto total del plan/contrato en USD (solo el número); duracion_meses = duración del servicio en meses; fecha_cierre = fecha de firma o cierre del contrato; fecha_inicio = fecha de inicio del servicio; cuotas = cada pago previsto (incluye el pago inicial si lo hay) con su monto en USD y su fecha. Convierte fechas a dd/mm/aaaa. Si un dato no aparece, usa null (o [] para cuotas). No inventes datos que no estén en el documento.';

  // PDF → documento; imagen → visión.
  const isPdf = mime.includes('pdf') || (file.name || '').toLowerCase().endsWith('.pdf');
  const content = isPdf
    ? [{ type: 'text', text: prompt }, { type: 'file', file: { filename: file.name || 'contrato.pdf', file_data: dataUrl } }]
    : [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }];

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${oai}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content }] }),
    });
    const j = await r.json();
    if (j.error) return Response.json({ error: `openai: ${j.error.message}` }, { status: 502 });
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(j.choices?.[0]?.message?.content ?? '{}'); } catch { return Response.json({ error: 'no se pudo parsear la respuesta' }, { status: 502 }); }
    return Response.json({
      total_usd: parsed.total_usd ?? null,
      duracion_meses: parsed.duracion_meses ?? null,
      fecha_cierre: parsed.fecha_cierre ?? null,
      fecha_inicio: parsed.fecha_inicio ?? null,
      cuotas: Array.isArray(parsed.cuotas) ? parsed.cuotas : [],
      contrato_nombre,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

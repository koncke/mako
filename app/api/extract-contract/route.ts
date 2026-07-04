// =============================================================================
// POST /api/extract-contract — extrae el plan de pagos + Deal Details de un
// contrato (PDF o imagen) con OpenAI, para autollenar el lead en el CRM.
// =============================================================================
// Recibe el archivo (multipart 'file'). PDF → se manda como documento; imagen →
// como visión. Devuelve JSON con total, duración, fechas, cuotas y las secciones
// del Deal Details (fiscal, servicio, promesa, obligaciones), resumidas en
// lenguaje simple. Además rellena en el lead SOLO los campos deal_* (y empresa)
// que estén VACÍOS: nunca pisa lo ya cargado a mano.

import type { NextRequest } from 'next/server';
import { getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { getPromptText } from '@/lib/prompt-render';
import { CONTRACT_EXTRACT_DEFAULT } from '@/lib/prompt-defaults';

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

  const supabase = (await getTenantDb());
  let buf: Buffer;
  let mime: string;
  let nombreArchivo: string;
  let contrato_nombre: string | null = null;

  if (file && typeof file.arrayBuffer === 'function') {
    // Camino A: subieron un archivo nuevo → guardarlo y usarlo.
    buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_BYTES) return Response.json({ error: `archivo muy grande (${(buf.length / 1048576).toFixed(1)} MB > 20 MB)` }, { status: 400 });
    mime = file.type || 'application/octet-stream';
    nombreArchivo = file.name || 'contrato';
    if (Number.isFinite(leadId) && leadId > 0) {
      try {
        const { data: leadRow } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();
        const ws = await getWorkspaceActual();
        if (leadRow?.id && ws != null) {
          const safe = nombreArchivo.replace(/[^\w.\-]+/g, '_').slice(-80);
          const path = `${ws}/${leadId}/${Date.now()}_${safe}`;
          const { error: upErr } = await supabase.storage.from('contratos').upload(path, buf, { contentType: mime, upsert: true });
          if (!upErr) { contrato_nombre = nombreArchivo; await supabase.from('leads').update({ contrato_path: path, contrato_nombre }).eq('id', leadId); }
          else console.warn('[extract-contract] storage:', upErr.message);
        }
      } catch (e) { console.warn('[extract-contract] storage falló:', e instanceof Error ? e.message : String(e)); }
    }
  } else {
    // Camino B: sin archivo → releer el contrato YA cargado del lead (Completar con IA).
    if (!Number.isFinite(leadId) || leadId <= 0) return Response.json({ error: 'falta el archivo' }, { status: 400 });
    const { data: leadRow } = await supabase.from('leads').select('id, contrato_path, contrato_nombre').eq('id', leadId).maybeSingle();
    const cp = (leadRow as { contrato_path?: string | null; contrato_nombre?: string | null } | null)?.contrato_path;
    if (!cp) return Response.json({ error: 'no hay contrato cargado para releer' }, { status: 400 });
    const { data: blob, error: dlErr } = await supabase.storage.from('contratos').download(cp);
    if (dlErr || !blob) return Response.json({ error: `no se pudo leer el contrato guardado: ${dlErr?.message ?? ''}` }, { status: 500 });
    buf = Buffer.from(await blob.arrayBuffer());
    mime = blob.type || (cp.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    nombreArchivo = (leadRow as { contrato_nombre?: string | null }).contrato_nombre ?? 'contrato.pdf';
    contrato_nombre = nombreArchivo;
  }
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  const prompt = await getPromptText('contracts.extract_payment_plan.user', CONTRACT_EXTRACT_DEFAULT);

  // PDF → documento; imagen → visión.
  const isPdf = mime.includes('pdf') || nombreArchivo.toLowerCase().endsWith('.pdf');
  const content = isPdf
    ? [{ type: 'text', text: prompt }, { type: 'file', file: { filename: nombreArchivo.toLowerCase().endsWith('.pdf') ? nombreArchivo : 'contrato.pdf', file_data: dataUrl } }]
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

    const servicio = (parsed.servicio ?? {}) as Record<string, unknown>;
    const asumido: string[] = [];
    // Defaults: modalidad → Online; frecuencia → 1 vez por semana; término = inicio + duración.
    if (!txt(servicio.modalidad)) { servicio.modalidad = 'Online'; asumido.push('modalidad: Online'); }
    if (!txt(servicio.frecuencia)) { servicio.frecuencia = '1 vez por semana'; asumido.push('frecuencia: 1 vez por semana'); }
    if (!txt(servicio.fecha_termino)) {
      const term = calcTermino(txt(servicio.fecha_inicio) ?? txt(parsed.fecha_inicio), txt(servicio.duracion), parsed.duracion_meses);
      if (term) { servicio.fecha_termino = term; asumido.push('fecha de término (calculada)'); }
    }

    // NO se guarda nada en el lead: la UI llena el borrador y guarda con "Guardar
    // cambios" (así los datos aparecen al toque y no se persisten sin confirmar).
    return Response.json({
      total_usd: parsed.total_usd ?? null,
      duracion_meses: parsed.duracion_meses ?? null,
      fecha_cierre: parsed.fecha_cierre ?? null,
      fecha_inicio: parsed.fecha_inicio ?? null,
      cuotas: Array.isArray(parsed.cuotas) ? parsed.cuotas : [],
      empresa: parsed.empresa ?? null,
      fiscal: parsed.fiscal ?? null,
      servicio,
      promesa: parsed.promesa ?? null,
      obligaciones: parsed.obligaciones ?? null,
      nota: parsed.nota ?? null,
      asumido,
      contrato_nombre,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

const txt = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

// fecha_inicio (YYYY-MM-DD) + duración (meses, de duracion_meses o texto tipo
// "3 meses") → fecha_termino calculada. null si no hay datos suficientes.
function calcTermino(inicio: string | null, duracionTxt: string | null, duracionMeses: unknown): string | null {
  if (!inicio || !/^\d{4}-\d{2}-\d{2}/.test(inicio)) return null;
  let meses: number | null = typeof duracionMeses === 'number' && Number.isFinite(duracionMeses) ? duracionMeses : null;
  if (meses == null && duracionTxt) { const m = duracionTxt.match(/(\d+)\s*mes/i); if (m) meses = Number(m[1]); }
  if (meses == null || meses <= 0) return null;
  const [y, mo, d] = inicio.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1 + meses, Math.min(d, 28)));
  return dt.toISOString().slice(0, 10);
}

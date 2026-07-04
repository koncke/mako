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
  if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'falta el archivo' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) return Response.json({ error: `archivo muy grande (${(buf.length / 1048576).toFixed(1)} MB > 20 MB)` }, { status: 400 });
  const mime = file.type || 'application/octet-stream';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

  // Guardar el archivo en Storage y registrarlo en el lead.
  let contrato_nombre: string | null = null;
  if (Number.isFinite(leadId) && leadId > 0) {
    try {
      const supabase = (await getTenantDb());
      // Storage NO se scopea por workspace (getTenantDb solo envuelve .from(table)).
      // Verificamos que el lead sea del workspace del caller ANTES de escribir, y
      // prefijamos el path con el workspace_id para evitar pisar contratos ajenos.
      const { data: leadRow } = await supabase.from('leads').select('id').eq('id', leadId).maybeSingle();
      const ws = await getWorkspaceActual();
      if (leadRow?.id && ws != null) {
        const safe = (file.name || 'contrato').replace(/[^\w.\-]+/g, '_').slice(-80);
        const path = `${ws}/${leadId}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage.from('contratos').upload(path, buf, { contentType: mime, upsert: true });
        if (!upErr) {
          contrato_nombre = file.name || safe;
          await supabase.from('leads').update({ contrato_path: path, contrato_nombre }).eq('id', leadId);
        } else {
          console.warn('[extract-contract] storage:', upErr.message);
        }
      }
    } catch (e) { console.warn('[extract-contract] storage falló:', e instanceof Error ? e.message : String(e)); }
  }

  const prompt = await getPromptText('contracts.extract_payment_plan.user', CONTRACT_EXTRACT_DEFAULT);

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

    // Autollenado del lead: SOLO campos vacíos (fill-if-empty, nunca pisar).
    if (Number.isFinite(leadId) && leadId > 0) {
      try { await rellenarLeadSiVacio(leadId, parsed); }
      catch (e) { console.warn('[extract-contract] autollenado falló:', e instanceof Error ? e.message : String(e)); }
    }

    // Devolvemos TODO lo extraído para que la UI muestre qué encontró la IA.
    return Response.json({
      total_usd: parsed.total_usd ?? null,
      duracion_meses: parsed.duracion_meses ?? null,
      fecha_cierre: parsed.fecha_cierre ?? null,
      fecha_inicio: parsed.fecha_inicio ?? null,
      cuotas: Array.isArray(parsed.cuotas) ? parsed.cuotas : [],
      empresa: parsed.empresa ?? null,
      fiscal: parsed.fiscal ?? null,
      servicio: parsed.servicio ?? null,
      promesa: parsed.promesa ?? null,
      obligaciones: parsed.obligaciones ?? null,
      nota: parsed.nota ?? null,
      contrato_nombre,
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fill-if-empty: completa en el lead SOLO lo que esté vacío. Lo cargado a mano
// (o por una extracción anterior) NO se pisa jamás.
// ─────────────────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

const texto = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const vacio = (v: unknown): boolean => v == null || (typeof v === 'string' && !v.trim());
const lista = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean) : [];

// Merge por campo de una sección jsonb: conserva TODO lo existente (incluidos
// campos ajenos como doc_path/doc_nombre) y solo llena los declarados vacíos.
function mergeSeccion(actual: unknown, extraido: unknown, campos: string[]): Json | null {
  if (!extraido || typeof extraido !== 'object') return null;
  const base: Json = { ...((actual as Json | null) ?? {}) };
  let cambio = false;
  for (const c of campos) {
    const nuevo = texto((extraido as Json)[c]);
    if (vacio(base[c]) && nuevo) { base[c] = nuevo; cambio = true; }
  }
  return cambio ? base : null;
}

async function rellenarLeadSiVacio(leadId: number, parsed: Json): Promise<void> {
  const supabase = (await getTenantDb());
  const { data: lead } = await supabase
    .from('leads')
    .select('empresa, deal_fiscal, deal_servicio, deal_promesa, deal_obligaciones')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return; // lead de otro workspace (o inexistente) → no tocar nada

  const upd: Json = {};

  // empresa (vive en otras tabs del lead): la completa el contrato si falta.
  const empresaNueva = texto(parsed.empresa) ?? texto((parsed.fiscal as Json | null)?.razon);
  if (vacio(lead.empresa) && empresaNueva) upd.empresa = empresaNueva;

  const fiscal = mergeSeccion(lead.deal_fiscal, parsed.fiscal, ['razon', 'id_fiscal', 'domicilio', 'correo']);
  if (fiscal) upd.deal_fiscal = fiscal;

  const servicio = mergeSeccion(lead.deal_servicio, parsed.servicio, ['que_es', 'fecha_inicio', 'fecha_termino', 'duracion', 'frecuencia', 'modalidad', 'sesiones']);
  if (servicio) upd.deal_servicio = servicio;

  const promesa = mergeSeccion(lead.deal_promesa, parsed.promesa, ['resultado', 'garantia']);
  if (promesa) upd.deal_promesa = promesa;

  // Obligaciones: listas — solo se llenan si la lista actual está vacía.
  const oblExt = (parsed.obligaciones ?? null) as Json | null;
  if (oblExt && typeof oblExt === 'object') {
    const oblAct = ((lead.deal_obligaciones as Json | null) ?? {});
    const nueva: Json = { ...oblAct };
    let cambio = false;
    for (const lado of ['cliente', 'prestador'] as const) {
      const extraida = lista(oblExt[lado]);
      if (lista(oblAct[lado]).length === 0 && extraida.length > 0) { nueva[lado] = extraida; cambio = true; }
    }
    if (cambio) upd.deal_obligaciones = nueva;
  }

  if (Object.keys(upd).length === 0) return;
  const { error } = await supabase.from('leads').update(upd).eq('id', leadId);
  if (error) throw new Error(error.message);
}

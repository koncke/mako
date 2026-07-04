// =============================================================================
// POST /api/extract-fiscal — sube el documento fiscal PROPIO del workspace
// (constancia de situación fiscal / RFC / CUIT / cédula…) y extrae con OpenAI
// razón social, identificación fiscal, domicilio y correo, para prellenar el
// alta de una identidad fiscal en Configuraciones. No persiste nada: solo
// devuelve los campos para que el usuario los revise y guarde.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getWorkspaceActual } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;

const PROMPT = `Sos un extractor de datos fiscales. Te paso un documento fiscal (constancia de situación fiscal de México/RFC, comprobante de CUIT de Argentina, RUT, NIT, EIN, o similar) de la EMPRESA que factura. Extraé sus datos de facturación.
Devolvé SOLO un objeto JSON con estas claves (usá null si el dato no aparece):
{
  "razon": "razón social / nombre completo",
  "id_fiscal": "el identificador fiscal (RFC, CUIT, NIT, EIN…) tal cual figura",
  "domicilio": "domicilio fiscal completo en una línea",
  "correo": "correo de facturación si aparece"
}
No inventes datos. No agregues texto fuera del JSON.`;

export async function POST(req: NextRequest) {
  const oai = process.env.OPENAI_API_KEY;
  if (!oai) return Response.json({ error: 'OPENAI_API_KEY no configurada' }, { status: 500 });

  // Solo usuarios del workspace (con sesión); no expone nada sensible igual.
  const ws = await getWorkspaceActual();
  if (ws == null) return Response.json({ error: 'workspace no resuelto' }, { status: 403 });

  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: 'form inválido' }, { status: 400 }); }
  const file = form.get('file') as File | null;
  if (!file || typeof file.arrayBuffer !== 'function') return Response.json({ error: 'falta el archivo' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) return Response.json({ error: `archivo muy grande (${(buf.length / 1048576).toFixed(1)} MB > 20 MB)` }, { status: 400 });
  const mime = file.type || 'application/octet-stream';
  const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
  const isPdf = mime.includes('pdf') || (file.name || '').toLowerCase().endsWith('.pdf');
  const content = isPdf
    ? [{ type: 'text', text: PROMPT }, { type: 'file', file: { filename: file.name || 'fiscal.pdf', file_data: dataUrl } }]
    : [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }];

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
    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
    return Response.json({
      razon: str(parsed.razon),
      id_fiscal: str(parsed.id_fiscal),
      domicilio: str(parsed.domicilio),
      correo: str(parsed.correo),
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

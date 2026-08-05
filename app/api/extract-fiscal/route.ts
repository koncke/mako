// =============================================================================
// POST /api/extract-fiscal — sube el documento fiscal PROPIO del workspace
// (constancia de situación fiscal / RFC / CUIT / cédula…) y extrae con IA
// razón social, identificación fiscal, domicilio y correo, para prellenar el
// alta de una identidad fiscal en Configuraciones. No persiste nada: solo
// devuelve los campos para que el usuario los revise y guarde.
//
// Lectura por CASCADE GRATIS (Gemini → OpenAI, ver lib/ai-cheap): antes cortaba
// duro sin OPENAI_API_KEY; ahora usa la key del workspace y cae a la que haya.
// Si no hay ninguna con visión, el error ya apunta a Integraciones.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getWorkspaceActual } from '@/lib/workspace';
import { leerDocumentoIA } from '@/lib/ai-cheap';

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

// Parsea el JSON que devuelve la IA, tolerando cercas ```json o texto alrededor.
function parseJsonLoose(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text) as Record<string, unknown>; } catch { /* sigue */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]) as Record<string, unknown>; } catch { /* sigue */ } }
  return null;
}

export async function POST(req: NextRequest) {
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

  let text: string;
  try {
    const res = await leerDocumentoIA({ dataUrl, isPdf, nombreArchivo: file.name || 'fiscal', prompt: PROMPT, json: true, feature: 'extract_fiscal' });
    text = res.text;
  } catch (err) {
    // El mensaje ya explica si falta la key y apunta a Integraciones.
    return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
  const parsed = parseJsonLoose(text);
  if (!parsed) return Response.json({ error: 'no se pudo parsear la respuesta' }, { status: 502 });
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return Response.json({
    razon: str(parsed.razon),
    id_fiscal: str(parsed.id_fiscal),
    domicilio: str(parsed.domicilio),
    correo: str(parsed.correo),
  });
}

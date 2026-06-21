// =============================================================================
// /api/mako/onboarding/extract — lee un template/doc subido y completa campos
// =============================================================================
// Recibe un archivo (.txt / .md / .docx) + la lista de campos de la fase, saca
// el texto y le pide a OpenAI que mapee el texto a los valores de cada campo.

import type { NextRequest } from 'next/server';
import { extractAnswersFromText } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); } catch { return Response.json({ error: 'Subida inválida' }, { status: 400 }); }

  const file = form.get('file');
  const fieldsRaw = form.get('fields');
  if (!(file instanceof File)) return Response.json({ error: 'Falta el archivo' }, { status: 400 });

  let fields: Array<{ key: string; label: string }> = [];
  try { fields = JSON.parse(typeof fieldsRaw === 'string' ? fieldsRaw : '[]'); } catch { fields = []; }

  try {
    const name = file.name.toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());
    let texto = '';
    if (name.endsWith('.docx')) {
      const mammoth = (await import('mammoth')).default;
      const result = await mammoth.extractRawText({ buffer: buf });
      texto = result.value;
    } else if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.markdown') || (file.type || '').startsWith('text/')) {
      texto = buf.toString('utf8');
    } else {
      return Response.json({ error: 'Formato no soportado. Subí .txt, .md o .docx (o exportá tu documento a uno de esos).' }, { status: 400 });
    }
    if (!texto.trim()) return Response.json({ error: 'No se pudo leer texto del archivo.' }, { status: 400 });

    const answers = await extractAnswersFromText(texto, fields);
    return Response.json({ answers });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

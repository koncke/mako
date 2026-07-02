// =============================================================================
// API interna: sube una MUESTRA de media para el encabezado de una plantilla.
// =============================================================================
// Recibe un archivo (multipart), lo sube al resumable-upload de Meta y devuelve el
// "handle" + el formato (IMAGE/VIDEO/DOCUMENT) para guardarlo en el borrador.
// =============================================================================

import { uploadMediaSample, type HeaderMediaFormat } from '@/lib/meta-templates';
import { esWorkspaceDueno } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

// Tipos y topes que acepta Meta para la muestra del encabezado.
const IMG = ['image/jpeg', 'image/png'];
const VID = ['video/mp4', 'video/3gpp'];
const DOC = ['application/pdf'];
const MAX = { IMAGE: 5 * 1024 * 1024, VIDEO: 16 * 1024 * 1024, DOCUMENT: 100 * 1024 * 1024 };

function formatoDe(mime: string): HeaderMediaFormat | null {
  if (IMG.includes(mime)) return 'IMAGE';
  if (VID.includes(mime)) return 'VIDEO';
  if (DOC.includes(mime)) return 'DOCUMENT';
  return null;
}

export async function POST(req: Request) {
  // Fase 1: subir la muestra la manda al WABA global del dueño en Meta.
  if (!(await esWorkspaceDueno())) return Response.json({ ok: false, error: 'solo el workspace dueño (Fase 1)' }, { status: 403 });
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ ok: false, error: 'falta el archivo' }, { status: 400 });

    const format = formatoDe(file.type);
    if (!format) {
      return Response.json({ ok: false, error: 'Formato no soportado. Imagen (jpg/png), video (mp4) o PDF.' }, { status: 400 });
    }
    if (file.size > MAX[format]) {
      const mb = Math.round(MAX[format] / (1024 * 1024));
      return Response.json({ ok: false, error: `El archivo supera el máximo (${mb} MB para ${format.toLowerCase()}).` }, { status: 413 });
    }

    const bytes = await file.arrayBuffer();
    const r = await uploadMediaSample(bytes, file.type, file.name || 'sample');
    if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
    return Response.json({ ok: true, handle: r.handle, format, filename: file.name || 'sample' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/templates/media] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

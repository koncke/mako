// =============================================================================
// /api/mako/knowledge/transcribe — sube un video/audio de una clase → transcript
// =============================================================================
// Recibe un archivo (multipart) de una clase de curso, lo transcribe con OpenAI
// (whisper-1) y devuelve el texto para que el usuario lo revise y lo guarde en el
// conocimiento. No persiste nada: el guardado lo hace /api/mako/knowledge (create),
// así el usuario ve/edita la transcripción antes de embeberla.
// =============================================================================

import { transcribeMediaBuffer } from '@/lib/transcribe';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    const hint = typeof form.get('hint') === 'string' ? (form.get('hint') as string) : undefined;
    if (!(file instanceof File)) return Response.json({ ok: false, error: 'falta el archivo' }, { status: 400 });

    // El navegador a veces reporta type '' o 'application/octet-stream' para
    // contenedores válidos (.m4a/.mov/.mkv en Windows). Whisper detecta por
    // contenido/extensión, así que aceptamos MIME vacío/genérico o extensión de
    // media, y solo rechazamos tipos claramente ajenos (imágenes, pdf, texto…).
    const mime = file.type || '';
    const nombre = (file.name || '').toLowerCase();
    const extMedia = /\.(mp3|m4a|wav|ogg|oga|opus|webm|mp4|mov|mkv|mpeg|mpga|flac|aac|3gp|amr)$/.test(nombre);
    const mimeMedia = mime.startsWith('audio/') || mime.startsWith('video/');
    // Aceptamos por MIME de media, o por extensión de media (cubre el caso en que
    // el navegador reporta type '' o 'application/octet-stream' para .m4a/.mov/.mkv).
    if (!mimeMedia && !extMedia) {
      return Response.json({ ok: false, error: 'Formato no soportado. Subí un audio o un video de la clase.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const r = await transcribeMediaBuffer(bytes, mime, file.name || 'clase', hint);
    if (r.status !== 'ok') {
      return Response.json({ ok: false, error: r.error ?? 'No se pudo transcribir.' }, { status: r.status === 'muy_grande' ? 413 : 500 });
    }
    if (!r.transcript?.trim()) {
      return Response.json({ ok: false, error: 'La transcripción quedó vacía (¿el archivo tenía audio?).' }, { status: 422 });
    }
    return Response.json({ ok: true, transcript: r.transcript, idioma: r.idioma, duracion_s: r.duracion_s });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[api:mako/knowledge/transcribe] ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

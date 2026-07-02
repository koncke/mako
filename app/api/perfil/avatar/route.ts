// =============================================================================
// /api/perfil/avatar — subir la foto de perfil al bucket público "avatars"
// =============================================================================
// Recibe un archivo (FormData 'file'), lo sube a Supabase Storage y devuelve la
// URL pública. El caller guarda esa URL como user_avatar_url del perfil.

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { getUsuarioActual } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const BUCKET = 'avatars';
const MAX = 5 * 1024 * 1024; // 5MB

// Solo formatos raster inertes. NUNCA image/svg+xml: un SVG es documento activo
// (<script>/onload) y el bucket es público → sería XSS/malware bajo nuestro dominio.
const EXT_DE: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
};

/** Detecta el tipo real por magic bytes (no confía en file.type, que lo pone el cliente). */
function sniffImagen(buf: Buffer): keyof typeof EXT_DE | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const sesion = await getUsuarioActual();
    if (!sesion) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ ok: false, error: 'No llegó ningún archivo' }, { status: 400 });
    if (file.size > MAX) return Response.json({ ok: false, error: 'La imagen supera los 5MB' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());
    // La verdad es el contenido, no el header del cliente: sniff de magic bytes.
    const tipo = sniffImagen(buf);
    if (!tipo) return Response.json({ ok: false, error: 'Formato no permitido. Usá JPG, PNG, WEBP o GIF.' }, { status: 400 });

    const supabase = getSupabaseServer();
    try { await supabase.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }

    // Carpeta por usuario: la foto es de la persona logueada, no compartida.
    const quien = (sesion.sub && /^\d+$/.test(sesion.sub)) ? `u${sesion.sub}` : (sesion.email || 'owner').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'owner';
    const ext = EXT_DE[tipo];
    const path = `${quien}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: tipo, upsert: true });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return Response.json({ ok: true, url: data.publicUrl });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

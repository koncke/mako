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

export async function POST(req: NextRequest) {
  try {
    const sesion = await getUsuarioActual();
    if (!sesion) return Response.json({ ok: false, error: 'no autenticado' }, { status: 401 });

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return Response.json({ ok: false, error: 'No llegó ningún archivo' }, { status: 400 });
    if (!file.type.startsWith('image/')) return Response.json({ ok: false, error: 'El archivo tiene que ser una imagen' }, { status: 400 });
    if (file.size > MAX) return Response.json({ ok: false, error: 'La imagen supera los 5MB' }, { status: 400 });

    const supabase = getSupabaseServer();
    try { await supabase.storage.createBucket(BUCKET, { public: true }); } catch { /* ya existe */ }

    // Carpeta por usuario: la foto es de la persona logueada, no compartida.
    const quien = (sesion.sub && /^\d+$/.test(sesion.sub)) ? `u${sesion.sub}` : (sesion.email || 'owner').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'owner';
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const path = `${quien}/avatar-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'image/png', upsert: true });
    if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return Response.json({ ok: true, url: data.publicUrl });
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

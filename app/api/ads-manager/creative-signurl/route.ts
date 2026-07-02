// =============================================================================
// POST /api/ads-manager/creative-signurl — URL firmada para subir un creativo
// =============================================================================
// El navegador sube el archivo DIRECTO a Supabase Storage (esquivando el límite
// de body del serverless de Vercel, ~4.5MB). Esta ruta crea la URL firmada de
// subida (y el bucket si falta). Después, /creative-upload empuja el archivo a
// Meta desde el storage. Body: { filename, content_type } → { ok, path, signedUrl }.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase';
import { ADS_CREATIVES_BUCKET as BUCKET } from '@/lib/meta-ads-create';
import { esWorkspaceDueno } from '@/lib/workspace';

export const dynamic = 'force-dynamic';

function safeName(name: string): string {
  const base = name.replace(/[^\w.\-]+/g, '_').replace(/_+/g, '_').slice(-80);
  return base || 'creativo';
}

export async function POST(req: NextRequest) {
  // Fase 1: firmar la subida es el primer paso del tooling de creativos que
  // termina empujando a la cuenta de Meta global del dueño.
  if (!(await esWorkspaceDueno())) {
    return Response.json({ ok: false, error: 'Esta acción solo está disponible en el workspace principal por ahora.' }, { status: 403 });
  }

  let body: { filename?: string; content_type?: string };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  const filename = safeName(String(body.filename ?? 'creativo'));
  const path = `nueva/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${filename}`;

  try {
    const supabase = getSupabaseServer();
    // Bucket privado (el servidor lee con service_role; Meta usa una URL firmada).
    try { await supabase.storage.createBucket(BUCKET, { public: false }); } catch { /* ya existe */ }
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) return Response.json({ ok: false, error: error?.message ?? 'no se pudo firmar la subida' }, { status: 500 });
    // El gateway de Supabase exige la apikey pública (anon) además del token firmado.
    const apikey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
    if (!apikey) console.warn('[ads-manager:creative-signurl] sin NEXT_PUBLIC_SUPABASE_ANON_KEY: la subida directa al storage puede fallar (HTTP 400).');
    return Response.json({ ok: true, path: data.path, signedUrl: data.signedUrl, apikey });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[ads-manager:creative-signurl] ${message}`);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

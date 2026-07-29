// =============================================================================
// /api/onboarding/archivero/upload-url — URL firmada para subir DIRECTO a storage
// =============================================================================
// Vercel rechaza los POST de más de ~4.5 MB (413). Para archivos grandes, el cliente
// sube el binario DIRECTO a Supabase Storage con esta URL firmada (sin pasar por el
// serverless), y después llama a /archivero {action:'procesar'} con la metadata.
// POST { nombre, mime } → { fileId, path, signedUrl, token }.

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getSupabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const BUCKET = 'archivero';

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { nombre?: string };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  return runWithWorkspace(ws, async () => {
    try {
      const fileId = randomUUID();
      const path = `${ws}/${fileId}`;
      const { data, error } = await getSupabaseServer().storage.from(BUCKET).createSignedUploadUrl(path);
      if (error || !data) return Response.json({ ok: false, error: error?.message || 'No se pudo crear la URL de subida.' }, { status: 500 });
      return Response.json({ ok: true, fileId, path, signedUrl: data.signedUrl, token: data.token });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}

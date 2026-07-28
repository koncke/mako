// =============================================================================
// /api/onboarding/persona — la cara de marca (fotos + descripción para la IA)
// =============================================================================
// GET     → { descripcion, fotos:[{id,nombre,mime,url}] }
// POST     multipart (file) → sube fotos | json {descripcion} → guarda la descripción
// DELETE ?id → borra una foto
// Piso: admin del workspace; el dueño → OWNER_WS. Todo en runWithWorkspace(ws).

import type { NextRequest } from 'next/server';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { personaEstado, addPersonaFoto, deletePersonaFoto, setPersonaDescripcion } from '@/lib/persona';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const MAX_BYTES = 15 * 1024 * 1024;

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try { return Response.json({ ok: true, ...(await personaEstado()) }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  const ct = req.headers.get('content-type') || '';

  return runWithWorkspace(ws, async () => {
    try {
      // JSON → guardar la descripción.
      if (ct.includes('application/json')) {
        const body = (await req.json()) as { descripcion?: string };
        await setPersonaDescripcion(typeof body.descripcion === 'string' ? body.descripcion : '');
        return Response.json({ ok: true, ...(await personaEstado()) });
      }
      // Multipart → subir fotos.
      const form = await req.formData();
      const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
      if (files.length === 0) return Response.json({ ok: false, error: 'No subiste ninguna foto.' }, { status: 400 });
      const warnings: string[] = [];
      for (const file of files) {
        if (!(file.type || '').startsWith('image/')) { warnings.push(`"${file.name}" no es una imagen, la salté.`); continue; }
        if (file.size > MAX_BYTES) { warnings.push(`"${file.name}" es muy grande (>15 MB), la salté.`); continue; }
        const buf = Buffer.from(await file.arrayBuffer());
        await addPersonaFoto(buf, file.name, file.type || 'image/jpeg');
      }
      return Response.json({ ok: true, warnings, ...(await personaEstado()) });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}

export async function DELETE(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return Response.json({ ok: false, error: 'Falta el id de la foto.' }, { status: 400 });
  return runWithWorkspace(ws, async () => {
    try { await deletePersonaFoto(id); return Response.json({ ok: true, ...(await personaEstado()) }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}

// =============================================================================
// /api/onboarding/razones — las MOTIVACIONES de compra por avatar (= la matriz)
// =============================================================================
// GET  → { razones, avatares, tieneAvatares, tieneBrief }
// POST → 'generar' (MaKo arma las 3 motivaciones×avatar + copy) | 'guardar' (edición)
//        | 'guion' {id} (genera el guion de una celda, a pedido).
// Piso: admin del workspace; el dueño (sin impersonar) → OWNER_WS.

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getAnswers } from '@/lib/onboarding';
import { getAvatares } from '@/lib/avatares';
import { generarRazones, getRazones, setRazones, generarGuion, type RazonCelda } from '@/lib/razones';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

async function estado() {
  const [razones, avatares, answers] = await Promise.all([getRazones(), getAvatares(), getAnswers()]);
  return { razones, avatares, tieneAvatares: avatares.length > 0, tieneBrief: Object.values(answers).some((v) => (v ?? '').trim()) };
}

export async function GET() {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  return runWithWorkspace(ws, async () => {
    try { return Response.json({ ok: true, ...(await estado()) }); }
    catch (e) { return Response.json({ ok: false, error: msg(e) }, { status: 500 }); }
  });
}

export async function POST(req: NextRequest) {
  const ws = await resolverWsAdmin();
  if (ws == null) return Response.json({ ok: false, error: 'Solo el admin del workspace.' }, { status: 403 });
  let body: { action?: string; razones?: unknown; id?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  return runWithWorkspace(ws, async () => {
    try {
      if (body.action === 'guion') {
        const r = await generarGuion(s(body.id));
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        return Response.json({ ok: true, ...(await estado()) });
      }
      if (body.action === 'guardar') {
        const arr = Array.isArray(body.razones) ? body.razones : [];
        const limpio: RazonCelda[] = arr
          .map((a) => { const o = (a ?? {}) as Record<string, unknown>; return { id: s(o.id) || randomUUID(), avatarId: s(o.avatarId), nombre: s(o.nombre), descripcion: s(o.descripcion), copy: s(o.copy), guion: s(o.guion), imagenUrl: s(o.imagenUrl) }; })
          // No borrar la celda por vaciar solo el nombre: se conserva si tiene algún contenido.
          .filter((a) => a.nombre || a.descripcion || a.copy || a.guion);
        await setRazones(limpio);
        return Response.json({ ok: true, ...(await estado()) });
      }
      const r = await generarRazones();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
      await setRazones(r.razones);
      return Response.json({ ok: true, ...(await estado()), uso: r.uso });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}

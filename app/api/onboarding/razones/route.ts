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
import { elegirAngulo, formatoPorId, type Medio } from '@/lib/angulos-formatos';

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
  let body: { action?: string; razones?: unknown; id?: unknown; medio?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  return runWithWorkspace(ws, async () => {
    try {
      if (body.action === 'guion') {
        const id = s(body.id);
        // El guion sigue el ÁNGULO de video de la celda. Si no hay uno elegido, que la
        // IA elija el mejor antes de escribir (best-effort: si falla, guion genérico).
        // Timeouts acotados por proveedor: son DOS cascadas en serie (elegir + generar),
        // así que el peor caso tiene que quedar holgado bajo maxDuration=120. El ángulo
        // se persiste apenas se elige, así que un reintento tras un corte no lo recalcula.
        let anguloVideo = (await getRazones()).find((r) => r.id === id)?.anguloVideo || '';
        if (!anguloVideo) { const a = await elegirAngulo(id, 'video', 15000); if (a.ok) anguloVideo = a.formatoId; }
        const fmt = anguloVideo ? formatoPorId(anguloVideo) : undefined;
        const formatoTexto = fmt ? `${fmt.nombre} — ${fmt.descripcion} (ej: ${fmt.ejemplo})` : undefined;
        const r = await generarGuion(id, formatoTexto, 25000);
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        return Response.json({ ok: true, ...(await estado()) });
      }
      if (body.action === 'angulo') {
        const medio: Medio = body.medio === 'video' ? 'video' : 'imagen';
        const a = await elegirAngulo(s(body.id), medio);
        if (!a.ok) return Response.json({ ok: false, error: a.error }, { status: 422 });
        return Response.json({ ok: true, ...(await estado()) });
      }
      if (body.action === 'guardar') {
        const arr = Array.isArray(body.razones) ? body.razones : [];
        const limpio: RazonCelda[] = arr
          .map((a) => { const o = (a ?? {}) as Record<string, unknown>; return { id: s(o.id) || randomUUID(), avatarId: s(o.avatarId), nombre: s(o.nombre), descripcion: s(o.descripcion), copy: s(o.copy), guion: s(o.guion), imagenUrl: s(o.imagenUrl), anguloImagen: s(o.anguloImagen), anguloVideo: s(o.anguloVideo) }; })
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

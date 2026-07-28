// =============================================================================
// /api/onboarding/avatares — los 3 AVATARES del negocio (filas de la matriz 3×3)
// =============================================================================
// GET  → { avatares, tieneBrief }
// POST → action 'generar' (MaKo los propone desde el brief del Archivero y los
//        guarda) | 'guardar' (persiste la lista editada por el usuario).
// Piso: admin del workspace; el dueño (sin impersonar) opera sobre OWNER_WS. Todo
// dentro de runWithWorkspace(ws) para scopear brief + settings.

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getAnswers } from '@/lib/onboarding';
import { generarAvatares, getAvatares, setAvatares, generarPreguntasAvatares, getContextoAvatares, setContextoAvatares, type Avatar } from '@/lib/avatares';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

async function estado() {
  const [avatares, answers] = await Promise.all([getAvatares(), getAnswers()]);
  return { avatares, tieneBrief: Object.values(answers).some((v) => (v ?? '').trim()) };
}

// Al regenerar/afinar, la IA mintea ids nuevos → las razones (linkeadas por avatarId)
// quedarían huérfanas y la Matriz vacía. Preservamos el id del avatar de la MISMA
// posición para que el link se mantenga (la razón sigue colgando de "su" avatar).
async function preservarIds(nuevos: Avatar[]): Promise<Avatar[]> {
  const viejos = await getAvatares();
  return nuevos.map((a, i) => (viejos[i] ? { ...a, id: viejos[i].id } : a));
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
  let body: { action?: string; avatares?: unknown; respuestas?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  return runWithWorkspace(ws, async () => {
    try {
      // Preguntas cerradas para afinar (comparativas). Solo las genera; no toca nada.
      if (body.action === 'preguntas') {
        const r = await generarPreguntasAvatares();
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        return Response.json({ ok: true, preguntas: r.preguntas });
      }
      // Afinar: guarda las respuestas como contexto y REGENERA los avatares con eso.
      if (body.action === 'afinar') {
        const arr = Array.isArray(body.respuestas) ? body.respuestas : [];
        const lineas = arr
          .map((x) => { const o = (x ?? {}) as Record<string, unknown>; const p = s(o.pregunta); const rsp = s(o.respuesta); return p && rsp ? `- ${p} → ${rsp}` : ''; })
          .filter(Boolean);
        // Acumula sobre el contexto previo (no pisa lo ya precisado).
        const previo = (await getContextoAvatares()).trim();
        const nuevo = [previo, ...lineas].filter(Boolean).join('\n');
        await setContextoAvatares(nuevo);
        const r = await generarAvatares();
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        await setAvatares(await preservarIds(r.avatares));
        return Response.json({ ok: true, ...(await estado()), uso: r.uso });
      }
      if (body.action === 'guardar') {
        const arr = Array.isArray(body.avatares) ? body.avatares : [];
        const limpio: Avatar[] = arr
          .map((a) => { const o = (a ?? {}) as Record<string, unknown>; return { id: s(o.id) || randomUUID(), nombre: s(o.nombre), segmento: s(o.segmento), senalesMeta: s(o.senalesMeta), situacion: s(o.situacion), dolor: s(o.dolor) }; })
          .filter((a) => a.nombre);
        await setAvatares(limpio);
        return Response.json({ ok: true, ...(await estado()) });
      }
      // default: generar
      const r = await generarAvatares();
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
      await setAvatares(await preservarIds(r.avatares));
      return Response.json({ ok: true, ...(await estado()), uso: r.uso });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  });
}

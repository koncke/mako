// =============================================================================
// /api/onboarding/entregable — el elemento TANGIBLE de la oferta (genera FOMO)
// =============================================================================
// GET  → { entregables, tieneBrief }
// POST → action 'generar' (MaKo los propone) | 'guardar' (edición / carga manual).
// Piso: admin del workspace; el dueño (sin impersonar) opera sobre OWNER_WS.

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runWithWorkspace } from '@/lib/workspace';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { resolverWsAdmin } from '@/lib/archivero';
import { getAnswers } from '@/lib/onboarding';
import { generarEntregables, siguientePreguntaEntregable, describirArchivoEntregable, getEntregables, getEntregablesEstricto, setEntregables, type Entregable, type PasoHistorial } from '@/lib/entregable';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

async function estado() {
  const [entregables, answers] = await Promise.all([getEntregables(), getAnswers()]);
  return { entregables, tieneBrief: Object.values(answers).some((v) => (v ?? '').trim()) };
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
  let body: { action?: string; entregables?: unknown; respuestas?: unknown; historial?: unknown; imagenDataUrl?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  // ⛔ D6b: con su propio Claude o su GPT, lo que pide la IA acá no va a la Gemini gratis (tests/d6b-rutas.test.ts).
  return runWithWorkspace(ws, () => conSuIADelNegocio(ws, async () => {
    try {
      if (body.action === 'guardar') {
        const arr = Array.isArray(body.entregables) ? body.entregables : [];
        // Lo que esta pantalla NO edita (el enlace, la pieza del Lead Magnet Generator) se conserva de lo guardado, por id.
        // Hasta el 5/11/2026 se rearmaba campo por campo y guardar acá borraba el enlace que usan las secuencias.
        // Lectura ESTRICTA: con la base caída, fundir sobre una lista vacía volvería a borrar los enlaces.
        const antes = new Map((await getEntregablesEstricto()).lista.map((e) => [e.id, e]));
        const limpio: Entregable[] = arr
          .map((g) => { const o = (g ?? {}) as Record<string, unknown>; const id = s(o.id) || randomUUID(); return { ...(antes.get(id) ?? {}), id, nombre: s(o.nombre), tipo: s(o.tipo), queEs: s(o.queEs), fomo: s(o.fomo) }; })
          // No borrar la tarjeta por vaciar solo el nombre: se conserva si tiene algún contenido.
          .filter((g) => g.nombre || g.queEs || g.fomo);
        await setEntregables(limpio);
        return Response.json({ ok: true, ...(await estado()) });
      }
      const historialDe = (v: unknown): PasoHistorial[] =>
        Array.isArray(v) ? v.map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { pregunta: s(o.pregunta), respuesta: s(o.respuesta) }; }).filter((x) => x.pregunta && x.respuesta) : [];

      if (body.action === 'siguiente') {
        const r = await siguientePreguntaEntregable(historialDe(body.historial));
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        return Response.json(r.terminado ? { ok: true, terminado: true } : { ok: true, terminado: false, pregunta: r.pregunta });
      }
      if (body.action === 'describir-archivo') {
        if (typeof body.imagenDataUrl !== 'string' || !body.imagenDataUrl) return Response.json({ ok: false, error: 'Falta la imagen.' }, { status: 400 });
        const descripcion = await describirArchivoEntregable(body.imagenDataUrl);
        return Response.json({ ok: true, descripcion: descripcion || 'Subió un archivo, pero no pude leerlo.' });
      }
      // 'generar' (default), con respuestas opcionales del dueño para afinar.
      const respuestas = Array.isArray(body.respuestas)
        ? body.respuestas.map((x) => { const o = (x ?? {}) as Record<string, unknown>; return { pregunta: s(o.pregunta), respuesta: s(o.respuesta) }; }).filter((x) => x.pregunta && x.respuesta)
        : undefined;
      const r = await generarEntregables(respuestas);
      if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
      // Los que ya tienen enlace o su pieza armada se quedan (como `regenerarLeadMagnets`): son una página de verdad.
      const armados = (await getEntregablesEstricto()).lista.filter((e) => e.enlace || e.pieza);
      const nombres = new Set(armados.map((e) => e.nombre.trim().toLowerCase()));
      await setEntregables([...armados, ...r.entregables.filter((e) => !nombres.has(e.nombre.trim().toLowerCase()))]);
      return Response.json({ ok: true, ...(await estado()), uso: r.uso });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }));
}

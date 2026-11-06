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
import { generarEntregables, siguientePreguntaEntregable, describirArchivoEntregable, getEntregables, cambiarEntregables, type PasoHistorial } from '@/lib/entregable';
import { fundirDelOnboarding } from '@/lib/entregable-fundir';

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
        // Se FUNDE sobre lo guardado y por el compare-and-set (6/11/2026): esta pantalla tiene la lista de cuando abrió, y
        // reemplazarla entera borraba lo armado en la tab Lead Magnet mientras tanto, el enlace de cada uno y el orden que
        // decide qué link mandan las automatizaciones (`fundirDelOnboarding`, lib/entregable.ts).
        const entrantes = arr.map((g) => { const o = (g ?? {}) as Record<string, unknown>; return { id: s(o.id) || randomUUID(), nombre: s(o.nombre), tipo: s(o.tipo), queEs: s(o.queEs), fomo: s(o.fomo) }; });
        const w = await cambiarEntregables((lista) => ({ lista: fundirDelOnboarding(lista, entrantes), valor: true }));
        if (!w.ok) return Response.json({ ok: false, error: w.error }, { status: w.status });
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
      // Los que ya tienen enlace o su pieza armada se quedan, primero y en su orden (como `regenerarLeadMagnets`): son una
      // página de verdad. Por el compare-and-set: la IA tarda, y en el medio se pudo armar otro en la tab.
      const w = await cambiarEntregables((lista) => {
        const armados = lista.filter((e) => e.enlace || e.pieza);
        const nombres = new Set(armados.map((e) => e.nombre.trim().toLowerCase()));
        return { lista: [...armados, ...r.entregables.filter((e) => !nombres.has(e.nombre.trim().toLowerCase()))], valor: true };
      });
      if (!w.ok) return Response.json({ ok: false, error: w.error }, { status: w.status });
      return Response.json({ ok: true, ...(await estado()), uso: r.uso });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }));
}

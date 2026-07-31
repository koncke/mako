// =============================================================================
// /api/onboarding/razones — las MOTIVACIONES de compra por avatar (= la matriz)
// =============================================================================
// GET  → { razones, avatares, tieneAvatares, tieneBrief, angulosGuion, siguientePasoDefault }
// POST → 'generar' (MaKo arma las 3 motivaciones×avatar + copy) | 'guardar' (edición)
//        | 'guion' {id, anguloId, siguientePaso, nota} (agrega UN guion nuevo a la celda).
// Piso: admin del workspace; el dueño (sin impersonar) → OWNER_WS.

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getAnswers } from '@/lib/onboarding';
import { getAvatares } from '@/lib/avatares';
import { generarRazones, getRazones, setRazones, generarGuion, siguientePasoDefault, type RazonCelda, type GuionItem } from '@/lib/razones';
import { getAngulosGuion } from '@/lib/guion-angulos-store';
import { getEstructurasGuion } from '@/lib/guion-estructuras-store';
import { elegirAngulo, formatoPorId, type Medio } from '@/lib/angulos-formatos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

async function estado() {
  const [razones, avatares, answers, angulosGuion, estructurasGuion, pasoDefault] = await Promise.all([
    getRazones(), getAvatares(), getAnswers(), getAngulosGuion(), getEstructurasGuion(), siguientePasoDefault(),
  ]);
  return {
    razones, avatares,
    tieneAvatares: avatares.length > 0,
    tieneBrief: Object.values(answers).some((v) => (v ?? '').trim()),
    // Las bibliotecas (solo lo activo) + el siguiente paso del funnel derivado del
    // canal — el wizard de "Nuevo guion" arma sus pasos con esto: elegir ángulo,
    // elegir estructura compatible, contestar las preguntas propias del ángulo.
    angulosGuion: angulosGuion.filter((a) => a.activo).map(({ id, nombre, emoji, cuando, preguntas, estructuras }) => ({ id, nombre, emoji, cuando, preguntas, estructuras })),
    estructurasGuion: estructurasGuion.filter((e) => e.activo).map(({ id, nombre, emoji, cuando }) => ({ id, nombre, emoji, cuando })),
    siguientePasoDefault: pasoDefault,
  };
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
  let body: { action?: string; razones?: unknown; id?: unknown; medio?: unknown; anguloId?: unknown; estructuraId?: unknown; siguientePaso?: unknown; nota?: unknown; respuestasAngulo?: unknown };
  try { body = (await req.json()) as typeof body; } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  return runWithWorkspace(ws, async () => {
    try {
      if (body.action === 'guion') {
        const id = s(body.id);
        // El guion sigue el FORMATO de video de la celda (biblioteca de formatos). Si no
        // hay uno elegido, que la IA elija el mejor antes de escribir (best-effort).
        // Timeouts acotados por proveedor: son DOS cascadas en serie (elegir + generar),
        // así que el peor caso tiene que quedar holgado bajo maxDuration=120. El formato
        // se persiste apenas se elige, así que un reintento tras un corte no lo recalcula.
        let anguloVideo = (await getRazones()).find((r) => r.id === id)?.anguloVideo || '';
        if (!anguloVideo) { const a = await elegirAngulo(id, 'video', 15000); if (a.ok) anguloVideo = a.formatoId; }
        const fmt = anguloVideo ? formatoPorId(anguloVideo) : undefined;
        const formatoTexto = fmt ? `${fmt.nombre} — ${fmt.descripcion} (ej: ${fmt.ejemplo})` : undefined;
        const respuestasAngulo = (Array.isArray(body.respuestasAngulo) ? body.respuestasAngulo : [])
          .map((r) => { const o = (r ?? {}) as Record<string, unknown>; return { pregunta: s(o.pregunta), respuesta: s(o.respuesta) }; })
          .filter((r) => r.pregunta && r.respuesta);
        const r = await generarGuion(id, {
          anguloId: s(body.anguloId) || undefined,
          estructuraId: s(body.estructuraId) || undefined,
          siguientePaso: s(body.siguientePaso) || undefined,
          respuestasAngulo,
          nota: s(body.nota) || undefined,
          formatoVideoTexto: formatoTexto,
          timeoutMs: 25000,
        });
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        return Response.json({ ok: true, guionNuevo: r.guion, ...(await estado()) });
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
          .map((a) => {
            const o = (a ?? {}) as Record<string, unknown>;
            const guiones: GuionItem[] = (Array.isArray(o.guiones) ? o.guiones : [])
              .map((g) => { const q = (g ?? {}) as Record<string, unknown>; return { id: s(q.id) || randomUUID(), anguloId: s(q.anguloId), anguloNombre: s(q.anguloNombre) || 'General', texto: s(q.texto) }; })
              .filter((g) => g.texto);
            return { id: s(o.id) || randomUUID(), avatarId: s(o.avatarId), nombre: s(o.nombre), descripcion: s(o.descripcion), copy: s(o.copy), guiones, imagenUrl: s(o.imagenUrl), anguloImagen: s(o.anguloImagen), anguloVideo: s(o.anguloVideo) };
          })
          // No borrar la celda por vaciar solo el nombre: se conserva si tiene algún contenido.
          .filter((a) => a.nombre || a.descripcion || a.copy || a.guiones.length);
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

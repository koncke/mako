// =============================================================================
// /api/onboarding/razones — las MOTIVACIONES de compra por avatar (= la matriz)
// =============================================================================
// GET  → { razones, avatares, tieneAvatares, tieneBrief, angulosGuion, siguientePasoDefault }
// POST → 'generar' (MaKo arma las 3 motivaciones×avatar + copy) | 'guardar' (edición)
//        | 'guion-auto' {id} (MaKo elige ángulo+estructura y escribe, un clic)
//        | 'guion-sugerir' {id, anguloId?} (sugerencia + preguntas CERRADAS)
//        | 'guion' {id, anguloId, estructuraId, siguientePaso, respuestasAngulo} (genera)
//        | 'guion-estado' {id, guionId, estado} (mueve el guion por el pipeline).
// Piso: admin del workspace; el dueño (sin impersonar) → OWNER_WS.

import type { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { runWithWorkspace } from '@/lib/workspace';
import { resolverWsAdmin } from '@/lib/archivero';
import { getAnswers } from '@/lib/onboarding';
import { getAvatares } from '@/lib/avatares';
import { generarRazones, getRazones, setRazones, generarGuion, sugerirGuion, siguientePasoDefault, siguientePasoOpciones, setEstadoGuion, borrarGuionDeCelda, editarTextoGuion, normalizarGuion, ESTADOS_GUION, type RazonCelda, type GuionItem, type EstadoGuion } from '@/lib/razones';
import { getAngulosGuion } from '@/lib/guion-angulos-store';
import { getEstructurasGuion } from '@/lib/guion-estructuras-store';
import { elegirAngulo, formatoPorId, type Medio } from '@/lib/angulos-formatos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

async function estado() {
  const [razones, avatares, answers, angulosGuion, estructurasGuion, pasoDefault, pasoOpciones] = await Promise.all([
    getRazones(), getAvatares(), getAnswers(), getAngulosGuion(), getEstructurasGuion(), siguientePasoDefault(), siguientePasoOpciones(),
  ]);
  return {
    razones, avatares,
    tieneAvatares: avatares.length > 0,
    tieneBrief: Object.values(answers).some((v) => (v ?? '').trim()),
    // Las bibliotecas (solo lo activo) + el siguiente paso del funnel derivado del
    // canal. Las preguntas de cada ángulo NO viajan: el cliente las recibe ya
    // convertidas en CERRADAS por 'guion-sugerir' (nunca un campo abierto).
    angulosGuion: angulosGuion.filter((a) => a.activo).map(({ id, nombre, emoji, cuando, estructuras }) => ({ id, nombre, emoji, cuando, estructuras })),
    estructurasGuion: estructurasGuion.filter((e) => e.activo).map(({ id, nombre, emoji, cuando }) => ({ id, nombre, emoji, cuando })),
    siguientePasoDefault: pasoDefault,
    siguientePasoOpciones: pasoOpciones,
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
  let body: { action?: string; razones?: unknown; id?: unknown; medio?: unknown; anguloId?: unknown; estructuraId?: unknown; siguientePaso?: unknown; nota?: unknown; respuestasAngulo?: unknown; guionId?: unknown; estado?: unknown; texto?: unknown };
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
      if (body.action === 'guion-sugerir') {
        // MaKo prepara el "Nuevo guion": elige ángulo + estructura y convierte las
        // preguntas del ángulo en CERRADAS con opciones del negocio real. Con
        // anguloId viene fijado por el dueño (solo faltan sus preguntas cerradas).
        const r = await sugerirGuion(s(body.id), { anguloId: s(body.anguloId) || undefined, timeoutMs: 25000 });
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        return Response.json({ ok: true, sugerencia: r.sugerencia });
      }
      if (body.action === 'guion-auto') {
        // El botón "MaKo lo hace solo": elige ángulo + estructura y escribe el
        // guion en un solo clic, sin preguntarle nada al dueño. Si la sugerencia
        // falla, se genera igual con los defaults del catálogo (nunca dead-end).
        const id = s(body.id);
        const sug = await sugerirGuion(id, { timeoutMs: 25000 });
        let anguloVideo = (await getRazones()).find((r) => r.id === id)?.anguloVideo || '';
        if (!anguloVideo) { const a = await elegirAngulo(id, 'video', 15000); if (a.ok) anguloVideo = a.formatoId; }
        const fmt = anguloVideo ? formatoPorId(anguloVideo) : undefined;
        const r = await generarGuion(id, {
          anguloId: sug.ok ? sug.sugerencia.anguloId : undefined,
          estructuraId: sug.ok ? sug.sugerencia.estructuraId : undefined,
          // El siguiente paso lo sugiere la IA acorde al ÁNGULO (lead magnet →
          // recibir el recurso, no una llamada); sin sugerencia cae al default.
          siguientePaso: sug.ok && sug.sugerencia.siguientePaso ? sug.sugerencia.siguientePaso : undefined,
          formatoVideoTexto: fmt ? `${fmt.nombre} — ${fmt.descripcion} (ej: ${fmt.ejemplo})` : undefined,
          timeoutMs: 25000,
        });
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        return Response.json({ ok: true, guionNuevo: r.guion, ...(await estado()) });
      }
      if (body.action === 'guion-estado') {
        // Mover UN guion por el pipeline (borrador → aprobado → grabado →
        // publicado) desde la vista global, sin reenviar toda la matriz.
        const nuevoEstado = s(body.estado) as EstadoGuion;
        if (!ESTADOS_GUION.includes(nuevoEstado)) return Response.json({ ok: false, error: 'Estado inválido.' }, { status: 400 });
        const r = await setEstadoGuion(s(body.id), s(body.guionId), nuevoEstado);
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        return Response.json({ ok: true, ...(await estado()) });
      }
      if (body.action === 'guion-borrar') {
        const r = await borrarGuionDeCelda(s(body.id), s(body.guionId));
        if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 422 });
        return Response.json({ ok: true, ...(await estado()) });
      }
      if (body.action === 'guion-texto') {
        const r = await editarTextoGuion(s(body.id), s(body.guionId), s(body.texto));
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
          .map((a) => {
            const o = (a ?? {}) as Record<string, unknown>;
            // normalizarGuion es la ÚNICA puerta de entrada del shape: si acá se
            // arma el objeto a mano, cada campo nuevo del guion (creadoEn,
            // estado, estructura) se pierde en silencio al guardar una edición.
            const guiones: GuionItem[] = (Array.isArray(o.guiones) ? o.guiones : [])
              .map(normalizarGuion)
              .filter((g): g is GuionItem => g !== null);
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

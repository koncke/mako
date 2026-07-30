// =============================================================================
// /api/plan-fathom — extraer tareas del plan desde una reunión de Fathom (G3)
// =============================================================================
// POST { action:'reuniones' }                         → { ok, reuniones:[…] }
// POST { action:'extraer', recordingId, proyectos:[{id,emoji,nombre}], uso? }
//                                                      → { ok, tareas:[…], usage? }
// Solo super-admin: usa la Fathom key de la agencia (la misma del Closing Analyst)
// y alimenta el PlanBoard (localStorage). El transcript es contenido no confiable.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { listReunionesRecientes, extraerTareasDeReunion, extraerTareasDeTexto, cacheKeyReunion, type ProyectoRef, type Yo } from '@/lib/plan-fathom';
import { glosarioTexto, guardarTermino } from '@/lib/glosario';
import { getSetting, setSetting } from '@/lib/settings';
import { cruzarCandidatas } from '@/lib/mako-guardian';
import { esFechaValida } from '@/lib/date-utils';
import { resumenPropuestasPorRefs } from '@/lib/plan-propuesta';

export const dynamic = 'force-dynamic';
// 300s porque una reunión larga se extrae POR PARTES (lib/plan-fathom → trocear): son
// varias llamadas en paralelo y el timeout interno de la IA escala con maxTokens. Con
// 120 la función de Vercel moría antes de que la IA pudiera siquiera rendirse.
export const maxDuration = 300;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const MAX_ARCHIVO = 2 * 1024 * 1024; // 2 MB de md/txt/transcript alcanza y sobra

const proyectosDe = (raw: unknown): ProyectoRef[] =>
  Array.isArray(raw)
    ? raw.filter((p): p is ProyectoRef => !!p && typeof (p as ProyectoRef).id === 'string').map((p) => ({ id: String(p.id), emoji: String(p.emoji ?? ''), nombre: String(p.nombre ?? '') }))
    : [];

export async function POST(req: NextRequest) {
  // Cualquier usuario logueado puede extraer de SU Fathom: la key sale de
  // credWs('FATHOM_API_KEY') que ya está scopeada por workspace (el dueño usa la de
  // la agencia; cada cliente, la suya). Si el workspace no tiene key, falla lindo.
  const sesion = await getUsuarioActual();
  if (!sesion) return Response.json({ ok: false, error: 'No autorizado' }, { status: 401 });
  const yo: Yo = { nombre: sesion.nombre ?? '', email: sesion.email ?? '' };

  // ── Subida de archivo (punto 5): md/txt/transcript → mismo pipeline de extracción.
  // Va por multipart, no por JSON. Para .md/.txt no hace falta storage: file.text().
  if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
    try {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return Response.json({ ok: false, error: 'Falta el archivo.' }, { status: 400 });
      if (file.size > MAX_ARCHIVO) return Response.json({ ok: false, error: 'El archivo supera 2 MB.' }, { status: 400 });
      const nombre = file.name.toLowerCase();
      if (!/\.(md|txt|vtt|srt)$/.test(nombre)) return Response.json({ ok: false, error: 'Subí un .md, .txt, .vtt o .srt.' }, { status: 400 });
      // 250k chars ≈ 6 horas de transcript. Antes 60k: un .md de una reunión de 2 horas
      // (145k) se cortaba en el minuto 52 y se perdía la mitad de la charla EN SILENCIO.
      // El largo ya no lo resuelve el recorte sino el troceado (extraerTareasDeTexto).
      const texto = (await file.text()).slice(0, 250000);
      const proyectos = proyectosDe(JSON.parse(String(form.get('proyectos') ?? '[]')));
      const glosario = await glosarioTexto().catch(() => '');
      const out = await extraerTareasDeTexto(texto, proyectos, yo, { glosario, usoMotivo: `Extraer tareas del archivo ${file.name}` });
      return Response.json({ ok: true, ...out });
    } catch (e) {
      console.error(`[api:plan-fathom] archivo: ${msg(e)}`);
      return Response.json({ ok: false, error: msg(e) }, { status: 500 });
    }
  }

  let body: { action?: string; recordingId?: number; proyectos?: ProyectoRef[]; uso?: string; titulo?: string; cursor?: string; recordedAfter?: string; termino?: string; definicion?: string; reanalizar?: boolean; candidatas?: Array<{ titulo?: string; detalle?: string }>; existentes?: Array<{ id?: string; titulo?: string; detalle?: string }> };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }
  const uso = String(body.uso ?? '').trim() || undefined;

  try {
    if (body.action === 'reuniones') {
      // Una página + cursor (antes traía todo el histórico y tardaba). El selector
      // pide más con nextCursor. recordedAfter = filtro por fecha (ISO), opcional.
      const cursor = typeof body.cursor === 'string' && body.cursor ? body.cursor : undefined;
      const recordedAfter = typeof body.recordedAfter === 'string' && esFechaValida(body.recordedAfter) ? body.recordedAfter : undefined;
      const { reuniones, nextCursor } = await listReunionesRecientes({ cursor, recordedAfter });
      // Qué salió YA de cada una de estas reuniones (mismo request, mismo workspace).
      // Sin esto, el selector ofrece "Extraer →" en una reunión de la que MaKo ya sacó
      // 61 tareas: el usuario paga tokens para que le muestren lo que ya tiene.
      const borradores = await resumenPropuestasPorRefs(reuniones.map((r) => `fathom:${r.recordingId}`)).catch(() => ({}));
      return Response.json({ ok: true, reuniones, nextCursor, borradores });
    }
    // Guardar un término del glosario (punto 7): la respuesta del usuario a "¿qué es X?".
    if (body.action === 'glosario-guardar') {
      await guardarTermino(String(body.termino ?? ''), String(body.definicion ?? ''));
      return Response.json({ ok: true });
    }
    // Gate del Perro (punto 8): cruzar las candidatas contra el plan ACTUAL (que vive
    // en el localStorage del cliente, por eso viaja en el body) para enriquecer en
    // vez de duplicar. Devuelve solo las que ya existen.
    if (body.action === 'cruzar') {
      const candidatas = Array.isArray(body.candidatas) ? body.candidatas.map((c) => ({ titulo: String(c?.titulo ?? ''), detalle: String(c?.detalle ?? '') })) : [];
      const existentes = Array.isArray(body.existentes) ? body.existentes.filter((e) => e?.id).map((e) => ({ id: String(e.id), titulo: String(e.titulo ?? ''), detalle: String(e.detalle ?? '') })) : [];
      const out = await cruzarCandidatas(candidatas, existentes, uso);
      return Response.json({ ok: true, ...out });
    }
    if (body.action === 'extraer') {
      const recordingId = Number(body.recordingId);
      if (!Number.isFinite(recordingId)) return Response.json({ ok: false, error: 'Falta la reunión.' }, { status: 400 });
      const proyectos = proyectosDe(body.proyectos);
      // CACHE por reunión (feedback jul-19): NO re-cobrar tokens si ya extrajimos esta
      // reunión (la transcripción no cambia). Guardamos el resultado y lo devolvemos con
      // `cached:true`. `body.reanalizar===true` fuerza volver a correr Claude si hace falta.
      const cacheKey = cacheKeyReunion(recordingId);
      if (body.reanalizar !== true) {
        const raw = await getSetting(cacheKey).catch(() => null);
        if (raw) {
          try {
            const prev = JSON.parse(raw) as { tareas?: unknown; participantes?: unknown };
            if (Array.isArray(prev.tareas)) return Response.json({ ok: true, tareas: prev.tareas, participantes: prev.participantes ?? [], cached: true });
          } catch { /* cache corrupto → re-extrae */ }
        }
      }
      const glosario = await glosarioTexto().catch(() => '');
      const out = await extraerTareasDeReunion(recordingId, proyectos, yo, { glosario, usoMotivo: uso });
      // Guardar en cache — AWAIT (con `void` el serverless termina antes de escribir y
      // NO quedaba nada cacheado → volvía a cobrar). Re-abrir la misma reunión ya no gasta.
      // Los PARTICIPANTES van al cache a propósito: son la lista blanca contra la que
      // /api/plan-reunion valida a quién se le puede mandar algo de esta reunión.
      await setSetting(cacheKey, JSON.stringify({ tareas: out.tareas, participantes: out.participantes ?? [], ts: Date.now() })).catch(() => {});
      // ACÁ NO SE MANDA NINGÚN WHATSAPP, a propósito. Antes esta ruta preguntaba
      // "saqué N compromisos, ¿los cargo?" — y era una pregunta al vacío: el usuario
      // está MIRANDO la lista en la app (la disparó él desde el modal), y la pregunta
      // no quedaba anclada a nada. Cuando contestaba "sí, cargalo" por WhatsApp, el doer
      // no tenía ese turno en su historial, se agarraba de la conversación anterior que
      // encontrara y creaba tareas de OTRO día (pasó: duplicó dos del 26/07).
      // El WhatsApp con lista y link lo manda el CRON (lib/reunion-auto), que es el que
      // sí necesita avisar de algo que el dueño no está viendo.
      return Response.json({ ok: true, ...out });
    }
    return Response.json({ ok: false, error: 'acción desconocida' }, { status: 400 });
  } catch (e) {
    console.error(`[api:plan-fathom] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

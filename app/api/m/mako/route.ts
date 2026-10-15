// =============================================================================
// /api/m/mako — el chat de MaKo del teléfono (MaKo Mobile)
// =============================================================================
// GET  ?sesiones=1         → { ok, sesiones }                    las de ESTA persona
// GET  ?sessionId=N        → { ok, sesion, mensajes, propuestas } las tarjetas vigentes del chat
// POST { action:'new' }    → { ok, sesion }                       sin saludo del modelo (cuesta)
// POST { action:'send', sessionId, mensaje }      → RespuestaTurno
// POST multipart: mensaje, sessionId, adjuntos[]  → RespuestaTurno  (fotos y PDF)
//
// El turno vive en lib/mako-turno-app.ts; esto sólo traduce HTTP. Confirmar o cancelar
// una tarjeta NO pasa por acá: son server actions (app/m/mako/acciones.ts).
//
// ⚠️ LOS ARCHIVOS VAN POR ACÁ Y NO POR UNA SERVER ACTION: una action topea el cuerpo en 1 MB
// (AGENTS.md, «Tres topes del entorno»). Y el tope de acá es 4 MB en total porque Vercel corta
// todo POST de más de ~4,5 MB con un 413 en TEXTO PLANO antes de llegar a esta ruta: la
// pantalla achica la foto antes de subirla y lee la respuesta con `res.text()` primero.
//
// ⚠️ maxDuration 420: leer una foto con la visión tardó 52 s medidos (11/10/2026) y el doer
// puede encadenar 8 pasos de herramientas. El `fetch` de la pantalla va con
// `AbortSignal.timeout(425_000)` (AGENTS.md, «Un tope que vive en la RUTA no protege al
// cliente») y el spinner dice que puede tardar.
// =============================================================================

import type { NextRequest } from 'next/server';
import { personaDelRequest, listarSesiones, abrirSesion, nuevaSesion, turnoApp, type PersonaChat } from '@/lib/mako-turno-app';
import { validarAdjuntos, ERROR_ADJUNTO, TOPE_ADJUNTOS, TOPE_TOTAL_BYTES, MARGEN_MULTIPART_BYTES, type AdjuntoListo } from '@/lib/mako-adjuntos';

export const dynamic = 'force-dynamic';
// 420 y no 300 (tanda 7 del Web Generator, 15/10/2026; Martín: «Todas las funciones a la API de MaKo»): confirmar
// replicar_landing por chat corre hasta ~275 s (lib/editor-landing/replicar.ts: imágenes hasta los 265 s, más
// guardar el tema y crear) y antes y después van los pasos del modelo y el envío: 300 lo cortaba. Plan Pro con
// fluid compute: tope 800. tests/mako-doer-plazo.test.ts.
export const maxDuration = 420;

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status });

const sessionIdDe = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function GET(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return json({ ok: false, error: persona.error }, persona.status);
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get('sesiones')) return json({ ok: true, sesiones: await listarSesiones(persona) });
    if (sp.has('sessionId')) {
      const id = sessionIdDe(sp.get('sessionId'));
      const abierta = id == null ? null : await abrirSesion(persona, id);
      if (!abierta) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
      return json({ ok: true, ...abierta });
    }
    return json({ ok: false, error: 'Falta qué pedir.' }, 400);
  } catch (e) {
    console.error('[api/m/mako] GET', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'No pude cargar el chat.' }, 500);
  }
}

async function mandar(persona: PersonaChat, sessionId: number | null, mensaje: string, adjuntos: AdjuntoListo[]) {
  if (sessionId == null) return json({ ok: false, error: 'Falta el chat.' }, 400);
  if (!mensaje.trim() && !adjuntos.length) return json({ ok: false, error: 'Escribe algo.' }, 400);
  const r = await turnoApp(persona, sessionId, { mensaje, adjuntos });
  if (!r) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
  // Un fallo del modelo NO es un error HTTP: el mensaje quedó guardado y el aviso viaja adentro.
  return json({ ...r });
}

export async function POST(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return json({ ok: false, error: persona.error }, persona.status);
  try {
    const tipo = req.headers.get('content-type') ?? '';
    if (tipo.toLowerCase().startsWith('multipart/form-data')) {
      // El largo se mira ANTES de parsear: después del formData() el cuerpo ya está en memoria.
      const largo = Number(req.headers.get('content-length') ?? 0);
      if (largo > TOPE_TOTAL_BYTES + MARGEN_MULTIPART_BYTES) return json({ ok: false, error: ERROR_ADJUNTO.pesado }, 413);
      const form = await req.formData();
      const archivos = form.getAll('adjuntos').filter((f): f is File => f instanceof File);
      if (archivos.length > TOPE_ADJUNTOS) return json({ ok: false, error: ERROR_ADJUNTO.muchos }, 400);
      if (archivos.reduce((n, f) => n + f.size, 0) > TOPE_TOTAL_BYTES) return json({ ok: false, error: ERROR_ADJUNTO.pesado }, 413);
      const leidos = await Promise.all(archivos.map(async (f) => ({ nombre: f.name, mime: f.type, bytes: new Uint8Array(await f.arrayBuffer()) })));
      const v = validarAdjuntos(leidos);
      if (!v.ok) return json({ ok: false, error: v.error }, 400);
      return await mandar(persona, sessionIdDe(form.get('sessionId')), String(form.get('mensaje') ?? ''), v.adjuntos);
    }

    let body: { action?: unknown; sessionId?: unknown; mensaje?: unknown };
    try { body = await req.json(); } catch { return json({ ok: false, error: 'Pedido inválido.' }, 400); }
    if (body.action === 'new') return json({ ok: true, sesion: await nuevaSesion(persona) });
    if (body.action === 'send') return await mandar(persona, sessionIdDe(body.sessionId), typeof body.mensaje === 'string' ? body.mensaje : '', []);
    return json({ ok: false, error: 'Pedido inválido.' }, 400);
  } catch (e) {
    console.error('[api/m/mako] POST', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'Algo falló de nuestro lado. Intenta de nuevo.' }, 500);
  }
}

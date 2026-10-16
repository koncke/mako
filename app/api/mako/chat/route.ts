// =============================================================================
// /api/mako/chat — el chat con MaKo del Second Brain (la pieza única, en la computadora)
// =============================================================================
// GET  ?sesiones=1                                   → { ok, sesiones }             las de ESTA persona
// GET  ?sessionId=N                                  → { ok, sesion, mensajes, propuestas }
// GET  ?antes=1                                      → { ok, antes }    los chats de «Pregúntale a MaKo» (sólo lectura)
// GET  ?antesId=N                                    → { ok, sesion, mensajes }
// GET  ?adjunto=<id del mensaje>:<n>                 → 302 al archivo (link firmado, 300 s)
// POST { action:'new' }                              → { ok, sesion }               sin saludo del modelo
// POST { action:'send', sessionId, mensaje }         → RespuestaTurno
// POST multipart: mensaje, sessionId, adjuntos[]     → RespuestaTurno               (fotos y PDF, como el teléfono)
// POST { action:'confirmar'|'cancelar', sessionId, pendienteId } → ResultadoTarjeta
//
// El turno es el MISMO del teléfono (lib/mako-turno-app.ts, las mismas sesiones `mako-movil:u<id>`): esto sólo
// traduce HTTP y le dice al turno que está en la computadora (`CONTEXTO_SECOND_BRAIN`). Etapa 2 de
// docs/diseno-mako-ai-native.md.
//
// ⚠️ NO VA EN app/api/second-brain/: esa carpeta es sólo del admin por test (tests/puerta-admin-tab.test.ts), y este
// chat es de todos los que tienen MaKo (closer y setter incluidos), con la puerta de MaKo: `personaDelRequest`.
// ⚠️ CONFIRMAR VA POR ACÁ Y NO POR UNA SERVER ACTION, como el CRM (app/crm/mako-crm/chat-server.ts): la action toma el
// techo de la página, y confirmar replicar_landing corre ~275 s.
// ⚠️ maxDuration 420 y el `fetch` de la pantalla con `AbortSignal.timeout(425_000)` (tests/mako-doer-plazo.test.ts).
// ⚠️ UN ADJUNTO SE PIDE POR SU MENSAJE, NUNCA POR SU PATH (tanda 4, 16/10/2026): `urlDeAdjunto` mira de quién es la
//    conversación antes de firmar (lib/mako-turno-app.ts). El path no sale nunca a la pantalla.
// =============================================================================

import type { NextRequest } from 'next/server';
import {
  personaDelRequest, listarSesiones, abrirSesion, nuevaSesion, turnoApp, confirmarDesdeTarjeta, cancelarDesdeTarjeta, urlDeAdjunto,
} from '@/lib/mako-turno-app';
import { validarAdjuntos, ERROR_ADJUNTO, TOPE_ADJUNTOS, TOPE_TOTAL_BYTES, MARGEN_MULTIPART_BYTES } from '@/lib/mako-adjuntos';
import { CONTEXTO_SECOND_BRAIN } from '@/lib/chat-mako-reglas';
import { chatsDeAntes, hiloDeAntes, quienChateaDelRequest } from '@/lib/chat-mako-indice';

export const dynamic = 'force-dynamic';
export const maxDuration = 420;

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status });

const enteroDe = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(String(v ?? '').trim());
  return Number.isInteger(n) && n > 0 ? n : null;
};

export async function GET(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return json({ ok: false, error: persona.error }, persona.status);
  const sp = req.nextUrl.searchParams;
  try {
    if (sp.get('sesiones')) return json({ ok: true, sesiones: await listarSesiones(persona) });
    if (sp.has('adjunto')) {
      const url = await urlDeAdjunto(persona, sp.get('adjunto'));
      // Se abre en otra pestaña o en un <img>: texto, no JSON.
      if (!url) return new Response('No pude abrir el archivo.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
      // El link vence a los 300 s: el navegador puede reusar este salto un rato menos que eso.
      return new Response(null, { status: 302, headers: { Location: url, 'Cache-Control': 'private, max-age=240' } });
    }
    // «Antes»: lo que tenía /mako, con SU regla de quién ve qué (lib/chat-mako-indice.ts).
    if (sp.get('antes') || sp.has('antesId')) {
      const q = await quienChateaDelRequest();
      if (!q) return json({ ok: false, error: 'Tu sesión venció.' }, 401);
      if (sp.get('antes')) return json({ ok: true, antes: await chatsDeAntes(q) });
      const id = enteroDe(sp.get('antesId'));
      const hilo = id == null ? null : await hiloDeAntes(q, id);
      if (!hilo) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
      return json({ ok: true, ...hilo });
    }
    if (sp.has('sessionId')) {
      const id = enteroDe(sp.get('sessionId'));
      const abierta = id == null ? null : await abrirSesion(persona, id);
      if (!abierta) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
      return json({ ok: true, ...abierta });
    }
    return json({ ok: false, error: 'Falta qué pedir.' }, 400);
  } catch (e) {
    console.error('[api/mako/chat] GET', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'No pude cargar el chat.' }, 500);
  }
}

export async function POST(req: NextRequest) {
  const persona = await personaDelRequest();
  if ('error' in persona) return json({ ok: false, error: persona.error }, persona.status);
  // Con archivos: lo mismo que /api/m/mako (el teléfono), con la voz de la computadora.
  if ((req.headers.get('content-type') ?? '').toLowerCase().startsWith('multipart/form-data')) {
    try {
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
      const sessionId = enteroDe(form.get('sessionId'));
      if (sessionId == null) return json({ ok: false, error: 'Falta el chat.' }, 400);
      const mensaje = String(form.get('mensaje') ?? '');
      if (!mensaje.trim() && !v.adjuntos.length) return json({ ok: false, error: 'Escribe algo.' }, 400);
      const r = await turnoApp(persona, sessionId, { mensaje, adjuntos: v.adjuntos, contexto: CONTEXTO_SECOND_BRAIN });
      if (!r) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
      return json({ ...r });
    } catch (e) {
      console.error('[api/mako/chat] POST multipart', e instanceof Error ? e.message : String(e));
      return json({ ok: false, error: 'Algo falló de nuestro lado. Intenta de nuevo.' }, 500);
    }
  }
  let body: { action?: unknown; sessionId?: unknown; mensaje?: unknown; pendienteId?: unknown };
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Pedido inválido.' }, 400); }
  try {
    if (body.action === 'new') return json({ ok: true, sesion: await nuevaSesion(persona) });

    const sessionId = enteroDe(body.sessionId);
    if (sessionId == null) return json({ ok: false, error: 'Falta el chat.' }, 400);

    if (body.action === 'send') {
      const mensaje = typeof body.mensaje === 'string' ? body.mensaje : '';
      if (!mensaje.trim()) return json({ ok: false, error: 'Escribe algo.' }, 400);
      const r = await turnoApp(persona, sessionId, { mensaje, contexto: CONTEXTO_SECOND_BRAIN });
      if (!r) return json({ ok: false, error: 'No encuentro ese chat.' }, 404);
      // Un fallo del modelo NO es un error HTTP: el mensaje quedó guardado y el aviso viaja adentro.
      return json({ ...r });
    }

    if (body.action === 'confirmar' || body.action === 'cancelar') {
      const pendienteId = enteroDe(body.pendienteId);
      if (pendienteId == null) return json({ ok: false, error: 'Falta qué confirmar.' }, 400);
      const r = body.action === 'confirmar'
        ? await confirmarDesdeTarjeta(persona, sessionId, pendienteId)
        : await cancelarDesdeTarjeta(persona, sessionId, pendienteId);
      return json({ ...r });
    }

    return json({ ok: false, error: 'Pedido inválido.' }, 400);
  } catch (e) {
    console.error('[api/mako/chat] POST', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'Algo falló de nuestro lado. Intenta de nuevo.' }, 500);
  }
}

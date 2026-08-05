// =============================================================================
// API: biblioteca de notas de voz del Chat Agent (mig 0108)
// =============================================================================
// GET    → { audios, porClave, linkVideo }
// POST   → { titulo, base64, mime, duracionS, clave? } → sube y transcribe
// DELETE → ?id=N
//
// `clave` engancha la grabación a una de las tres situaciones del onboarding
// (ver lib/audios-paso.ts). El mapa vive en un setting y NO en una columna de
// setting_audios: la tabla guarda audios, y "cuál de estos es la bienvenida" es
// una decisión del workspace que puede cambiar sin tocar el archivo.
//
// Guard: admin del workspace (los audios son la voz del dueño saliendo a leads).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { listAudios, crearAudio, borrarAudio, audioUrlFirmada } from '@/lib/setting-audios';
import { getSetting, setSetting } from '@/lib/settings';
import { esClaveAudio, KEY_AUDIOS_CLAVE, KEY_LINK_VIDEO } from '@/lib/audios-paso';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(): Promise<Response | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede gestionar los audios.' }, { status: 403 });
  }
  return null;
}

async function getPorClave(): Promise<Record<string, number>> {
  const raw = await getSetting(KEY_AUDIOS_CLAVE);
  if (!raw) return {};
  try {
    const p = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(p)) {
      const n = Number(v);
      if (esClaveAudio(k) && Number.isFinite(n) && n > 0) out[k] = n;
    }
    return out;
  } catch { return {}; }
}

export async function GET() {
  const g = await guard();
  if (g) return g;
  try {
    // `hayReunion` sale del funnel REAL del workspace (funnel_config), que es la
    // fuente de verdad del proceso comercial. Un negocio de venta directa no
    // tiene a quién mandarle un audio de "ya agendaste": pedírselo igual dejaba
    // el paso trabado en 1 de 3 para siempre.
    const [audios, porClave, linkVideo, funnel] = await Promise.all([
      listAudios(), getPorClave(), getSetting(KEY_LINK_VIDEO).catch(() => null),
      import('@/lib/leads').then((m) => m.getFunnel()).catch(() => null),
    ]);
    const hayReunion = (funnel?.stages ?? []).some((s) => s.kind === 'reunion');
    const conUrl = await Promise.all(audios.map(async (a) => ({ ...a, url: await audioUrlFirmada(a.media_path) })));
    // Un id que quedó en el mapa apuntando a un audio ya borrado se limpia acá:
    // si no, la pantalla mostraría "grabado" sobre algo que no existe.
    const vivos = new Set(conUrl.map((a) => a.id));
    const limpio: Record<string, number> = {};
    for (const [k, id] of Object.entries(porClave)) if (vivos.has(id)) limpio[k] = id;
    return Response.json({ ok: true, audios: conUrl, porClave: limpio, linkVideo: linkVideo ?? '', hayReunion });
  } catch (e) {
    console.error(`[api:chat-agent/audios GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  let body: { titulo?: unknown; base64?: unknown; mime?: unknown; duracionS?: unknown; clave?: unknown; linkVideo?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  // Guardar solo el link del video (sin audio): el paso lo pide en la tarjeta 1.
  if (typeof body.linkVideo === 'string' && body.base64 === undefined) {
    try {
      await setSetting(KEY_LINK_VIDEO, body.linkVideo.trim().slice(0, 500));
      return Response.json({ ok: true, linkVideo: body.linkVideo.trim() });
    } catch (e) {
      return Response.json({ ok: false, error: msg(e) }, { status: 400 });
    }
  }

  if (typeof body.base64 !== 'string' || !body.base64) {
    return Response.json({ ok: false, error: 'falta el audio' }, { status: 400 });
  }
  try {
    const a = await crearAudio({
      titulo: String(body.titulo ?? '').trim(),
      base64: body.base64,
      mime: typeof body.mime === 'string' ? body.mime : undefined,
      duracionS: Number.isFinite(Number(body.duracionS)) ? Number(body.duracionS) : null,
    });
    // Enganche a la situación. Si esa clave ya tenía un audio, queda pisada: es
    // una re-grabación, y el audio viejo sigue en la biblioteca por si lo quiere.
    let porClave = await getPorClave();
    if (esClaveAudio(body.clave)) {
      porClave = { ...porClave, [body.clave]: a.id };
      await setSetting(KEY_AUDIOS_CLAVE, JSON.stringify(porClave));
    }
    return Response.json({ ok: true, audio: { ...a, url: await audioUrlFirmada(a.media_path) }, porClave });
  } catch (e) {
    console.error(`[api:chat-agent/audios POST] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isFinite(id)) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  try {
    await borrarAudio(id);
    // Sacarlo del mapa en el mismo golpe: dejar la clave apuntando a un audio
    // borrado haría que el motor intente enviar algo que ya no está.
    const porClave = await getPorClave();
    const limpio: Record<string, number> = {};
    for (const [k, v] of Object.entries(porClave)) if (v !== id) limpio[k] = v;
    if (Object.keys(limpio).length !== Object.keys(porClave).length) {
      await setSetting(KEY_AUDIOS_CLAVE, JSON.stringify(limpio));
    }
    return Response.json({ ok: true, porClave: limpio });
  } catch (e) {
    console.error(`[api:chat-agent/audios DELETE] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

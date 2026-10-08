// =============================================================================
// API: biblioteca de ARCHIVOS de los mensajes del Chatbot (mig 0225)
// =============================================================================
// GET    → { adjuntos: AdjuntoDto[] }                       la biblioteca, con su URL para verla
// POST   { action: 'subir', nombre, mime, tamano }          → { path, signedUrl, apikey }
// POST   { action: 'registrar', path, titulo?, nombre? }    → { adjunto }
// DELETE ?id=N                                              → { ok } · 409 si un paso lo usa
//
// El archivo NO pasa por esta ruta: el navegador lo sube directo al bucket con la URL firmada
// (una función de Vercel corta el cuerpo en ~4,5 MB) y después lo registra. La lógica y sus
// guardas viven en lib/setting-adjuntos.ts; las reglas puras, en lib/setting-adjuntos-reglas.ts.
//
// Lo subido que no llega a registrarse no se queda en el bucket: un registro que falla lo suelta
// (`registrarAdjunto`), y cada subida nueva barre, después de contestar, lo que quedó de una
// pestaña cerrada a mitad de camino (`barrerAdjuntosHuerfanos`, con `after()`).
//
// Guard: admin del workspace, como la biblioteca de audios: lo que se sube aquí sale a los leads
// con el número del negocio.
// =============================================================================

import { after, type NextRequest } from 'next/server';
import { getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { listarAdjuntos, urlsDeAdjuntos, aDto, urlSubidaAdjunto, registrarAdjunto, borrarAdjunto, barrerAdjuntosHuerfanos } from '@/lib/setting-adjuntos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function guard(): Promise<Response | null> {
  const [ws, rol] = await Promise.all([getWorkspaceActual(), getRolWsEfectivo()]);
  if (ws == null || rol !== 'admin') {
    return Response.json({ ok: false, error: 'Solo el admin del workspace puede gestionar los archivos.' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const g = await guard();
  if (g) return g;
  try {
    const lista = await listarAdjuntos();
    const urls = await urlsDeAdjuntos(lista);
    return Response.json({ ok: true, adjuntos: lista.map((a) => aDto(a, urls[a.id] ?? null)) });
  } catch (e) {
    console.error(`[api:chat-agent/adjuntos GET] ${msg(e)}`);
    return Response.json({ ok: false, error: msg(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  let body: { action?: unknown; nombre?: unknown; mime?: unknown; tamano?: unknown; path?: unknown; titulo?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  if (body.action === 'subir') {
    const r = await urlSubidaAdjunto({ nombre: String(body.nombre ?? ''), mime: String(body.mime ?? ''), tamano: Number(body.tamano) });
    // Quien sube es quien deja huérfanos (la pestaña cerrada entre la subida y el registro): se
    // barren los de más de una hora DESPUÉS de contestar, sin demorar la subida (costuras-10). El
    // workspace se fija ANTES, con el de esta subida: el barrido no vuelve a leer la cookie.
    if (r.ok) {
      const ws = await getWorkspaceActual();
      if (ws) after(() => runWithWorkspace(ws, () => barrerAdjuntosHuerfanos()));
    }
    return Response.json(r, { status: r.ok ? 200 : 400 });
  }
  if (body.action === 'registrar') {
    const r = await registrarAdjunto({
      path: String(body.path ?? ''),
      titulo: typeof body.titulo === 'string' ? body.titulo : null,
      nombre: typeof body.nombre === 'string' ? body.nombre : null,
    });
    return Response.json(r, { status: r.ok ? 200 : 400 });
  }
  return Response.json({ ok: false, error: 'acción inválida' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const g = await guard();
  if (g) return g;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ ok: false, error: 'id inválido' }, { status: 400 });
  const r = await borrarAdjunto(id);
  if (r.ok) return Response.json({ ok: true });
  return Response.json(r, { status: r.usadoEn ? 409 : 500 });
}

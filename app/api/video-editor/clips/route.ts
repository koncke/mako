// =============================================================================
// POST /api/video-editor/clips — «Clips mágicos»: los mejores momentos de un video largo
// =============================================================================
// POST json { frases: [{ texto, inicio, fin }], cuantos } → { ok, clips, conIA, aviso }
//
// Pedido de Leila (30/10/2026). El editor manda lo que se dice en el video (los subtítulos, o la transcripción que
// hizo en el navegador); acá la IA DEL NEGOCIO elige los momentos por número de frase, adentro de «sólo su IA» (D6b), y
// el código valida tiempos, duración y solape (lib/editor-video/clips-ia.ts). Sin IA, los mejores por las reglas. Esta
// ruta no escribe nada: el proyecto vive en el navegador, y cada clip lo abre la persona en un proyecto nuevo.
//
// La puerta es la de /api/video-editor/ia (la prueba 1d de tests/video-editor-integracion.test.ts lo exige).

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { veEditorVideo } from '@/app/video-editor/acceso';
import { tabEnCapa } from '@/lib/capas';
import { rateLimit } from '@/lib/rate-limit';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { elegirClips } from '@/lib/editor-video/clips-ia';
import { cuantosClips, frasesDeClips, TOPES_CLIPS } from '@/lib/editor-video/clips';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// La IA tiene 150 s para todos los pedazos (lib/editor-video/clips-ia.ts).
export const maxDuration = 180;

/** Una hora y media de charla en JSON entra holgada. */
const TOPE_CUERPO = 600_000;

type Puerta = { ws: number } | { error: string; status: number };

async function puerta(): Promise<Puerta> {
  const [sesion, rol] = await Promise.all([getUsuarioActual(), getRolWsEfectivo()]);
  if (!sesion || rol == null) return { error: 'Tu sesión venció. Vuelve a entrar.', status: 401 };
  if (rol !== 'admin') return { error: 'Solo el administrador.', status: 403 };
  if (!(await veEditorVideo())) return { error: 'No encontrado.', status: 404 };
  if (!tabEnCapa('video-editor', await getCapaActual())) return { error: 'Tu plan no incluye el Video Editor.', status: 403 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Entra a un cliente primero.', status: 400 };
  return { ws };
}

const responder = (cuerpo: object, status = 200) => Response.json(cuerpo, { status, headers: { 'cache-control': 'no-store' } });
const fallo = (error: string, status: number) => responder({ ok: false, error }, status);

export async function POST(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  if (!rateLimit(`video-editor:clips:${p.ws}`, 10, 60_000)) return fallo('Demasiados pedidos. Espera un minuto.', 429);
  const crudo = await req.text().catch(() => '');
  if (!crudo || crudo.length > TOPE_CUERPO) return fallo('El video es muy largo para buscarle clips de una vez.', 413);
  let body: { frases?: unknown; cuantos?: unknown };
  try { body = JSON.parse(crudo) as typeof body; } catch { return fallo('Pedido inválido.', 400); }
  // No se le cree al navegador: se vuelven a sanear las frases (texto, tiempos, orden y tope).
  const lista = Array.isArray(body.frases) ? body.frases.slice(0, TOPES_CLIPS.maxFrases) : [];
  const frases = frasesDeClips(lista.map((f) => {
    const o = f && typeof f === 'object' ? (f as Record<string, unknown>) : {};
    return { texto: typeof o.texto === 'string' ? o.texto : '', inicio: Number(o.inicio), fin: Number(o.fin) };
  }));
  if (!frases.length) return fallo('No llegó lo que se dice en el video.', 422);
  const r = await runWithWorkspace(p.ws, () => conSuIADelNegocio(p.ws, () => elegirClips(frases, cuantosClips(body.cuantos))));
  return responder({ ok: true, ...r });
}

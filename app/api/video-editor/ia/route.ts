// =============================================================================
// POST /api/video-editor/ia — el chat del Video Editor
// =============================================================================
// POST json {instruccion, linea, alcance} → { ok, resumen, operaciones, descartes } | { ok:false, error }
//
// El panel «Editar con IA» (app/video-editor/_opencut/chat/PanelChat.tsx) manda lo que pidió
// la persona y la vista de la línea de tiempo; vuelve una PROPUESTA (operaciones del catálogo,
// lib/editor-video/chat-catalogo.ts) que la persona revisa y acepta en el editor. Esta ruta no
// escribe nada: el proyecto vive en el navegador.
//
// La puerta es la de /api/video-editor/tts: sesión, rol de admin, el candado del editor
// (`veEditorVideo`), capa con la tab y workspace. ⚠️ El workspace se exige ANTES de llamar a la
// IA: corre con la key DEL CLIENTE (la cascada gratis), y sin workspace cae al ws 1, que es un
// cliente.
//
// Va detrás de la sesión (NO está en lib/rutas-publicas.ts) y el proxy le exige Origin propio
// al POST.

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { veEditorVideo } from '@/app/video-editor/acceso';
import { tabEnCapa } from '@/lib/capas';
import { rateLimit } from '@/lib/rate-limit';
import { editarVideo } from '@/lib/editor-video/ia';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// La IA tiene 90 s (lib/editor-video/ia.ts) y una reparación del JSON con aire.
export const maxDuration = 120;

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

const fallo = (error: string, status: number) =>
  Response.json({ ok: false, error }, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  if (!rateLimit(`video-editor:ia:${p.ws}`, 30, 60_000)) return fallo('Demasiados pedidos. Espera un minuto.', 429);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fallo('Pedido inválido.', 400); }
  if (!body || typeof body !== 'object') return fallo('Pedido inválido.', 400);

  return runWithWorkspace(p.ws, async () => {
    const r = await editarVideo({ instruccion: body.instruccion, linea: body.linea, alcance: body.alcance });
    if (!r.ok) return fallo(r.error, r.status);
    return Response.json(r, { headers: { 'cache-control': 'no-store' } });
  });
}

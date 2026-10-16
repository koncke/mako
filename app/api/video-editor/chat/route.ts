// =============================================================================
// /api/video-editor/chat — el hilo del chat «Editar con IA», guardado
// =============================================================================
// GET ?proyecto=<id>                       → { ok, hilo: { mensajes, version } | null } | { ok:false, sinTabla }
// PUT json { proyecto, nombre, mensajes, version }
//                                          → { ok, version } | 409 { ok:false, conflicto, hilo } | { ok:false, sinTabla }
//
// Etapa 3 del diseño AI-native (docs/diseno-mako-ai-native.md, decisión 5): el hilo vivía en la memoria de la
// pestaña. Uno por persona y por proyecto (decisión 3): la persona sale de la SESIÓN, nunca del pedido. El formato y
// el saneo, lib/editor-video/chat-hilo.ts (la ruta no le cree al navegador: vuelve a sanear); la base,
// lib/editor-video/chat-hilo-server.ts. Lo sincroniza app/video-editor/_opencut/chat/hilo.ts.
//
// La puerta es la de /api/video-editor/ia: sesión, rol de admin, el candado del editor (`veEditorVideo`), capa con
// la tab y workspace. Va detrás de la sesión (NO está en lib/rutas-publicas.ts) y el proxy le exige Origin propio al
// PUT. Sin IA y sin costo.

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { veEditorVideo } from '@/app/video-editor/acceso';
import { tabEnCapa } from '@/lib/capas';
import { rateLimit } from '@/lib/rate-limit';
import { personaDeSesion } from '@/lib/chart-chats-reglas';
import { guardarHilo, leerHilo, proyectoValido } from '@/lib/editor-video/chat-hilo-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Un hilo con sus topes (lib/editor-video/chat-hilo.ts) entra holgado; más es otra cosa. */
const TOPE_CUERPO = 1_000_000;

type Puerta = { ws: number; persona: string } | { error: string; status: number };

async function puerta(): Promise<Puerta> {
  const [sesion, rol] = await Promise.all([getUsuarioActual(), getRolWsEfectivo()]);
  if (!sesion || rol == null) return { error: 'Tu sesión venció. Vuelve a entrar.', status: 401 };
  if (rol !== 'admin') return { error: 'Solo el administrador.', status: 403 };
  if (!(await veEditorVideo())) return { error: 'No encontrado.', status: 404 };
  if (!tabEnCapa('video-editor', await getCapaActual())) return { error: 'Tu plan no incluye el Video Editor.', status: 403 };
  const ws = await getWorkspaceActual();
  if (ws == null) return { error: 'Entra a un cliente primero.', status: 400 };
  const persona = personaDeSesion(sesion);
  if (!persona) return { error: 'Tu sesión venció. Vuelve a entrar.', status: 401 };
  return { ws, persona };
}

const responder = (cuerpo: object, status = 200) => Response.json(cuerpo, { status, headers: { 'cache-control': 'no-store' } });
const fallo = (error: string, status: number) => responder({ ok: false, error }, status);

export async function GET(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  const proyecto = req.nextUrl.searchParams.get('proyecto');
  if (!proyectoValido(proyecto)) return fallo('Falta el proyecto.', 400);
  const r = await leerHilo({ ws: p.ws, persona: p.persona, proyecto });
  if (!r.ok) return r.sinTabla ? responder({ ok: false, sinTabla: true, error: 'El chat todavía no se guarda.' }) : fallo('No se pudo leer el chat.', 500);
  return responder({ ok: true, hilo: r.hilo });
}

export async function PUT(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  if (!rateLimit(`video-editor:chat:${p.ws}:${p.persona}`, 120, 60_000)) return fallo('Demasiados guardados. Espera un minuto.', 429);
  const crudo = await req.text().catch(() => '');
  if (!crudo || crudo.length > TOPE_CUERPO) return fallo('Pedido inválido.', 400);
  let body: Record<string, unknown>;
  try { body = JSON.parse(crudo) as Record<string, unknown>; } catch { return fallo('Pedido inválido.', 400); }
  if (!body || typeof body !== 'object' || !proyectoValido(body.proyecto)) return fallo('Falta el proyecto.', 400);
  const version = body.version == null ? null : Number.isInteger(body.version) && (body.version as number) >= 1 ? (body.version as number) : undefined;
  if (version === undefined) return fallo('La versión no es válida.', 400);
  const r = await guardarHilo({
    ws: p.ws, persona: p.persona, proyecto: body.proyecto,
    nombre: typeof body.nombre === 'string' ? body.nombre : null, mensajes: body.mensajes, version,
  });
  if (r.ok) return responder({ ok: true, version: r.version });
  if ('conflicto' in r) return responder({ ok: false, conflicto: true, hilo: r.hilo }, 409);
  if (r.sinTabla) return responder({ ok: false, sinTabla: true, error: 'El chat todavía no se guarda.' });
  return fallo('No se pudo guardar el chat.', r.status ?? 500);
}

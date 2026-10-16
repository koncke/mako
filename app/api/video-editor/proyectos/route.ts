// =============================================================================
// /api/video-editor/proyectos — la copia de lectura de un proyecto del Video Editor, para la API de MaKo
// =============================================================================
// GET    ?proyecto=<id>  → { ok, refs: [[id, ref], …] } | { ok:false, sinTabla }   (las refs que ya usó el proyecto)
// PUT    json { proyecto, nombre, escenaId, duracion, vista, refs, demasiadoGrande } → { ok } | { ok:false, sinTabla }
// DELETE ?proyecto=<id>  → { ok }                                                  (al borrar el proyecto en el editor)
//
// Etapa 3 del diseño AI-native (docs/diseno-mako-ai-native.md): el proyecto vive en el navegador y la API en el server;
// el editor sube, un rato después de cada cambio, la vista que lee su chat (app/video-editor/_opencut/chat/espejo.ts).
// Reglas: lib/editor-video/espejo.ts (la ruta vuelve a validar: no le cree al navegador). La base:
// lib/editor-video/espejo-server.ts. Lo leen `listar_proyectos_video` y `ver_proyecto_video`.
//
// La puerta es la de /api/video-editor/ia, escrita acá (la prueba 1d de tests/video-editor-integracion.test.ts lo
// exige en cada ruta): sesión, rol de admin, el candado del editor, capa con la tab y workspace. Va detrás de la sesión
// y el proxy le exige Origin propio al PUT y al DELETE. Sin IA y sin costo.

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { veEditorVideo } from '@/app/video-editor/acceso';
import { tabEnCapa } from '@/lib/capas';
import { rateLimit } from '@/lib/rate-limit';
import { personaDeSesion } from '@/lib/chart-chats-reglas';
import { TOPES_CHAT } from '@/lib/editor-video/chat-catalogo';
import { espejoValido, idDelMotor } from '@/lib/editor-video/espejo';
import { borrarEspejo, guardarEspejo, refsDelEspejo } from '@/lib/editor-video/espejo-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** La vista del chat (≤ 60 k) y sus refs entran holgadas. */
const TOPE_CUERPO = TOPES_CHAT.vistaMax + 400_000;

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
const sinTabla = () => responder({ ok: false, sinTabla: true, error: 'La copia del proyecto todavía no se guarda.' });

export async function GET(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  const proyecto = req.nextUrl.searchParams.get('proyecto');
  if (!idDelMotor(proyecto)) return fallo('Falta el proyecto.', 400);
  const r = await refsDelEspejo(p.ws, proyecto);
  if (!r.ok) return r.sinTabla ? sinTabla() : fallo('No se pudo leer el proyecto.', 500);
  return responder({ ok: true, refs: r.refs });
}

export async function PUT(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  if (!rateLimit(`video-editor:proyectos:${p.ws}:${p.persona}`, 60, 60_000)) return fallo('Demasiadas subidas. Espera un minuto.', 429);
  const crudo = await req.text().catch(() => '');
  if (!crudo || crudo.length > TOPE_CUERPO) return fallo('Pedido inválido.', 400);
  let body: unknown;
  try { body = JSON.parse(crudo); } catch { return fallo('Pedido inválido.', 400); }
  const v = espejoValido(body);
  if (!v.ok) return fallo(v.error, 400);
  const r = await guardarEspejo(p.ws, p.persona, v.espejo);
  if (!r.ok) return r.sinTabla ? sinTabla() : fallo('No se pudo guardar la copia del proyecto.', 500);
  return responder({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  const proyecto = req.nextUrl.searchParams.get('proyecto');
  if (!idDelMotor(proyecto)) return fallo('Falta el proyecto.', 400);
  const r = await borrarEspejo(p.ws, proyecto);
  if (!r.ok) return r.sinTabla ? sinTabla() : fallo('No se pudo borrar la copia del proyecto.', 500);
  return responder({ ok: true });
}

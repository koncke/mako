// =============================================================================
// /api/video-editor/propuestas — lo que la API de MaKo propuso en un proyecto, para aceptarlo en el editor
// =============================================================================
// GET   ?proyecto=<id>                       → { ok, propuestas: [{ id, canal, escenaId, refs, operaciones, lineas, creada }] }
// PATCH json { id, estado: 'aplicada'|'descartada', descartes? } → { ok } | { ok:false, yaResuelta }
//
// Etapa 3 del diseño AI-native: las acciones del editor en la API (lib/editor-video/chat-api.ts) dejan sus operaciones
// en una propuesta del proyecto (mig 0302); el editor las muestra en su chat «Editar con IA» y una persona las acepta o
// las descarta (app/video-editor/_opencut/chat/propuestas.ts). Nada se aplica sin ese clic: la línea de tiempo la
// escribe el editor, en el navegador de quien lo edita. Reglas: lib/editor-video/propuestas.ts.
//
// La puerta es la de /api/video-editor/ia, escrita acá (la prueba 1d de tests/video-editor-integracion.test.ts lo
// exige en cada ruta). Va detrás de la sesión y el proxy le exige Origin propio al PATCH. Sin IA y sin costo.

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { veEditorVideo } from '@/app/video-editor/acceso';
import { tabEnCapa } from '@/lib/capas';
import { personaDeSesion } from '@/lib/chart-chats-reglas';
import { idDelMotor } from '@/lib/editor-video/espejo';
import { propuestasAbiertas, resolverPropuesta } from '@/lib/editor-video/propuestas-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  const proyecto = req.nextUrl.searchParams.get('proyecto');
  if (!idDelMotor(proyecto)) return fallo('Falta el proyecto.', 400);
  const r = await propuestasAbiertas(p.ws, proyecto);
  if (!r.ok) return r.sinTabla ? responder({ ok: true, propuestas: [] }) : fallo('No se pudieron leer las propuestas.', 500);
  return responder({ ok: true, propuestas: r.propuestas });
}

export async function PATCH(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return fallo('Pedido inválido.', 400); }
  if (!body || typeof body.id !== 'string' || !UUID.test(body.id)) return fallo('Falta la propuesta.', 400);
  if (body.estado !== 'aplicada' && body.estado !== 'descartada') return fallo('El estado no es válido.', 400);
  const descartes = Array.isArray(body.descartes) ? body.descartes.filter((d): d is string => typeof d === 'string') : [];
  const r = await resolverPropuesta({ ws: p.ws, id: body.id, estado: body.estado, persona: p.persona, descartes });
  if (r.ok) return responder({ ok: true });
  if ('yaResuelta' in r) return responder({ ok: false, yaResuelta: true, error: 'Ya se había resuelto.' });
  return r.sinTabla ? responder({ ok: false, error: 'Las propuestas todavía no se guardan.' }) : fallo('No se pudo cerrar la propuesta.', 500);
}

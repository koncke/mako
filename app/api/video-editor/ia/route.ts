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
import { cuerpoYArchivos, leerLosArchivos } from '@/lib/adjuntos-del-chat';
import { lecturaDeArchivos } from '@/lib/mako-adjuntos';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// La IA tiene 90 s (lib/editor-video/ia.ts) y una reparación del JSON con aire.
export const maxDuration = 300;
/** Lo que entra de la lectura de los archivos al pedido (la línea de tiempo ya es larga). Con fotos o PDF, primero se leen. */
const TOPE_LECTURA_EDITOR = 8_000;

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

  // Con fotos o PDF (28/10/2026, las cajas unificadas): vienen en multipart (lib/adjuntos-del-chat.ts).
  const c = await cuerpoYArchivos(req);
  if (!c.ok) return fallo(c.error, c.status);
  const body = c.body;

  return runWithWorkspace(p.ws, async () => {
    // Se leen con la IA del negocio (por eso adentro de su workspace), y su lectura va aparte de la instrucción, como dato.
    const { lecturas, noLeidos } = await leerLosArchivos(c.adjuntos, 'video-editor-chat');
    const escrita = String(body.instruccion ?? '').trim();
    if (c.adjuntos.length && !lecturas.length && !escrita) return fallo(`No pude leer ${noLeidos.map((n) => `«${n}»`).join(', ')}: escribe qué quieres cambiar.`, 422);
    const instruccion = c.adjuntos.length && !escrita ? 'Usa lo que traen estos archivos en el video.' : body.instruccion;
    const archivos = lecturas.length ? lecturaDeArchivos(lecturas, TOPE_LECTURA_EDITOR) : undefined;
    const r = await editarVideo({ instruccion, linea: body.linea, alcance: body.alcance, intencion: body.intencion, archivos });
    if (!r.ok) return fallo(r.error, r.status);
    return Response.json(r, { headers: { 'cache-control': 'no-store' } });
  });
}

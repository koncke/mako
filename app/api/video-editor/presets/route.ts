// =============================================================================
// /api/video-editor/presets — los presets de subtítulos del negocio (los estilos de la marca)
// =============================================================================
// GET                         → { ok, presets }
// POST   json { preset, id? } → { ok, preset }            (sin id crea; con id reemplaza ése)
// DELETE ?id=<id>             → { ok }
//
// Pedido de Leila (30/10/2026): «presets guardados por marca o por cliente». Las reglas:
// lib/editor-video/presets-subtitulos.ts (la ruta vuelve a sanear: no le cree al navegador);
// la base: lib/editor-video/presets-subtitulos-server.ts. Lo mismo por la API de MaKo
// (`listar_presets_subtitulos_video`, `guardar_preset_subtitulos_video`, `borrar_preset_subtitulos_video`).
//
// La puerta es la de /api/video-editor/proyectos (la prueba 1d de tests/video-editor-integracion.test.ts lo
// exige en cada ruta): sesión, rol de admin, el candado del editor, capa con la tab y workspace. Sin IA y sin costo.

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { veEditorVideo } from '@/app/video-editor/acceso';
import { tabEnCapa } from '@/lib/capas';
import { rateLimit } from '@/lib/rate-limit';
import { esIdPreset } from '@/lib/editor-video/presets-subtitulos';
import { borrarPreset, guardarPreset, listarPresets } from '@/lib/editor-video/presets-subtitulos-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TOPE_CUERPO = 20_000;

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

export async function GET() {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  try {
    return responder({ ok: true, presets: await listarPresets() });
  } catch (e) {
    console.error('[video-editor/presets] no se pudieron leer', e);
    return fallo('No se pudieron leer los presets.', 500);
  }
}

export async function POST(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  if (!rateLimit(`video-editor:presets:${p.ws}`, 30, 60_000)) return fallo('Demasiados cambios. Espera un minuto.', 429);
  const crudo = await req.text().catch(() => '');
  if (!crudo || crudo.length > TOPE_CUERPO) return fallo('Pedido inválido.', 400);
  let body: { preset?: unknown; id?: unknown };
  try { body = JSON.parse(crudo) as typeof body; } catch { return fallo('Pedido inválido.', 400); }
  if (body.id !== undefined && body.id !== null && !esIdPreset(body.id)) return fallo('Pedido inválido.', 400);
  try {
    const r = await guardarPreset(body.preset, (body.id as string | null | undefined) ?? null);
    if (!r.ok) return fallo(`No se guardó: ${r.motivo}.`, 400);
    return responder({ ok: true, preset: r.preset });
  } catch (e) {
    console.error('[video-editor/presets] no se pudo guardar', e);
    return fallo('No se pudo guardar el preset.', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const p = await puerta();
  if ('error' in p) return fallo(p.error, p.status);
  const id = req.nextUrl.searchParams.get('id');
  if (!esIdPreset(id)) return fallo('Falta el preset.', 400);
  try {
    const r = await borrarPreset(id);
    if (!r.ok) return fallo(`No se borró: ${r.motivo}.`, 400);
    return responder({ ok: true });
  } catch (e) {
    console.error('[video-editor/presets] no se pudo borrar', e);
    return fallo('No se pudo borrar el preset.', 500);
  }
}

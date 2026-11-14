// =============================================================================
// /api/competitor-spy/desarmar-imagen — un carrusel o una imagen de anuncio, desarmado (ticket 97, «otros formatos»)
// =============================================================================
//   POST { accion: 'ver', piezaId }      → lo guardado (sin pedir nada)
//   POST { accion: 'desarmar', piezaId } → la IA del negocio con visión lo desarma (o devuelve lo guardado)
// Lo llama la caja de una pieza de Competitors Spy (app/competitor-spy/DesarmarImagen.tsx). lib/imagen-desarmar-servidor.ts.
// ⚠️ LA PUERTA ES LA DE SPY (`soloAdminDeTab('market-an')`): gasta la IA del negocio. ⚠️ CON SU IA (D6b): `conSuIADelNegocio`.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { soloAdminDeTab } from '@/lib/puerta-admin-tab';
import { conSuIADelNegocio } from '@/lib/ia-del-negocio';
import { desarmarImagenDeSpy, desarmeImagenGuardado } from '@/lib/imagen-desarmar-servidor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const json = (cuerpo: Record<string, unknown>, status = 200) => Response.json(cuerpo, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: NextRequest) {
  const cerrada = await soloAdminDeTab('market-an');
  if (cerrada) return cerrada;
  const s = await getUsuarioActual();
  const ws = s ? await getWorkspaceActual() : null;
  if (!s || ws == null) return json({ ok: false, error: 'Tu sesión venció. Vuelve a entrar.' }, 401);
  const body = (await req.json().catch(() => ({}))) as { accion?: unknown; piezaId?: unknown };
  const piezaId = Number(body.piezaId);
  if (!Number.isSafeInteger(piezaId) || piezaId <= 0) return json({ ok: false, error: 'Falta la pieza.' }, 400);
  if (body.accion === 'ver') return json({ ok: true, guardado: await desarmeImagenGuardado(piezaId) });
  if (body.accion === 'desarmar') {
    try {
      const r = await runWithWorkspace(ws, () => conSuIADelNegocio(ws, () => desarmarImagenDeSpy(piezaId)));
      return r.ok ? json({ ok: true, guardado: r.guardado, nuevo: r.nuevo }) : json({ ok: false, error: r.error });
    } catch (e) {
      console.error('[desarmar-imagen]', e instanceof Error ? e.message : String(e));
      return json({ ok: false, error: 'No pude desarmarlo. Prueba de nuevo en un momento.' }, 500);
    }
  }
  return json({ ok: false, error: 'No sé qué hacer con eso.' }, 400);
}

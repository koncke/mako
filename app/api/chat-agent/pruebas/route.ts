// =============================================================================
// /api/chat-agent/pruebas — la prueba de la tarjeta «A/B TEST» de una automatización (tanda A3, 25/10/2026)
// =============================================================================
// GET  ?secuenciaId=<id>             → lo que dice la tarjeta (el estado y los números de cada rama).
// POST { action: 'empezar', secuenciaId, nodoId, mdeRel? } → empieza la prueba sobre lo PUBLICADO, con su plan.
// POST { action: 'detener', secuenciaId }                  → la detiene (todos a A, sin concluir nada).
// La misma puerta que el chat de MaKo de Automations (../secuencias/ia/falta): el workspace y el rol de la sesión, y del
// mismo origen. Lo que decide vive en lib/pruebas/ (el juez es código; acá sólo se lee y se escribe).
// =============================================================================

import type { NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getTenantDb, getWorkspaceActual } from '@/lib/workspace';
import { detenerPruebaDeLaTarjeta, empezarPruebaDeLaTarjeta, estadoDeLaTarjeta } from '@/lib/pruebas/automatizacion';

export const dynamic = 'force-dynamic';

const json = (cuerpo: unknown, status = 200) => Response.json(cuerpo, { status });

/** ¿La automatización es de ESTE negocio? (En su base: si no, no hay prueba que mirar.) */
async function esDelNegocio(secuenciaId: number): Promise<boolean> {
  const { data, error } = await (await getTenantDb()).from('nutricion_secuencias').select('id').eq('id', secuenciaId).maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function GET(req: NextRequest) {
  const [s, ws] = await Promise.all([getUsuarioActual(), getWorkspaceActual()]);
  if (!s?.email?.includes('@') || ws == null) return json({ ok: false, error: 'Entra a MaKo para ver la prueba.' }, 401);
  const secuenciaId = Number(req.nextUrl.searchParams.get('secuenciaId'));
  if (!Number.isInteger(secuenciaId) || secuenciaId <= 0) return json({ ok: false, error: 'Falta la automatización' }, 400);
  try {
    if (!(await esDelNegocio(secuenciaId))) return json({ ok: false, error: 'Esa automatización no es de este negocio' }, 404);
    return json({ ok: true, ...(await estadoDeLaTarjeta(ws, secuenciaId)) });
  } catch (e) {
    console.error(`[api:chat-agent/pruebas GET] ${e instanceof Error ? e.message : String(e)}`);
    return json({ ok: false, error: 'No pude leer la prueba' }, 500);
  }
}

export async function POST(req: NextRequest) {
  const origen = req.headers.get('origin');
  let mismo = false;
  try { mismo = !!origen && new URL(origen).host === req.headers.get('host'); } catch { mismo = false; }
  if (!mismo) return json({ ok: false, error: 'No salió de MaKo' }, 403);
  const [s, ws, rol] = await Promise.all([getUsuarioActual(), getWorkspaceActual(), getRolWsEfectivo()]);
  if (!s?.email?.includes('@') || ws == null || rol !== 'admin') return json({ ok: false, error: 'Solo el administrador del negocio puede empezar o detener una prueba.' }, 403);
  let body: { action?: unknown; secuenciaId?: unknown; nodoId?: unknown; mdeRel?: unknown } = {};
  try { body = ((await req.json()) ?? {}) as typeof body; } catch { return json({ ok: false, error: 'No entendí el pedido' }, 400); }
  const secuenciaId = Number(body.secuenciaId);
  if (!Number.isInteger(secuenciaId) || secuenciaId <= 0) return json({ ok: false, error: 'Falta la automatización' }, 400);
  try {
    if (!(await esDelNegocio(secuenciaId))) return json({ ok: false, error: 'Esa automatización no es de este negocio' }, 404);
    const quien = s.email.trim().toLowerCase();
    if (body.action === 'empezar') {
      const nodoId = typeof body.nodoId === 'string' ? body.nodoId : '';
      if (!nodoId) return json({ ok: false, error: 'Falta la tarjeta de la prueba' }, 400);
      const mdeRel = Number(body.mdeRel);
      const r = await empezarPruebaDeLaTarjeta(ws, secuenciaId, nodoId, quien, Number.isFinite(mdeRel) && mdeRel > 0 ? { mdeRel } : {});
      return r.ok ? json({ ok: true, plan: r.plan, ...(await estadoDeLaTarjeta(ws, secuenciaId)) }) : json({ ok: false, error: r.error });
    }
    if (body.action === 'detener') {
      const r = await detenerPruebaDeLaTarjeta(ws, secuenciaId, quien);
      return r.ok ? json({ ok: true, ...(await estadoDeLaTarjeta(ws, secuenciaId)) }) : json({ ok: false, error: r.error ?? 'No pude detenerla' });
    }
    return json({ ok: false, error: 'No sé qué hacer con la prueba' }, 400);
  } catch (e) {
    console.error(`[api:chat-agent/pruebas POST] ${e instanceof Error ? e.message : String(e)}`);
    return json({ ok: false, error: 'No pude cambiar la prueba: vuelve a tocar en un rato' }, 500);
  }
}

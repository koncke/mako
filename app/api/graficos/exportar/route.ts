// =============================================================================
// GET /api/graficos/exportar?hoja=<id> — una hoja de TU Dashboard en CSV, para el link que deja el chat
// =============================================================================
// Ops Center = lo principal (20/10/2026, docs/ops-center-principal.md, pieza 2.6): «exportá mi hoja de Marketing a
// CSV» desde el Ops Center. La operación `exportar_hoja_dashboard` (lib/api-mako/areas/dashboard.run.ts) no puede
// pasarle un archivo a un modelo: le deja a la persona un link a esta ruta, armado por el código.
//
// ⚠️ NO HAY UN CSV PROPIO ACÁ. Corre `leer_hoja_dashboard` con `formato=csv` por el choke point de la API
//    (`ejecutarOperacion`): el MISMO CSV que da la API por HTTP (`csvDeHoja`, app/dashboard/exportar.ts, el de la
//    pantalla), con el MISMO gating (canal app, el rol y la capa del workspace) y en el workspace de la sesión.
// ⚠️ El informe es el de quien está logueado (`Ctx.quien`): el link no sirve para bajar el de otra persona, y sin
//    sesión no baja nada. El `?ws=` lo resuelve el workspace de la sesión, nunca la query cruda.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { getUsuarioActual } from '@/lib/auth';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';
import { ejecutarOperacion } from '@/lib/api-mako/ejecutar';
import type { Ctx } from '@/lib/api-mako/tipos';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function GET(req: NextRequest) {
  const sesion = await getUsuarioActual();
  const rolWs = await getRolWsEfectivo();
  if (!sesion || !rolWs) return err(401, 'no autenticado');
  const ws = await getWorkspaceActual();
  if (ws == null) return err(400, 'Elige una cuenta primero.');
  const hoja = (req.nextUrl.searchParams.get('hoja') ?? '').trim().slice(0, 80);
  if (!hoja) return err(400, 'Falta la hoja.');
  const sub = String(sesion.sub);
  const ctx: Ctx = {
    ws, canal: 'app', canalKey: `app:exportar:${sub}`, alcance: 'lectura', rol: rolWs === 'admin' ? 'admin' : 'miembro',
    actor: sesion.email || sesion.nombre || sub, formato: 'csv',
    ...(/^\d+$/.test(sub) ? { quien: { sub, email: (sesion.email ?? '').toLowerCase(), nombre: sesion.nombre ?? '' } } : {}),
  };
  const r = await ejecutarOperacion('leer_hoja_dashboard', { hoja }, ctx, 'query');
  if (!r.ok) return err(r.status, r.error);
  if (r.tipo !== 'lectura' || r.formato !== 'csv') return err(500, 'No se pudo armar el CSV.');
  return new NextResponse(r.resultado, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', ...(r.headers ?? {}) },
  });
}

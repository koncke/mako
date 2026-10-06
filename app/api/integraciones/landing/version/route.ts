// =============================================================================
// GET /api/integraciones/landing/version — ¿el Pixel de ESTE negocio quedó viejo?
// =============================================================================
// Lo pide el aviso fijo de la esquina (app/_components/AvisoPixelViejo.tsx) UNA vez
// por carga y al volver a la pestaña. Por eso es UNA consulta por la clave primaria
// y nada más: va a correr en todas las pantallas de la app.
//
// ⚠️ NO CAE AL WORKSPACE 1. `estado/route.ts` resuelve un workspace nulo a OWNER_WS
// para el super admin, y `getSetting` hace lo mismo sin workspace: con eso, el super
// admin navegando sin `?ws=` vería el aviso del Pixel de Mauricio, que es un CLIENTE.
// Sin workspace resuelto, no hay aviso.
//
// ⚠️ Y SÓLO PARA QUIEN LO PUEDE ARREGLAR: el admin del negocio (o el super admin) y
// sólo si la capa del negocio incluye Integraciones. Mostrárselo a un closer o a una
// capa sin esa pestaña es mandarlo a un redirect.
//
// No poder leer no es un dato: ante cualquier error contesta `viejo: false`.
// =============================================================================
import { NextResponse } from 'next/server';
import { getSesionAdmin, getUsuarioActual } from '@/lib/auth';
import { getCapaActual, getRolWsEfectivo, getWorkspaceActual, runWithWorkspace } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';
import { getSetting } from '@/lib/settings';
import { SNIPPET_VERSION_KEY } from '@/lib/landing-token';
import { PIXEL_MINIMO_AVISO, pixelParaActualizar } from '@/lib/pixel-aviso';

export const dynamic = 'force-dynamic';

const NO = () => NextResponse.json({ ok: true, viejo: false }, { headers: { 'Cache-Control': 'no-store' } });

export async function GET() {
  try {
    const sesion = await getUsuarioActual();
    if (!sesion) return NO();
    const esSuper = (await getSesionAdmin()) != null;
    if (!esSuper && (await getRolWsEfectivo()) !== 'admin') return NO();
    const ws = await getWorkspaceActual();
    if (ws == null) return NO();
    if (!tabEnCapa('integraciones', await getCapaActual())) return NO();
    const guardada = await runWithWorkspace(ws, () => getSetting(SNIPPET_VERSION_KEY));
    const { viejo, instalada } = pixelParaActualizar(guardada);
    return NextResponse.json(
      { ok: true, viejo, instalada, minima: PIXEL_MINIMO_AVISO },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    return NO();
  }
}

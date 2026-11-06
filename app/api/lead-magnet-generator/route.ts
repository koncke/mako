// =============================================================================
// POST /api/lead-magnet-generator — lo que hace la tab (la de escritorio y la del teléfono)
// =============================================================================
// { accion: 'armar', plantilla, nombre? } · { accion: 'captar', id } · { accion: 'compartir', id } · { accion: 'enlace', id, enlace }
// · { accion: 'dejar', id } (deja de compartir) · { accion: 'primero', id } · { accion: 'quitar', id } · { accion: 'proponer' } (MaKo
// propone con la IA del negocio: lib/lead-magnets/proponer.ts). Todo pasa por lib/lead-magnets/server.ts, la MISMA puerta que el área `leadmagnet` de la API de
// MaKo. La puerta (app/lead-magnet-generator/puerta.ts) es la primera sentencia: antes de leer el cuerpo.
// =============================================================================

import type { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getUsuarioActual } from '@/lib/auth';
import { puertaLeadMagnetsApi } from '@/app/lead-magnet-generator/puerta';
import { armarLeadMagnet, crearPaginaDeCaptura, dejarDeCompartir, guardarEnlace, linkPublico, ponerPrimero, quitarDeLaLista } from '@/lib/lead-magnets/server';
import { proponerLeadMagnets } from '@/lib/lead-magnets/proponer';

export const dynamic = 'force-dynamic';
// 90: proponer espera a la IA del negocio hasta 45 s, después de leer la oferta y los competidores. El navegador corta a los 95.
export const maxDuration = 90;

const NO_CACHE = { 'Cache-Control': 'no-store' };
// `falta` (la oferta, la IA) viaja con el error: la pantalla ofrece lo que lo arregla.
const responder = (r: { ok: true } | { ok: false; error: string; status: number; falta?: string }, extra: Record<string, unknown> = {}) =>
  r.ok ? Response.json({ ...r, ...extra }, { headers: NO_CACHE }) : Response.json({ ok: false, error: r.error, ...(r.falta ? { falta: r.falta } : {}) }, { status: r.status, headers: NO_CACHE });

export async function POST(req: NextRequest) {
  const cerrada = await puertaLeadMagnetsApi();
  if (cerrada) return cerrada;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return Response.json({ ok: false, error: 'Pedido inválido.' }, { status: 400, headers: NO_CACHE }); }
  const id = typeof body.id === 'string' ? body.id.slice(0, 80) : '';
  const listo = () => revalidatePath('/lead-magnet-generator');
  switch (body.accion) {
    case 'armar': {
      const r = await armarLeadMagnet(body.plantilla, typeof body.nombre === 'string' ? body.nombre : null);
      if (r.ok) listo();
      return responder(r);
    }
    case 'captar': {
      if (!id) break;
      const r = await crearPaginaDeCaptura(id);
      if (r.ok) listo();
      return responder(r);
    }
    case 'compartir': {
      if (!id) break;
      const quien = (await getUsuarioActual().catch(() => null))?.email ?? null;
      const r = await linkPublico(id, quien);
      if (r.ok) listo();
      return responder(r);
    }
    case 'enlace': {
      if (!id) break;
      const r = await guardarEnlace(id, body.enlace);
      if (r.ok) listo();
      return responder(r);
    }
    case 'dejar': {
      if (!id) break;
      const r = await dejarDeCompartir(id);
      if (r.ok) listo();
      return responder(r);
    }
    case 'primero': {
      if (!id) break;
      const r = await ponerPrimero(id);
      if (r.ok) listo();
      return responder(r);
    }
    case 'proponer': {
      const r = await proponerLeadMagnets();
      return responder(r);
    }
    case 'quitar': {
      if (!id) break;
      const r = await quitarDeLaLista(id);
      if (r.ok) listo();
      return responder(r);
    }
  }
  return Response.json({ ok: false, error: 'Pedido inválido.' }, { status: 400, headers: NO_CACHE });
}

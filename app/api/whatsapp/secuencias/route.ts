// =============================================================================
// API interna: secuencias de nutrición para la tab /whatsapp
// =============================================================================
// GET   → todas las secuencias (activas y pausadas) + inscriptos/enviados.
// PATCH → activar/pausar una secuencia. Body: { id, activa }.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getSecuenciasConStats, setSecuenciaActiva } from '@/lib/nutricion';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const secuencias = await getSecuenciasConStats();
    return Response.json({ ok: true, secuencias });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/secuencias GET] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  let id: number;
  let activa: boolean;
  try {
    const body = (await req.json()) as { id?: unknown; activa?: unknown };
    id = Number(body.id);
    activa = body.activa === true;
    if (!Number.isFinite(id)) throw new Error('id inválido');
  } catch {
    return Response.json({ ok: false, error: 'body inválido' }, { status: 400 });
  }
  try {
    await setSecuenciaActiva(id, activa);
    return Response.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[api:whatsapp/secuencias PATCH] ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

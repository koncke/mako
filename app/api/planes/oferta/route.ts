// =============================================================================
// POST /api/planes/oferta — el reloj del 50% del primer mes que dibuja la landing (30/10/2026)
// =============================================================================
// La landing manda el token que tiene guardado (o ninguno) y recibe el reloj: el token, cuándo termina y si sigue vivo
// (lib/oferta-entrada.ts: quien vuelve no arranca otro). Lleva el token en `?oferta=` hasta /planes/<plan>, y el checkout lo mira.
//
// ⚠️ PÚBLICA y desde cualquier origen: las landings viven también en dominios propios. Por eso no lee cookies ni escribe en la
// base: sólo firma una hora. Un token no da nada por sí solo: el descuento lo decide `iniciarCompraDePlan`.
// =============================================================================

import type { NextRequest } from 'next/server';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { PRUEBA_GRATIS_PRENDIDA } from '@/lib/planes-mako';
import { ofertaParaLaLanding } from '@/lib/oferta-entrada';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  if (!rateLimit(`planes-oferta:ip:${clientIp(req)}`, 60, 3600_000)) return Response.json({ error: 'Demasiados intentos.' }, { status: 429, headers: CORS });
  // Con la prueba gratis prendida no hay descuento (el motivo 1 de la estrategia: las dos juntas se leen como sospechosas).
  if (PRUEBA_GRATIS_PRENDIDA) return Response.json({ oferta: null }, { headers: CORS });
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const oferta = ofertaParaLaLanding(typeof body?.token === 'string' ? body.token : null);
  return Response.json({ oferta }, { headers: { ...CORS, 'Cache-Control': 'no-store' } });
}

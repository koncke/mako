// =============================================================================
// GET /api/v1/rate_limit — cuánto queda de la ventana, sin gastarla
// =============================================================================
// El `GET /rate_limit` de GitHub: `resources.core` con limit / remaining / reset / used, y
// el `rate` de nivel superior (GitHub lo mantiene deprecado; acá va igual por compatibilidad
// con quien lo lea). NO consume el límite del workspace: mira la ventana sin contar este
// pedido (el límite por IP, el anti-escaneo, sí cuenta).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { autenticar, esRespuesta, estadoLimite } from '@/lib/api-mako/http';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const auth = await autenticar(req, { sinConsumir: true });
  if (esRespuesta(auth)) return auth;
  return NextResponse.json(estadoLimite(auth.ctx.ws), { headers: { ...auth.cabeceras, 'Cache-Control': 'no-store' } });
}

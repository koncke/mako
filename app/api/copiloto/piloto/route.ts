// =============================================================================
// /api/copiloto/piloto — lo que el negocio configura del piloto fuera del Media Buyer (13/11/2026)
// =============================================================================
// POST {op:'reel', numero} → guarda con cuántas vistas se publica un reel de prueba (lib/copiloto/piloto.ts) y devuelve el número
// con lo que propone Spy. La puerta es la del Media Buyer (`wsDeAdsManager`): el admin del negocio o el super admin mirándolo.
// =============================================================================

import type { NextRequest } from 'next/server';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { guardarNumeroReel, numeroDelReel, numeroDeReelOk } from '@/lib/copiloto/piloto';

export const dynamic = 'force-dynamic';

const J = (x: unknown, status = 200) => Response.json(x, { status });

export async function POST(req: NextRequest) {
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return J({ ok: false, error: 'Pedido inválido.' }, 400); }
  if (body.op !== 'reel') return J({ ok: false, error: `No conozco «${String(body.op)}».` }, 400);
  const n = numeroDeReelOk(body.numero);
  if (n == null) return J({ ok: false, error: 'El número tiene que ser de 50 vistas para arriba.' }, 400);
  try {
    await guardarNumeroReel(ws, n);
    return J({ ok: true, reel: await numeroDelReel(ws) });
  } catch (e) {
    return J({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

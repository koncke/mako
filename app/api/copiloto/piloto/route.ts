// =============================================================================
// /api/copiloto/piloto — lo que el negocio configura y dispara del piloto fuera del Media Buyer (13/11/2026)
// =============================================================================
// POST {op:'reel', numero}               → con cuántas vistas se publica un reel de prueba (lib/copiloto/piloto.ts).
// POST {op:'retargeting', publicosMeta}  → prende o apaga los dos públicos de Meta del retargeting (lib/retargeting.ts).
// POST {op:'pasar-chats', funnelId?}     → crea los leads de las charlas sin lead, con el alta de /chats (lib/retargeting.ts).
// Las dos del retargeting ESCRIBEN y las dispara SIEMPRE un botón de quien administra (lo pidió su chat, «MaKo en la app»): nunca
// una carga de la página ni un cron. La puerta es la del Media Buyer (`wsDeAdsManager`): el admin del negocio o el super admin.
// =============================================================================

import type { NextRequest } from 'next/server';
import { wsDeAdsManager } from '@/lib/ads-guard';
import { guardarNumeroReel, numeroDelReel, numeroDeReelOk } from '@/lib/copiloto/piloto';
import { configurarRetargeting, pasarChatsAlCrm } from '@/lib/retargeting';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const J = (x: unknown, status = 200) => Response.json(x, { status });

export async function POST(req: NextRequest) {
  const ws = await wsDeAdsManager();
  if (ws instanceof Response) return ws;
  let body: Record<string, unknown>;
  try { body = (await req.json()) as Record<string, unknown>; } catch { return J({ ok: false, error: 'Pedido inválido.' }, 400); }
  try {
    switch (body.op) {
      case 'reel': {
        const n = numeroDeReelOk(body.numero);
        if (n == null) return J({ ok: false, error: 'El número tiene que ser de 50 vistas para arriba.' }, 400);
        await guardarNumeroReel(ws, n);
        return J({ ok: true, reel: await numeroDelReel(ws) });
      }
      case 'retargeting': {
        if (typeof body.publicosMeta !== 'boolean') return J({ ok: false, error: 'Falta si los prendo o los apago.' }, 400);
        return J({ ok: true, retargeting: await configurarRetargeting(ws, body.publicosMeta) });
      }
      case 'pasar-chats': {
        const funnelId = typeof body.funnelId === 'number' && Number.isSafeInteger(body.funnelId) && body.funnelId > 0 ? body.funnelId : null;
        const r = await pasarChatsAlCrm(ws, funnelId);
        return J(r.error ? { ok: false, ...r } : { ok: true, ...r }, r.error ? 409 : 200);
      }
      default:
        return J({ ok: false, error: `No conozco «${String(body.op)}».` }, 400);
    }
  } catch (e) {
    return J({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
}

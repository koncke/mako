// =============================================================================
// /api/ads-analyst/avatares — vocabulario de avatares (CRUD = lista completa)
// =============================================================================
// GET  → { ok, avatares }          lista vigente (vacía si el cliente no definió).
// POST → body { avatares: Avatar[] }  reemplaza la lista entera. Puede quedar vacía.
// Mismo data (app_settings 'script_avatares') que edita el onboarding del cliente.
// =============================================================================

import type { NextRequest } from 'next/server';
import { getAvatares, setAvatares } from '@/lib/script-avatares';
import { soloAdminAdsAnalyst } from '../puerta';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cerrada = await soloAdminAdsAnalyst();
  if (cerrada) return cerrada;
  try {
    const avatares = await getAvatares();
    return Response.json({ ok: true, avatares });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const cerrada = await soloAdminAdsAnalyst();
  if (cerrada) return cerrada;
  let body: { avatares?: unknown };
  try { body = await req.json(); } catch { return Response.json({ ok: false, error: 'body inválido' }, { status: 400 }); }

  try {
    const avatares = await setAvatares(body.avatares);
    console.log(`[ads-analyst:avatares] guardados ${avatares.length} avatares`);
    return Response.json({ ok: true, avatares });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

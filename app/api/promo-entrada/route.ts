// =============================================================================
// POST /api/promo-entrada — el reloj del 50% de la landing de venta
// =============================================================================
// Pública: la abre quien todavía no tiene cuenta. No lee la sesión ni escribe en la base; sólo arranca o lee su reloj (lib/promo-entrada.ts).
// Mira el Origin: otro sitio no puede arrancarle el reloj a nadie.

import type { NextRequest } from 'next/server';
import { abrirPromo, entornoPromo } from '@/lib/promo-entrada';
import { COOKIE_PROMO, COOKIE_PROMO_DIAS } from '@/lib/promo-entrada-reglas';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const origen = req.headers.get('origin');
  let propio = false;
  try { propio = !!origen && new URL(origen).host === req.headers.get('host'); } catch { /* un Origin mal formado no es propio */ }
  if (!propio) return Response.json({ hay: false }, { status: 403, headers: { 'cache-control': 'no-store' } });

  const { estado, cookieNueva } = abrirPromo(req.cookies.get(COOKIE_PROMO)?.value, Date.now(), entornoPromo());
  const r = Response.json(estado, { headers: { 'cache-control': 'no-store' } });
  if (cookieNueva) {
    r.headers.append('set-cookie', `${COOKIE_PROMO}=${cookieNueva}; Path=/; Max-Age=${COOKIE_PROMO_DIAS * 86_400}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  }
  return r;
}

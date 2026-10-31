// =============================================================================
// POST /api/oferta-entrada — el reloj del 50% de la landing de venta
// =============================================================================
// Pública: la abre quien todavía no tiene cuenta. No lee la sesión ni escribe en la base; sólo arranca o lee su reloj (lib/oferta-entrada.ts).
// Mira el Origin: otro sitio no puede arrancarle el reloj a nadie.

import type { NextRequest } from 'next/server';
import { abrirOferta, entornoOferta } from '@/lib/oferta-entrada';
import { COOKIE_OFERTA, COOKIE_OFERTA_DIAS } from '@/lib/oferta-entrada-reglas';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const origen = req.headers.get('origin');
  let propio = false;
  try { propio = !!origen && new URL(origen).host === req.headers.get('host'); } catch { /* un Origin mal formado no es propio */ }
  if (!propio) return Response.json({ activa: false }, { status: 403, headers: { 'cache-control': 'no-store' } });

  const { estado, cookieNueva } = abrirOferta(req.cookies.get(COOKIE_OFERTA)?.value, Date.now(), entornoOferta());
  const r = Response.json(estado, { headers: { 'cache-control': 'no-store' } });
  if (cookieNueva) {
    r.headers.append('set-cookie', `${COOKIE_OFERTA}=${cookieNueva}; Path=/; Max-Age=${COOKIE_OFERTA_DIAS * 86_400}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
  }
  return r;
}

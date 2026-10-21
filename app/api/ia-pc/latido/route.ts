// =============================================================================
// POST /api/ia-pc/latido — la PC del cliente avisa que está prendida, con sus cuentas (docs/ia-del-cliente.md §3)
// =============================================================================
// Con el token de la PC (`mkopc_`). Sin latido en 90 s, la PC está «Sin conexión» (lib/ia-pc-reglas.ts → `enLinea`).
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { dispositivoDelToken, latir } from '@/lib/ia-pc';
import { bearer } from '@/lib/ia-pc-reglas';
import { limitePorClave } from '@/lib/limite-publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: NextRequest) {
  const d = await dispositivoDelToken(bearer(req.headers.get('authorization'))).catch(() => null);
  if (!d) return NextResponse.json({ ok: false, error: 'token inválido o desconectado' }, { status: 401 });
  // Late cada 30 s: 10 por minuto alcanzan con margen.
  const frenado = limitePorClave('ia-pc-latido', d.id, 10, 60_000);
  if (frenado) return frenado;
  let body: unknown = {};
  try { body = await req.json(); } catch { /* un latido sin cuerpo también vale */ }
  await latir(d, body);
  return NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
}

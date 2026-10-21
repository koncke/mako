// =============================================================================
// POST /api/ia-pc/emparejar — la PC del cliente canjea su código de 6 letras por su token (docs/ia-del-cliente.md §3)
// =============================================================================
// PÚBLICA (lib/rutas-publicas.ts): la PC todavía no tiene sesión ni token. Lo que la protege es el código: lo pidió una
// persona con sesión en su negocio (/api/ia-pc/codigo), dura 10 minutos, se gasta al usarlo y sólo se guarda su hash.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { emparejar } from '@/lib/ia-pc';
import { limitePorIp } from '@/lib/limite-publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (cuerpo: Record<string, unknown>, status = 200) => NextResponse.json(cuerpo, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: NextRequest) {
  // Contra adivinar códigos: 10 intentos por IP cada 10 minutos (el código son 6 letras de 32 y vence en 10 minutos).
  const frenado = limitePorIp(req, 'ia-pc-emparejar', 10, 10 * 60_000);
  if (frenado) return frenado;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Pedido inválido.' }, 400); }
  const r = await emparejar(body?.codigo, body?.nombre).catch((e) => {
    console.error('[ia-pc/emparejar]', e instanceof Error ? e.message : String(e));
    return null;
  });
  if (!r) return json({ ok: false, error: 'Ese código no vale o ya venció. Pide otro en MaKo.' }, 400);
  return json({ ok: true, token: r.token });
}

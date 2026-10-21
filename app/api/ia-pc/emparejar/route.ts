// =============================================================================
// POST /api/ia-pc/emparejar — la PC del cliente canjea su código de 8 letras por su token (docs/ia-del-cliente.md §3)
// =============================================================================
// PÚBLICA (lib/rutas-publicas.ts): la PC todavía no tiene sesión ni token. Lo que la protege es el código: lo pidió una
// persona con sesión en su negocio (/api/ia-pc/codigo), dura 10 minutos, se gasta al usarlo y sólo se guarda su hash.
// Devuelve también A QUÉ NEGOCIO y COMO QUIÉN: el instalador se lo muestra a la persona y le pregunta si es el suyo.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { emparejar } from '@/lib/ia-pc';
import { limitePorIp } from '@/lib/limite-publico';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const json = (cuerpo: Record<string, unknown>, status = 200) => NextResponse.json(cuerpo, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: NextRequest) {
  // Contra adivinar códigos: 10 intentos por IP cada 10 minutos (8 letras de 32, que vencen en 10 minutos).
  const frenado = limitePorIp(req, 'ia-pc-emparejar', 10, 10 * 60_000);
  if (frenado) return frenado;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Pedido inválido.' }, 400); }
  let r: Awaited<ReturnType<typeof emparejar>>;
  try { r = await emparejar(body?.codigo, body?.nombre); } catch (e) {
    // «No pude leer» no es «ese código no vale». Pero si falló DESPUÉS de gastar el código, la misma línea ya no sirve:
    // un código nuevo anda en los dos casos (tercera revisión, 21/10/2026).
    console.error('[ia-pc/emparejar]', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'MaKo no pudo conectar ahora. En un minuto pide otro código en MaKo y pega la línea nueva.' }, 503);
  }
  if (!r) return json({ ok: false, error: 'Ese código no vale o ya venció. Pide otro en MaKo.' }, 400);
  return json({ ok: true, token: r.token, negocio: r.negocio, persona: r.persona });
}

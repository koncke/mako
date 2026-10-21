// =============================================================================
// GET /api/ia-pc/turno — la PC del cliente pide su próximo turno (long-poll, docs/ia-del-cliente.md §4)
// =============================================================================
// Con el token de la PC. Sólo los turnos de SU negocio y SU persona (los encola turnoApp para la PC de quien escribió).
// Al tomarlo se acuña el token de las herramientas de ese turno, que recibe sólo esta PC. 204 = no hay ninguno.
// =============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { dispositivoDelToken, tomarTurno } from '@/lib/ia-pc';
import { bearer } from '@/lib/ia-pc-reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const d = await dispositivoDelToken(bearer(req.headers.get('authorization'))).catch(() => null);
  if (!d) return NextResponse.json({ ok: false, error: 'token inválido o desconectado' }, { status: 401 });
  const t = await tomarTurno(d).catch((e) => {
    console.error(`[ia-pc/turno] ws=${d.ws} pc=${d.id}:`, e instanceof Error ? e.message : String(e));
    return null;
  });
  if (!t) return new NextResponse(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  return NextResponse.json({ ok: true, id: t.id, system: t.pedido.system, prompt: t.pedido.prompt, token: t.token }, { headers: { 'cache-control': 'no-store' } });
}

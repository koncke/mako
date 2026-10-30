// =============================================================================
// Cron: el VIGÍA DEL DÍA del Media Buyer, cada dos horas — vercel.json: `45 */2 * * *`
// =============================================================================
// La corrida (cron/media-buyer, 14:30 UTC) decide con el día de ayer cerrado. Esto mira HOY: pausa lo que pasó su fecha de fin
// y lo que se está quemando sin resultados (lib/media-buyer/vigia.ts). Por cada negocio con el Media Buyer prendido; los demás
// salen en el acto («apagado»). Una cuenta compartida por dos negocios se mira una vez.
//
// La plataforma (el negocio de MaKo, `wsSuperAdmin`) se corre aparte si no la vio la ronda, como en la corrida.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrRonda } from '@/lib/cron-workspaces';
import { wsSuperAdmin } from '@/lib/workspace';
import { vigilarCuenta } from '@/lib/media-buyer/vigia';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const TECHO_MS = maxDuration * 1000;
/** Lo que necesita UN negocio: leer la cuenta (dos lecturas de Zernio), el día de hoy y, a veces, una pausa. */
const MINIMO_UTIL_MS = 30_000;

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
  if (authFail) return authFail;
  const cuentasVistas = new Set<string>();
  const ronda = await correrRonda(['meta', 'zernio'], (ws) => vigilarCuenta(ws, { cuentasVistas }),
    { techoMs: TECHO_MS - 40_000, minimoMs: MINIMO_UTIL_MS, rotacion: 'media-buyer-vigia' });
  const plataforma = await wsSuperAdmin().catch(() => null);
  let deLaPlataforma: unknown = null;
  if (plataforma != null && !ronda.conectados.includes(plataforma)) deLaPlataforma = await vigilarCuenta(plataforma, { cuentasVistas });
  return Response.json({ ok: true, ms: ronda.ms, resultados: ronda.resultados, sinTurno: ronda.sinTurno, plataforma: deLaPlataforma });
}

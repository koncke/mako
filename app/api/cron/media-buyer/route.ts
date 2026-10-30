// =============================================================================
// Cron: el Media Buyer mira cada cuenta una vez por día — vercel.json: `30 14 * * *`
// =============================================================================
// Corre después de la ingesta de Meta (meta-daily, 13:00 UTC) y de las transcripciones (14:00), así decide con el día
// de ayer cerrado y con lo que se dice en los videos. Por cada negocio con Meta o con su Zernio: lee la cuenta, guarda
// las decisiones del día y, SÓLO si ese negocio eligió el piloto automático, las lanza (lib/media-buyer/corrida.ts).
//
// La plataforma (el negocio de MaKo, `wsSuperAdmin`) se corre aparte si conectó su Zernio: su clave es la de la
// plataforma, que no es una fila de credenciales, y la ronda no la ve. Ahí se prueba todo antes que en un cliente.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrRonda } from '@/lib/cron-workspaces';
import { wsSuperAdmin } from '@/lib/workspace';
import { analizarCuenta } from '@/lib/media-buyer/corrida';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
const TECHO_MS = maxDuration * 1000;
/** Lo que necesita UN negocio para valer el turno: leer la cuenta, la IA de las variaciones y lanzar. */
const MINIMO_UTIL_MS = 60_000;

export async function GET(request: NextRequest) {
  const authFail = checkCronAuth(request);
  if (authFail) return authFail;
  const cuentasVistas = new Set<string>();
  const ronda = await correrRonda(['meta', 'zernio'], (ws) => analizarCuenta(ws, { quien: 'cron', cuentasVistas }),
    { techoMs: TECHO_MS - 70_000, minimoMs: MINIMO_UTIL_MS, rotacion: 'media-buyer' });
  const plataforma = await wsSuperAdmin().catch(() => null);
  let deLaPlataforma: unknown = null;
  if (plataforma != null && !ronda.conectados.includes(plataforma)) deLaPlataforma = await analizarCuenta(plataforma, { quien: 'cron', cuentasVistas });
  return Response.json({ ok: true, ms: ronda.ms, resultados: ronda.resultados, sinTurno: ronda.sinTurno, plataforma: deLaPlataforma });
}

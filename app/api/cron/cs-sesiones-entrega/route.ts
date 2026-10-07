// =============================================================================
// GET /api/cron/cs-sesiones-entrega — analiza las sesiones de entrega (#107)
// =============================================================================
// HORARIO y de a POCO: dos sesiones por workspace y por corrida
// (`MAX_SESIONES_POR_CORRIDA`). Así el histórico —129 sesiones en el ws1, que el Closing
// Analyst tiró como «descartadas»— se drena en unos días sin comerse en una mañana la cuota
// gratis de Gemini del día, que comparten la lectura de reuniones y MaKo por WhatsApp. Lo
// nuevo entra solo: la cola se calcula (lib/closing-entrega.ts), no se escribe.
//
// Va APARTE de /api/cron/closing-sync a propósito: aquel corta el workspace entero si no
// tiene key de Anthropic (`sin_ia`), y este análisis no usa Claude. Colgado de ahí, un
// cliente sin key paga no tendría nunca sus sesiones analizadas.
//
// Es una RONDA con presupuesto de tiempo (`correrRonda`, la versión de `correrPorWorkspace`
// que reparte el maxDuration): arranca donde terminó la anterior y declara a quién no le
// tocó, así un workspace con la cola larga no deja sin turno al resto.
//
// Nada de esto le escribe a un cliente: lee Fathom, llama a la IA gratis y escribe filas.
// Auth por CRON_SECRET (lib/cron-auth, el mismo check de todos los crons).
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrRonda } from '@/lib/cron-workspaces';
import {
  drenarSesionesEntrega,
  MAX_SESIONES_POR_CORRIDA,
  RESERVA_SESION_MS,
  type DrenajeEntrega,
} from '@/lib/closing-entrega';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** El techo de la ronda ES el maxDuration, derivado de la misma constante (ver closing-sync). */
const TECHO_MS = maxDuration * 1000;
/** Leer la cola (~3 s) más UNA sesión entera. Con menos, darle el turno no analiza nada. */
const MINIMO_UTIL_MS = 5_000 + RESERVA_SESION_MS;

export async function GET(request: NextRequest) {
  const denied = checkCronAuth(request);
  if (denied) return denied;

  const ronda = await correrRonda('fathom', async (ws, deadline) => {
    const r = await drenarSesionesEntrega({ deadline, max: MAX_SESIONES_POR_CORRIDA });
    console.log(
      `[cron:cs-sesiones-entrega] ws=${ws} pendientes=${r.pendientes} analizadas=${r.analizadas} ` +
      `fallidas=${r.fallidas} sin_reintento=${r.sinReintento} atadas=${r.atadas} sin_turno=${r.sinTurno} ` +
      `corto_por=${r.corto_por}${r.motivo ? ` (${r.motivo})` : ''}` +
      // El paso 5 del curso (#665): las propuestas que se armaron con lo hablado (lib/curso-propuesta-ia.ts).
      ` propuestas=${r.propuestas?.propuestas ?? 0} miradas=${r.propuestas?.miradas ?? 0}` +
      `${r.propuestas?.error ? ` propuestas_error=${r.propuestas.error}` : ''}`,
    );
    return r;
  }, { techoMs: TECHO_MS, minimoMs: MINIMO_UTIL_MS, rotacion: 'cs-sesiones-entrega' });

  const de = (x: { resultado?: unknown }) => x.resultado as DrenajeEntrega | undefined;
  const corridos = ronda.resultados.filter((x) => x.ok);
  const sumar = (k: 'analizadas' | 'pendientes' | 'fallidas' | 'sinReintento' | 'atadas') =>
    corridos.reduce((a, x) => a + (de(x)?.[k] ?? 0), 0);
  const sinIA = corridos.filter((x) => de(x)?.corto_por === 'sin_ia').map((x) => x.ws);
  const fallidos = ronda.resultados.filter((x) => !x.ok).length;

  // Tres estados, como closing-sync: corrió · sin turno (diferido, no es un error) · falló.
  // El 500 es «no corrió NADIE habiendo conectados», que es el cron roto de verdad.
  const ok = ronda.conectados.length === 0 || ronda.resultados.length > 0;

  console.log(
    `[cron:cs-sesiones-entrega] conectados=${ronda.conectados.length} corridos=${corridos.length} ` +
    `sin_turno=${ronda.sinTurno.length} sin_ia=${sinIA.length} fallidos=${fallidos} ` +
    `analizadas=${sumar('analizadas')} pendientes=${sumar('pendientes')} ms=${ronda.ms}`,
  );

  return Response.json({
    ok,
    resumen: {
      conectados: ronda.conectados.length,
      corridos: corridos.length,
      sin_turno: ronda.sinTurno.length,
      sin_ia: sinIA.length,
      fallidos,
      analizadas: sumar('analizadas'),
      pendientes: sumar('pendientes'),
      fallidas: sumar('fallidas'),
      sin_reintento: sumar('sinReintento'),
      atadas: sumar('atadas'),
    },
    orden: ronda.orden,
    sin_turno: ronda.sinTurno,
    sin_ia: sinIA,
    workspaces: ronda.resultados,
    ms: ronda.ms,
  }, { status: ok ? 200 : 500 });
}

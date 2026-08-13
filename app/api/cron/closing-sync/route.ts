// =============================================================================
// GET /api/cron/closing-sync — drena el análisis de cierres en background
// =============================================================================
// Cada corrida es una RONDA: reparte UNA fecha límite entre los workspaces con
// Fathom conectado, arranca donde terminó la anterior (cursor de rotación) y
// DECLARA a quién no le tocó.
//
// ⚠️ LO QUE ESTO ARREGLA. Antes recorría la lista siempre en el mismo orden con
// 150 s reservados POR workspace sobre un maxDuration de 300: entraban DOS y del
// tercero en adelante nadie recibía análisis nunca. Y como la respuesta listaba
// solo a los que corrieron, no había nada que mirar ni nada que contar — con 10
// clientes la factura no subía y 8 se quedaban sin servicio, en silencio.
//
// Auth por CRON_SECRET (lib/cron-auth: el mismo check para todos los crons).
// =============================================================================

import type { NextRequest } from 'next/server';
import { syncClosingCalls, RESERVA_LLAMADA_MS, type SyncResult } from '@/lib/closing';
import { adjuntarFathomAutoThrottled } from '@/lib/fathom-auto';
import { correrRonda } from '@/lib/cron-workspaces';
import { checkCronAuth } from '@/lib/cron-auth';
import { credWs } from '@/lib/credenciales';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;
/**
 * El techo de la ronda ES el maxDuration, derivado de la misma constante y pegado
 * a ella. Escrito dos veces, el día que uno baje a 60 el otro cree que hay 300,
 * arranca una llamada a los 150 y la plataforma la mata: el bug original, servido
 * por el arreglo.
 */
const TECHO_MS = maxDuration * 1000;
/**
 * Lo mínimo que hace útil darle el turno a un workspace: el barrido de metadata de
 * Fathom más los leads (~25 s) + UNA llamada a Opus entera. Con menos, se paga el
 * barrido para no analizar ni una.
 */
const MINIMO_UTIL_MS = 25_000 + RESERVA_LLAMADA_MS;

export async function GET(request: NextRequest) {
  const denied = checkCronAuth(request);
  if (denied) return denied;

  const ronda = await correrRonda('fathom', async (ws, deadline) => {
    // EN POSITIVO: se analiza SI este cliente tiene con qué. El análisis corre con la
    // key del PROPIO workspace (lib/anthropic.ts → credWs) y sin fila propia credWs
    // devuelve null: el env es solo del dueño. Sin este guard, cada llamada tira
    // «ANTHROPIC_API_KEY no configurada», la fila queda en status='error' —que es
    // REINTENTABLE— y el cron la vuelve a levantar en cada corrida para volver a
    // fallar, para siempre. Nadie lo vio nunca porque hasta ahora el cron servía
    // siempre a los mismos dos workspaces, y los dos tienen key.
    if (!(await credWs('ANTHROPIC_API_KEY', ws))) {
      console.warn(`[cron:closing-sync] ws=${ws} SIN key de Anthropic — no se analiza (falta cargarla en /integraciones)`);
      return { sin_ia: true } as const;
    }
    // PRIMERO lo barato, y en su versión con throttle: la llamada de antes hacía un
    // barrido ENTERO de Fathom por corrida, encima del que ya hace syncClosingCalls.
    // Va ANTES para que lo que consuma se lo descuente a sí mismo, no a la última
    // llamada a Claude.
    await adjuntarFathomAutoThrottled().catch((e) =>
      console.error(`[cron:closing-sync] fathom-auto: ${e instanceof Error ? e.message : String(e)}`));
    const res = await syncClosingCalls({ deadline });
    console.log(
      `[cron:closing-sync] ws=${ws} fathom=${res.total_fathom} ya=${res.ya_procesadas} cand=${res.candidatas} ` +
      `analizadas=${res.analizadas} ventas=${res.ventas} servicio=${res.servicio} otras=${res.otras} ` +
      `err=${res.errores} restantes=${res.restantes} corto_por=${res.corto_por} ms=${res.ms}`,
    );
    return res;
  }, { techoMs: TECHO_MS, minimoMs: MINIMO_UTIL_MS, rotacion: 'closing-sync' });

  const sync = (x: { resultado?: unknown }) => x.resultado as SyncResult | undefined;
  const sinIA = ronda.resultados
    .filter((x) => (x.resultado as { sin_ia?: boolean } | undefined)?.sin_ia)
    .map((x) => x.ws);
  const corridos = ronda.resultados.filter((x) => x.ok && !sinIA.includes(x.ws));
  const analizadas = corridos.reduce((a, x) => a + (sync(x)?.analizadas ?? 0), 0);
  const pendientes = corridos.reduce((a, x) => a + (sync(x)?.restantes ?? 0), 0);
  const fallidos = ronda.resultados.filter((x) => !x.ok).length;

  // TRES estados, no dos: corrió · SIN TURNO (diferido a la próxima ronda, que NO es
  // un error sino cómo funciona la rotación) · falló. El 500 se reserva para «no
  // corrió NADIE habiendo conectados», que es el cron roto de verdad. Si «sin turno»
  // contara como error, esto viviría en 500 desde el tercer cliente y la alarma
  // nacería sonando — que es justo la señal que este arreglo viene a recuperar.
  const ok = ronda.conectados.length === 0 || ronda.resultados.length > 0;

  console.log(
    `[cron:closing-sync] conectados=${ronda.conectados.length} corridos=${corridos.length} ` +
    `sin_turno=${ronda.sinTurno.length} sin_ia=${sinIA.length} fallidos=${fallidos} ` +
    `analizadas=${analizadas} pendientes=${pendientes} ms=${ronda.ms}`,
  );

  return Response.json({
    ok,
    resumen: {
      conectados: ronda.conectados.length,
      corridos: corridos.length,
      sin_turno: ronda.sinTurno.length,
      sin_ia: sinIA.length,
      fallidos,
      analizadas,
      pendientes,
    },
    orden: ronda.orden,
    sin_turno: ronda.sinTurno,
    sin_ia: sinIA,
    workspaces: ronda.resultados,
    ms: ronda.ms,
  }, { status: ok ? 200 : 500 });
}

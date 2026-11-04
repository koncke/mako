// =============================================================================
// Cron: las traídas largas de Competitors Spy avanzan solas, sin que nadie abra la ficha (cada hora)
// =============================================================================
// Medido en producción el 4/11/2026 (el Cerebro): Den Borg en el ws 9 llegó a 255 publicaciones con la traída larga, y
// otro competidor quedó en 12 — la traída avanzaba SÓLO cuando alguien abría su ficha o lo revisaba (la pantalla pregunta
// cada 20 s y para a los 15 minutos). Martín, 4/11: «se revisa una vez, sola y listo. Lo nuevo entra en segundo plano».
//
// Cada hora, por negocio con la clave de Spy conectada (`apify-instagram`): un paso de `avanzarTodo` por competidor —
// recoge la corrida que terminó, o empieza la que toca (la primera, o lo nuevo una vez por semana). Los topes de siempre
// siguen: 6 corridas largas por negocio y por día (`CORRIDAS_LARGAS_POR_DIA`, contadas en la base: `spy.todo.dia`), con su
// techo en dólares cada una.
//
// ⚠️ LO PAGA CADA NEGOCIO con su clave de Spy, como cuando abre la ficha: el cron no pide nada que la ficha no pediría.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { correrRonda } from '@/lib/cron-workspaces';
import { avanzarTodo } from '@/lib/spy-todo';
import { getTenantDb } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const TECHO_MS = maxDuration * 1000;
/** Un paso de un competidor: preguntar a Apify y, si terminó, guardar cientos de piezas (con sus miniaturas). */
const UN_PASO_MS = 45_000;

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const ronda = await correrRonda('apify-instagram', async (ws, deadline) => {
    const db = await getTenantDb();
    const { data, error } = await db.from('spy_competidores').select('id').order('id');
    if (error) throw new Error(`no pude leer los competidores: ${error.message}`);
    let pasos = 0;
    let enMarcha = 0;
    let nuevas = 0;
    const porques: string[] = [];
    for (const c of (data ?? []) as Array<{ id: number }>) {
      if (Date.now() + UN_PASO_MS > deadline) break;
      const r = await avanzarTodo(ws, c.id);
      pasos += 1;
      if (r.enMarcha) enMarcha += 1;
      nuevas += r.nuevas;
      if (r.porque) porques.push(`${c.id}:${r.porque}`);
    }
    console.log(`[cron:spy-todo] ws=${ws} pasos=${pasos} en_marcha=${enMarcha} nuevas=${nuevas}${porques.length ? ` porque=${porques.join('|')}` : ''}`);
    return { pasos, enMarcha, nuevas };
  }, { techoMs: TECHO_MS, minimoMs: UN_PASO_MS, rotacion: 'spy-todo' });

  const ok = ronda.conectados.length === 0 || ronda.resultados.length > 0;
  return Response.json({ ok, conectados: ronda.conectados.length, corridos: ronda.resultados.length, sinTurno: ronda.sinTurno.length, ms: ronda.ms }, { status: ok ? 200 : 500 });
}

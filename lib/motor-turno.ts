// =============================================================================
// motor-turno — UNA corrida del motor de nutrición por negocio a la vez
// =============================================================================
// El porqué entero está en lib/motor-tick.ts. Acá se lee y se escribe la fila.
//
// ⚠️ LO TOMAN LAS DOS RUTAS DEL CRON (la de cada hora y el tick), no la vía rápida de un evento: la
// vía rápida mira UN lead, corre adentro de un webhook que tiene que contestar ya y no puede esperar
// a que se libere un turno. Lo que ella y una corrida del cron puedan pisarse es lo de antes de la
// sexta tanda, sin cambios.
//
// ⚠️ «NO PUDE LEER» CUENTA COMO «TOMADO»: sin saber si otra corrida está mandando, no se manda (la
// fila sigue vencida para el minuto siguiente). Y soltar es best-effort: si falla, el turno vence
// solo en `TURNO_MS`.

import 'server-only';
import { getSettingEstricto, cambiarSettingSi } from './settings';
import { runWithWorkspace } from './workspace';
import { KEY_TURNO_MOTOR, turnoTomado, valorDeTurno } from './motor-tick';

/**
 * Corre `fn` con el turno del motor de `ws` tomado. `{ corrio: false }` = otra corrida lo tiene (o
 * no se pudo leer): no se corrió nada.
 *
 * `esperarMs`: cuánto puede esperar a que se libere. El tick no espera (lo que venció lo toma él
 * mismo al minuto siguiente); la corrida de cada hora sí, un rato: es la única que barre lo viejo, y
 * saltearla porque un tick seguía mandando a las :00 dejaría esa cola una hora más.
 */
export async function conTurnoDelMotor<T>(ws: number, fn: () => Promise<T>, opts?: { esperarMs?: number }): Promise<{ corrio: true; resultado: T } | { corrio: false; porque: 'ocupado' | 'ilegible' }> {
  const limite = Date.now() + Math.max(0, opts?.esperarMs ?? 0);
  let tomado = await tomarTurno(ws);
  while (!tomado.ok && tomado.porque === 'ocupado' && Date.now() + 5_000 <= limite) {
    await new Promise<void>((listo) => setTimeout(listo, 5_000));
    tomado = await tomarTurno(ws);
  }
  if (!tomado.ok) return { corrio: false, porque: tomado.porque };
  try {
    return { corrio: true, resultado: await fn() };
  } finally {
    // Se suelta escribiendo AHORA (un instante ya pasado para la próxima lectura), sólo si sigue
    // siendo el nuestro.
    const mio = tomado.mio;
    await runWithWorkspace(ws, () => cambiarSettingSi(KEY_TURNO_MOTOR, mio, new Date().toISOString())).catch(() => false);
  }
}

async function tomarTurno(ws: number): Promise<{ ok: true; mio: string } | { ok: false; porque: 'ocupado' | 'ilegible' }> {
  return runWithWorkspace(ws, async () => {
    let previo: string | null;
    try { previo = await getSettingEstricto(KEY_TURNO_MOTOR); } catch { return { ok: false as const, porque: 'ilegible' as const } }
    if (turnoTomado(previo, Date.now())) return { ok: false as const, porque: 'ocupado' as const };
    const mio = valorDeTurno(Date.now());
    // El compare-and-set va contra el valor EXACTO que se acaba de leer: si otra corrida lo cambió
    // en el medio, ésta pierde. `previo === null` usa la rama de insertar-si-no-existe, también atómica.
    const gane = await cambiarSettingSi(KEY_TURNO_MOTOR, previo, mio).catch(() => false);
    return gane ? { ok: true as const, mio } : { ok: false as const, porque: 'ocupado' as const };
  });
}

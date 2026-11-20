// =============================================================================
// EL CONTEXTO DEL CHAT «RETO DE 7 DÍAS» (20/11/2026, auditoría D1-09 y R57-13)
// =============================================================================
// La caja del chat del reto le escribe al MaKo del Ops Center (decisión del Cerebro), con lo que hace falta para ayudar en ESE día:
// en qué día va, lo que ya hizo, lo que le falta y lo que dejó para después, lo que eligió resolver primero en el onboarding y su
// funnel. Lo arma `contextoDelRetoDe` (puro: lo prueba tests/reto-dias.test.ts); `contextoDelReto` lo lee del negocio. Sin poder
// leer, un contexto corto que lo dice (nunca un error en el turno).
// =============================================================================
import { claveTarea, diaAbierto, diasDelReto, leerEstado, muestrasDe, tareaDespues, tareaHecha, CLAVE_RETO, type EstadoReto } from './dias';

const REGLAS = [
  '## EL CHAT «RETO DE 7 DÍAS»',
  'Esta conversación es la del reto de 7 días de la persona (el chat «Reto de 7 días» del Ops Center). Ayúdala con su día: qué hacer, dónde se hace en MaKo y por qué importa.',
  'Respuestas cortas, en español neutro con «tú». No prometas nada que MaKo no haga, ni un equipo de personas: lo hace ella, con MaKo.',
  'Para algo que se hace en una pestaña, dile dónde está; las tareas del reto se marcan solas cuando MaKo lee que se hicieron.',
].join('\n');

/** El contexto, con el estado del reto ya leído. */
export function contextoDelRetoDe(e: EstadoReto | null, o: { funnel?: string | null; intereses?: readonly string[] | null; ahora?: number }): string {
  if (!e) return `${REGLAS}\n\nTodavía no empezó su reto: se empieza al abrir este chat.`;
  const n = diaAbierto(e, o.ahora ?? Date.now());
  const dia = diasDelReto(o.funnel).find((d) => d.n === n)!;
  const hechas = dia.tareas.filter((t) => tareaHecha(e, n, t.id));
  const despues = dia.tareas.filter((t) => !tareaHecha(e, n, t.id) && tareaDespues(e, n, t.id));
  const faltan = dia.tareas.filter((t) => !tareaHecha(e, n, t.id) && !tareaDespues(e, n, t.id));
  const lista = (ts: typeof dia.tareas) => ts.map((t) => `${t.titulo} (${t.donde.replace(/^En /, 'en ')})`).join('; ');
  const lineas = [
    `- Va en el día ${n} de 7: «${dia.titulo}».`,
    hechas.length ? `- Ya hizo hoy: ${hechas.map((t) => e.leidas?.[claveTarea(n, t.id)] ?? t.titulo).join(' ')}` : null,
    faltan.length ? `- Le falta hoy: ${lista(faltan)}.` : `- Ya terminó lo del día ${n}.`,
    despues.length ? `- Dejó para después: ${lista(despues)}.` : null,
    muestrasDe(o.intereses).length ? `- Lo que eligió resolver primero en el onboarding: ${muestrasDe(o.intereses).map((m) => m.hacer).join(', ')}.` : null,
    o.funnel ? `- Su funnel (lo eligió en Funnel Coach): ${o.funnel}.` : null,
  ].filter(Boolean);
  return `${REGLAS}\n\n${lineas.join('\n')}`;
}

/** Lo lee del negocio (\`reto.estado\`, el plan de Funnel Coach y lo elegido en el onboarding). */
export async function contextoDelReto(ws: number): Promise<string> {
  try {
    const [{ getSetting }, { runWithWorkspace }] = await Promise.all([import('../settings'), import('../workspace')]);
    return await runWithWorkspace(ws, async () => {
      const [crudo, plan, arranque] = await Promise.all([getSetting(CLAVE_RETO), getSetting('funnel_coach.plan'), getSetting('onboarding.arranque')]);
      const leer = (s: string | null) => { try { return JSON.parse(s ?? 'null') as Record<string, unknown> | null; } catch { return null; } };
      const p = leer(plan), a = leer(arranque);
      return contextoDelRetoDe(leerEstado(crudo), {
        funnel: typeof p?.funnel === 'string' ? p.funnel : null,
        intereses: Array.isArray(a?.intereses) ? (a.intereses as unknown[]).filter((x): x is string => typeof x === 'string') : [],
      });
    });
  } catch {
    return `${REGLAS}\n\n(No se pudo leer en qué va su reto: pregúntale en qué día está.)`;
  }
}

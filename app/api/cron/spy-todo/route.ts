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
import { mirarCompetidor } from '@/lib/spy';
import { getSetting, setSetting } from '@/lib/settings';
import { CLAVE_SEGUIDOS, CLAVE_YOUTUBE_SEGUIDOS, idsSeguidos, leerLecturasYoutube, leerRegistroSeguidos, tocaYoutube } from '@/lib/spy-seguidos-reglas';
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
    const { data, error } = await db.from('spy_competidores').select('id, youtube_id').order('id');
    if (error) throw new Error(`no pude leer los competidores: ${error.message}`);
    let pasos = 0;
    let enMarcha = 0;
    let nuevas = 0;
    const porques: string[] = [];
    // ⚠️⚠️ EL ARRANQUE ROTA, O LA COLA NO SE LEE NUNCA (8/11/2026).
    // Esto recorría con `.order('id')` —siempre del más viejo al más nuevo— y corta por plazo. Los
    // últimos de la lista no se leían TARDE: no se leían. Medido en el ws 9: los 6 competidores
    // viejos tenían entre 134 y 772 piezas y los 17 dados de alta después estaban los 17 en CERO,
    // veinte horas y unas veinte corridas más tarde. No fallaban — no les llegaba el turno, y con
    // orden fijo no les iba a llegar nunca mientras los de adelante siguieran dando trabajo.
    // Lo reportó Martín viendo las fichas vacías en la pantalla.
    //
    // La rotación va por HORA del día, no por un cursor guardado: el cron corre una vez por hora
    // (`23 * * * *`), así que en un día cada competidor arranca primero al menos una vez, y no hay
    // estado nuevo que se pueda desincronizar. Es la misma idea que `rotacion: 'spy-todo'` ya usa
    // para repartir entre WORKSPACES, aplicada adentro de uno.
    const lista = (data ?? []) as Array<{ id: number; youtube_id: string | null }>;
    // Los SEGUIDOS (13/11/2026): su YouTube se relee cada día, para que sus alertas tengan lo nuevo (lib/spy-seguidos-reglas.ts).
    // Es de la cuota de YouTube del negocio, no de Apify. Cuándo se leyó cada uno, en `spy.seguidos.youtube` (lo escribe sólo esto).
    const seguidos = new Set(idsSeguidos(leerRegistroSeguidos(await getSetting(CLAVE_SEGUIDOS).catch(() => null))));
    const youtube = leerLecturasYoutube(await getSetting(CLAVE_YOUTUBE_SEGUIDOS).catch(() => null));
    let youtubeLeidos = 0;
    const desde = lista.length ? new Date().getUTCHours() % lista.length : 0;
    const enOrden = [...lista.slice(desde), ...lista.slice(0, desde)];
    for (const c of enOrden) {
      if (Date.now() + UN_PASO_MS > deadline) break;
      const r = await avanzarTodo(ws, c.id);
      pasos += 1;
      if (r.enMarcha) enMarcha += 1;
      nuevas += r.nuevas;
      if (r.porque) porques.push(`${c.id}:${r.porque}`);
      if (seguidos.has(c.id) && c.youtube_id && tocaYoutube(youtube[String(c.id)], Date.now()) && Date.now() + UN_PASO_MS < deadline) {
        const y = await mirarCompetidor(c.id, 'rutina', undefined, ['youtube']).catch(() => null);
        // Sólo una lectura que anduvo cuenta como leída: «no pude» vuelve a intentar en la próxima vuelta.
        if (y?.canales.some((x) => x.canal === 'youtube' && x.ok)) { youtube[String(c.id)] = new Date().toISOString(); youtubeLeidos += 1; }
      }
    }
    if (youtubeLeidos) await setSetting(CLAVE_YOUTUBE_SEGUIDOS, JSON.stringify(youtube)).catch(() => undefined);
    console.log(`[cron:spy-todo] ws=${ws} pasos=${pasos} en_marcha=${enMarcha} nuevas=${nuevas} youtube_seguidos=${youtubeLeidos}${porques.length ? ` porque=${porques.join('|')}` : ''}`);
    return { pasos, enMarcha, nuevas, youtubeSeguidos: youtubeLeidos };
  }, { techoMs: TECHO_MS, minimoMs: UN_PASO_MS, rotacion: 'spy-todo' });

  const ok = ronda.conectados.length === 0 || ronda.resultados.length > 0;
  return Response.json({ ok, conectados: ronda.conectados.length, corridos: ronda.resultados.length, sinTurno: ronda.sinTurno.length, ms: ronda.ms }, { status: ok ? 200 : 500 });
}

// =============================================================================
// El vigilante de la cola de Flow
// =============================================================================
// Todo lo que miraba `flow_trabajos` colgaba del propio puente: el rescate de
// colgados vive DENTRO de `flow_tomar_trabajos`, que sólo corre cuando la
// extensión pide trabajo. El vigilante y el vigilado eran el mismo, así que
// cuando el navegador del cliente se muere no queda nadie.
//
// Medido en producción el 01/09/2026: un trabajo quedó `pendiente` con
// `intentos = 0` durante HORAS y la pantalla mostrando «Filmando» — porque la
// extensión de la clienta había dejado de latir al actualizarse.
//
// Hay un tope de 4 minutos en `estadoTomaAction`, y sirve mientras la persona
// tenga la pantalla abierta sondeando. Esto es la otra mitad: la que corre
// aunque no haya nadie mirando. Es la regla de la casa —«todo proceso largo
// necesita algo que lo MIRE, no sólo que lo lance»— aplicada a una cola cuyo
// worker es el navegador de otra persona.
//
// ⚠️ CADA 10 MINUTOS Y NO CADA MINUTO. El tope de abandono son 12; un cron más
// rápido no cierra nada antes y multiplica las invocaciones por diez. Lo que
// decide cuándo se entera el cliente NO es este cron —es el sondeo de la
// pantalla, que ya tiene su propio tope de 4 minutos—: esto existe para el caso
// en que NO hay pantalla.

import { type NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { createClient } from '@supabase/supabase-js';
import { emitirDelCatalogo } from '@/lib/avisos';
import { runWithWorkspace } from '@/lib/workspace';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Cuánto puede esperar un trabajo SIN QUE NADIE LO TOME antes de darlo por
 * perdido.
 *
 * ⚠️ MÁS ALTO QUE EL DE LA PANTALLA (4 min), y a propósito. Los dos miden lo
 * mismo, pero el de la pantalla lo mira alguien que está ahí y puede reintentar
 * en el acto; éste corre a ciegas. Si fueran iguales, una carrera entre los dos
 * decidiría quién cierra el trabajo, y el aviso saldría por trabajos que la
 * persona ya vio fallar y ya reintentó.
 *
 * La alarma del puente corre cada 15 segundos: doce minutos son ~48 ciclos. Un
 * trabajo que sobrevive eso no está esperando, está solo.
 */
const ABANDONO_MIN = 12;

/**
 * El salto de línea de WhatsApp, sin escaparlo dentro de un template literal.
 *
 * Es la convención del repo (`prueba-grabacion` hace lo mismo): un `
` literal
 * adentro de un template se lee bien en el editor y ya costó caro en este
 * proyecto — el fuente y lo que se sirve no son el mismo texto.
 */
const NL = String.fromCharCode(10);

/** El tope de avisos por corrida. Un incidente no puede ser cien mensajes. */
const AVISOS_MAX = 5;

export async function GET(req: NextRequest) {
  const guard = await checkCronAuth(req);
  if (guard) return guard;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return Response.json({ ok: false, error: 'sin credenciales de base' }, { status: 500 });
  }
  // ⚠️ SERVICE KEY Y UNA SOLA LLAMADA, no un barrido por workspace. La función
  // cierra por edad y por `tomado_at is null`, que son hechos de la fila y no del
  // inquilino: iterar workspaces serían N llamadas para hacer lo mismo, y encima
  // se saltearía a cualquier workspace nuevo que nadie haya listado todavía.
  //
  // Lo que SÍ es por inquilino es el aviso, y para eso están las filas que vuelven.
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await db.rpc('flow_cerrar_abandonados', { p_minutos: ABANDONO_MIN });
  if (error) {
    console.error('[flow-abandono] no se pudo cerrar:', error.message);
    return Response.json({ ok: false, error: 'no se pudo cerrar' }, { status: 500 });
  }

  const cerrados = (data ?? []) as Array<{ id: number; workspace_id: number }>;
  if (!cerrados.length) return Response.json({ ok: true, cerrados: 0 });

  // Cuántos por cliente: el aviso dice «hay N tomas esperando», no manda uno por
  // toma. Un cliente con siete tomas encoladas recibiría siete mensajes que
  // cuentan el mismo hecho.
  const porWs = new Map<number, number>();
  for (const t of cerrados) porWs.set(t.workspace_id, (porWs.get(t.workspace_id) ?? 0) + 1);

  let avisados = 0;
  for (const [ws, cuantos] of porWs) {
    if (avisados >= AVISOS_MAX) break;
    avisados++;
    try {
      // ⚠️ `texto` ARMADO ACÁ y no `contexto`. `contexto` manda el aviso a un
      // modelo para que lo redacte, y esto es un hecho con un número: no hay nada
      // que interpretar, y hacerlo pasar por un LLM es la forma de que el número
      // salga distinto del que se midió.
      await runWithWorkspace(ws, () => emitirDelCatalogo('flow-puente-ausente', {
        texto: `🔴 Tus videos no se están generando: tu navegador dejó de responder y `
          + `${cuantos === 1 ? 'quedó *1 toma* sin tomar' : `quedaron *${cuantos} tomas* sin tomar`}.`
          + NL + NL
          + `Abre la extensión de MaKo y toca *Conectar*. `
          + `${cuantos === 1 ? 'Esa toma no se cobró' : 'Esas tomas no se cobraron'}: `
          + `cuando vuelvas, la${cuantos === 1 ? '' : 's'} vuelves a mandar. — MaKo`,
      }));
    } catch (e) {
      // ⚠️ UN AVISO QUE FALLA NO PUEDE DESHACER EL CIERRE. Los trabajos ya se
      // cerraron —eso es lo que impide que se cobren dos veces— y volver a
      // intentarlos en la próxima corrida no los encontraría: ya no están
      // `pendiente`. El aviso es lo accesorio; se registra y se sigue.
      console.error(`[flow-abandono] ws ${ws}: no se pudo avisar:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`[flow-abandono] ${cerrados.length} trabajo(s) cerrado(s) en ${porWs.size} workspace(s)`);
  return Response.json({ ok: true, cerrados: cerrados.length, workspaces: porWs.size });
}

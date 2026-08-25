// =============================================================================
// landing-vigilancia — mirar la landing y ACORDARSE de lo que se vio
// =============================================================================
// El pedido del dueño: «es MUY importante que el Pixel escuche SIEMPRE los
// cambios en la landing… una landing puede NO tener VSL en un principio y luego
// que los dueños le agreguen un VSL, MaKo debería en todo momento saber eso, y
// actualizar por lo tanto los datos que mide».
//
// Este es el ÚNICO punto por donde se analiza una landing y se recuerda el
// resultado. Lo llaman dos: la pantalla (cuando alguien abre la prueba) y el
// cron diario (para las páginas que nadie está mirando). Que sea uno solo es lo
// que hace que las dos vías produzcan el mismo «antes» y que la regla de los dos
// tiempos —la de lib/landing-snapshot.ts— valga para las dos.
//
// ⚠️ LA REGLA QUE GOBIERNA TODO ESTE ARCHIVO: una lectura que falló es «NO SÉ»,
// jamás «lo sacaron». Si el análisis no salió bien, acá no se escribe nada y no
// se anuncia nada: el snapshot anterior queda intacto y el cliente no se entera
// de un cambio que no ocurrió. Es la misma distinción que este repo ya pagó cara
// con el 0% de retención — «no medimos» y «dio cero» no son el mismo dato.
// =============================================================================

import 'server-only';
import { getSetting, setSetting } from './settings';
import { analizarLanding, type AnalisisLanding } from './landing-analisis';
import {
  SNAPSHOT_KEY,
  SIN_CAMBIOS,
  aplicarLectura,
  conSnapshot,
  parsearSnapshots,
  snapshotDe,
  type Cambios,
} from './landing-snapshot';

export type Mirada = {
  analisis: AnalisisLanding;
  /** Qué cambió desde la última lectura BUENA. Vacío si no hubo antes o si esta falló. */
  cambios: Cambios;
};

/**
 * Analiza una landing y guarda lo que vio, devolviendo el diff.
 *
 * `vigentes` son las URLs que el workspace sigue declarando: sirve para podar
 * snapshots de páginas borradas. Si no se pasa, no se poda nada — no saber
 * cuáles siguen vivas no autoriza a borrar.
 *
 * ⚠️ CORRE EN EL WORKSPACE ACTUAL. `getSetting`/`setSetting` resuelven el ws por
 * contexto asíncrono y, si no hay ninguno, caen a OWNER_WS EN SILENCIO
 * (lib/settings.ts:17). Desde una request de usuario el contexto ya está; desde
 * un cron hay que envolver en `runWithWorkspace(ws, …)` o el snapshot de un
 * cliente termina escrito en el workspace de Mauricio.
 */
export async function mirarLanding(url: string, vigentes?: readonly string[]): Promise<Mirada> {
  const analisis = await analizarLanding(url);

  // La puerta. `ok:false` o `error` cubre el 403, el timeout, el DNS que no
  // resuelve y la página que devolvió algo que no es HTML. En todos esos casos
  // `piezas` viene vacío, y tomarlo por bueno equivale a anunciar que el cliente
  // se quedó sin video, sin formulario y sin agenda de un día para el otro.
  if (!analisis.ok || analisis.error) return { analisis, cambios: SIN_CAMBIOS };

  try {
    const mapa = parsearSnapshots(await getSetting(SNAPSHOT_KEY));
    const { snapshot, cambios } = aplicarLectura(
      snapshotDe(mapa, url),
      [...analisis.piezas],
      new Date().toISOString(),
    );
    await setSetting(SNAPSHOT_KEY, JSON.stringify(conSnapshot(mapa, url, snapshot, vigentes)));
    return { analisis, cambios };
  } catch (e) {
    // No poder RECORDAR no puede romper el análisis: la pantalla que lo pidió
    // sigue necesitando las piezas para armar los pasos de la prueba. Se pierde
    // el diff de esta vuelta y nada más.
    console.error('[landing-vigilancia] no se pudo guardar el snapshot:', e instanceof Error ? e.message : e);
    return { analisis, cambios: SIN_CAMBIOS };
  }
}

/** Lo que sabíamos de una página, sin volver a bajarla. */
export async function loQueSabemos(url: string) {
  return snapshotDe(parsearSnapshots(await getSetting(SNAPSHOT_KEY).catch(() => null)), url);
}

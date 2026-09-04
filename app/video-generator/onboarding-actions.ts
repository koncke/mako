'use server';

// =============================================================================
// Las actions del onboarding de /video-generator
// =============================================================================
// Molde: `marcarPasoCarouselsAction` de app/carousels/actions.ts. El estado vive
// en `app_settings` vía lib/tab-onboarding-state.ts, con keys `vg_*` para no
// colisionar con los pasos compartidos de otras tabs.
//
// Las tres etapas de la skill, en el orden que manda la regla (lo aburrido al
// final, salvo lo que bloquea):
//
//   CONTEXTO  vg_cara · vg_acento · vg_muletillas
//   CONECTAR  vg_puente          ← aburrido, PERO bloquea al ensayo
//   ENSAYO    vg_ensayo          ← lo marca solo el primer escenario confirmado
//
// ⚠️ `vg_ensayo` NO se marca desde acá: lo marca `confirmarEscenaAction` al
// aprobar el primer escenario de verdad. Un botón de «listo» en el wizard
// diría que la tab quedó configurada sin que nada lo haya probado — que es
// exactamente lo que el ensayo existe para evitar.

import { getEstadoTab, marcarPasoTab } from '@/lib/tab-onboarding-state';
import { ACENTOS_ES, MULETILLAS, type AcentoId } from '@/lib/acento-workspace';
import { getVozCliente, setAcentoCliente, setMuletillasCliente, type VozCliente } from './voz-cliente';
import { decirConVoz } from '@/lib/elevenlabs';
import { getRolWsEfectivo, getWorkspaceActual } from '@/lib/workspace';

/**
 * El mismo piso que el resto de la tab: admin del workspace.
 *
 * ⚠️ Escrito acá y no importado de `video-action.ts`, donde vive el gemelo. Ese
 * archivo es `use server`: exportar el guard lo convertiría en una server action
 * llamable desde el navegador, o sea publicar el chequeo de permisos como
 * endpoint. Cuatro lineas duplicadas cuestan menos que eso.
 */
async function ctxAdmin(): Promise<{ ok: true; ws: number } | { ok: false; error: string }> {
  if ((await getRolWsEfectivo()) !== 'admin') {
    return { ok: false, error: 'Solo el administrador del workspace puede configurar esta tab.' };
  }
  const ws = await getWorkspaceActual();
  if (ws == null) return { ok: false, error: 'Sin workspace activo.' };
  return { ok: true, ws };
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

const TAB = 'video-generator';

/** Los pasos que la pantalla puede marcar. `vg_ensayo` no está y es a propósito. */
export type PasoVideoGen = 'vg_cara' | 'vg_acento' | 'vg_muletillas' | 'vg_voz' | 'vg_puente';

/**
 * Marca un paso como hecho.
 *
 * Idempotente: se relee el estado antes de escribir, así volver atrás y avanzar
 * otra vez no reescribe la fecha del paso. Es el mismo criterio de Carousels.
 */
export async function marcarPasoVideoAction(
  paso: PasoVideoGen,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const tab = await getEstadoTab(TAB);
    if (!tab.steps[paso]?.done) await marcarPasoTab(TAB, paso);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Guarda con qué acento habla este cliente, y cierra el paso.
 *
 * ⚠️ ES EL DATO QUE `resolverAcento` ESPERABA DESDE QUE SE ESCRIBIÓ. Sus dos
 * llamadores pasaban `declarado = null`, así que el acento de todo cliente salía
 * de adivinar su zona horaria y el resultado se marcaba `seguro: false` sin que
 * hubiera forma de arreglarlo. Esta action es esa forma.
 */
/**
 * ⚠️ `lloTocó` NO ES UN DETALLE DE UI: es la diferencia entre un dato del cliente y
 * una medición de la máquina de quien estaba mirando.
 *
 * El paso del acento arranca con el desplegable ya puesto en lo que dice la zona
 * horaria del navegador. Apretar «Siguiente» sin tocar nada guardaba eso como si lo
 * hubiera elegido la persona — y así fue como un cliente de Baja California quedó
 * con acento argentino: lo escribió el aparato del que verificaba.
 *
 * Ahora la pantalla, que es la única que lo sabe, lo dice.
 */
export async function guardarAcentoAction(
  acento: string,
  loTocó: boolean,
  zona = '',
): Promise<{ ok: true; voz: VozCliente } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  if (!(acento in ACENTOS_ES)) return { ok: false, error: 'No reconozco esa forma de hablar.' };
  try {
    const voz = await setAcentoCliente(acento as AcentoId, loTocó ? 'elegido' : 'sugerido-zona', zona);
    const tab = await getEstadoTab(TAB);
    if (!tab.steps.vg_acento?.done) await marcarPasoTab(TAB, 'vg_acento');
    return { ok: true, voz };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Guarda las muletillas que marcó como suyas, y cierra el paso.
 *
 * ⚠️ NINGUNA MARCADA TAMBIÉN ES UNA RESPUESTA, y el paso se cierra igual. Hay
 * gente que habla limpio, y obligar a marcar al menos una convierte «no uso»
 * en «inventá una» — que después el modelo repite en cada toma. El repo ya tiene
 * medido lo caro que sale meter muletillas que la persona no dice.
 */
export async function guardarMuletillasAction(
  muletillas: string[],
): Promise<{ ok: true; voz: VozCliente } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const voz = await setMuletillasCliente(Array.isArray(muletillas) ? muletillas : []);
    const tab = await getEstadoTab(TAB);
    if (!tab.steps.vg_muletillas?.done) await marcarPasoTab(TAB, 'vg_muletillas');
    return { ok: true, voz };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Lo que el cliente ya declaró, para pintar el wizard con lo guardado.
 *
 * Va junto con las muletillas de SU variedad: la pantalla no puede resolverlas
 * sola sin duplicar la regla, y una lista que difiera de la que usa el server
 * dejaría marcar algo que después se filtra en silencio.
 */
export async function leerVozAction(): Promise<
  { ok: true; voz: VozCliente; opciones: string[] } | { ok: false; error: string }
> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const voz = await getVozCliente();
    return { ok: true, voz, opciones: voz.acento ? MULETILLAS[voz.acento] : [] };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/**
 * Que la voz clonada del cliente DIGA una línea suya, para que se escuche.
 *
 * ⚠️ ES LA PRUEBA DE VIDA DEL PASO DE LA VOZ, y hasta acá ese paso se cerraba
 * con un tilde. La skill del onboarding lo pide con todas las letras: un paso de
 * conectar se cierra con EVIDENCIA, no con una credencial guardada — «un mensaje
 * real que llega al teléfono», «facts de su propia cuenta». Acá la evidencia es
 * oírse: es lo único que puede desmentir un clon malo antes de gastar un anuncio.
 *
 * Y es barato de comprobar caro de omitir: el repo tiene medido que un clon hecho
 * con material conversacional sale ~30 Hz por debajo del tono real y suena a
 * lectura. Eso se oye en dos segundos y no se ve en ninguna pantalla.
 */
export async function escucharMiVozAction(
  texto: string,
): Promise<{ ok: true; audio: string } | { ok: false; error: string }> {
  const ctx = await ctxAdmin();
  if (!ctx.ok) return ctx;
  try {
    const voz = await getVozCliente();
    if (!voz.clon?.voiceId) return { ok: false, error: 'Todavía no clonaste tu voz.' };

    const r = await decirConVoz(voz.clon.voiceId, texto);
    if (!r.ok) return { ok: false, error: r.error };

    // ⚠️ VIAJA COMO data: URI Y NO COMO UNA URL FIRMADA. Es audio de un par de
    // segundos que se escucha una vez y no se guarda: subirlo al storage dejaría
    // un archivo por cada click en un bucket que después nadie limpia. Una línea
    // de anuncio en mp3 pesa ~40 KB, que entra de sobra en una respuesta.
    return { ok: true, audio: `data:audio/mpeg;base64,${r.valor.mp3.toString('base64')}` };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

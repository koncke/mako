// =============================================================================
// Cron: las fotos de lámina que la IA de imagen del negocio ya devolvió, asentadas A CIEGAS
// =============================================================================
// «Editar» un carrusel con gente le pide las fotos que faltan a la IA de imagen DEL CLIENTE (su Google Flow por la
// extensión) y las anota; cuando su navegador las devuelve, hay que meterlas en el diseño ya guardado
// (`asentarFotosDeLamina`, lib/carruseles/foto-lamina.ts).
//
// HASTA ACÁ ESO LO HACÍA UNA SOLA COSA: el GET del diseño (app/api/image-editor/disenos/[id]/route.ts). O sea que la foto
// entraba sólo si alguien VOLVÍA A ABRIR el diseño — y la pantalla de «Editar» no sondea: el aviso dice «aparece en el
// diseño en unos minutos» y después no pasa nada.
//
// ⚠️ Y ESO NO ERA UNA DEMORA, ERA UNA PÉRDIDA. El pendiente VENCE a las 6 h (`VENCE_MS`): quien cerró la pestaña y volvió
// al día siguiente abría el diseño con el hueco y sin nada anotado. La foto estaba lista a los tres minutos, la generó SU
// navegador con SU cuenta de Google y ya se le contó contra su prueba — y la tiró el reloj. Y mientras el pendiente vivía,
// cualquier otra cosa que LEYERA el documento (la lista de diseños, una miniatura, un export) lo veía con el hueco igual,
// porque sólo ese GET asentaba. Esto es la otra mitad, la que corre cuando no hay nadie mirando: la misma regla de la casa
// que `/api/cron/flow-abandono` aplica a la cola de Flow —«todo proceso largo necesita algo que lo MIRE»—, acá sobre una
// cola cuyo worker es el navegador de otra persona.
//
// ── Por qué UNA consulta con la service key y no un barrido por workspace ────────────────────────
// Los pendientes viven en `app_settings`, una fila por negocio bajo `KEY_FOTOS_LAMINA`. Esa clave ES el índice: una sola
// lectura dice exactamente qué negocios tienen algo en vuelo, y en el caso de casi todas las corridas la respuesta es
// «ninguno» y termina ahí. Iterar los workspaces serían N lecturas para enterarse de que casi todos no tienen nada, y
// encima se saltearía a cualquier negocio nuevo que nadie haya listado todavía (el mismo razonamiento que la llamada
// única de `flow-abandono`).
//
// ⚠️ Y CADA NEGOCIO CORRE ADENTRO DE `runWithWorkspace`. `asentarFotosDeLamina` lee los pendientes con `getSetting` y los
// diseños con `getTenantDb`, que resuelven el negocio del store de la request. Sin el store, un cron SIN cookie resuelve
// al ws1 —que es Mauricio, un cliente— y asentaría las fotos de uno adentro de los diseños de otro (lib/settings.ts lo
// documenta como el bug del 17/10/2026).
//
// ── LA CADENCIA, con el dato ─────────────────────────────────────────────────────────────────────
// vercel.json: `5,15,25,35,45,55 * * * *` — cada 10 minutos, DESPLAZADO 5 del cron de la cola de Flow.
//
//   · Lo que se espera es la pestaña del cliente, y eso TERMINA solo: a los 12 minutos `flow-abandono` le pone estado
//     terminal a todo trabajo que nadie tomó, y el que sí tomaron vuelve en minutos. O sea que un pendiente llega a su
//     final dentro de los ~15 minutos de pedido. Más rápido que esto no hace que su navegador genere antes, y las
//     invocaciones de Vercel se pagan.
//   · `VENCE_MS` son 6 h, y es el margen de AFUERA, no la cadencia: lo único que dice es el TECHO. Un cron más lento que
//     6 h llegaría a encontrar el pendiente vencido y soltaría una foto que estaba lista; por la regla de «dos
//     oportunidades por vencimiento» (docs/hallazgos-carruseles.md → «El cron que no existía»), el techo son 3 h. El
//     PISO lo pone la promesa de la pantalla: «aparece en el diseño en unos minutos». Un cron por hora la vuelve mentira.
//   · El desplazamiento de 5 minutos es para leer DESPUÉS de la pasada de `flow-abandono` (que corre en `*/10`): así el
//     `fallido` que ese cron escribe en el minuto 12 ya está cuando éste pregunta, y el pendiente se suelta en la misma
//     vuelta en vez de esperar diez minutos más.
//
// ── Dos decisiones que no se ven en el diff ──────────────────────────────────────────────────────
//   · NO FILTRA POR WORKSPACE ACTIVO. La generación ya pasó y ya se le cobró a la cuenta de Flow del cliente; lo que
//     queda es copiar un archivo a un diseño que ya es suyo. Un negocio pausado un día perdería sus fotos (vencen a las
//     6 h) para no ahorrar nada, y `listarWorkspaces` sería una lectura cada diez minutos para no enterarse de nada.
//   · EL HOOK DEL GET DEL DISEÑO SE QUEDA, y ahora los dos tienen un trabajo distinto: el GET asienta EN EL ACTO cuando
//     alguien está mirando (esperar diez minutos con el hueco a la vista es justo el síntoma del que salió todo esto) y
//     éste cubre el caso ciego. Lo que cambia es que el GET deja de ser lo único: si nadie vuelve a abrir, la foto entra
//     igual acá.
//
// ⚠️ SIN ROTACIÓN, a propósito, y acá está el límite conocido. Si un día hubiera más negocios con fotos en vuelo que los
// que entran en una corrida, el que quede al final espera la próxima. No es la inanición de `correrRonda` porque acá el
// trabajo SE CONSUME —cada foto se asienta o se suelta— así que la cola drena sola. Lo que no drena son los pendientes
// que no se pueden asentar y todavía no vencieron (el compare-and-set que pierde siempre): si alguna vez se ve eso, lo
// que va acá es la rotación con cursor de `lib/cron-ronda.ts`, no un tope más grande.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { runWithWorkspace } from '@/lib/workspace';
import { entraEnLaRonda } from '@/lib/cron-ronda';
import { KEY_FOTOS_LAMINA, asentarFotosDeLamina } from '@/lib/carruseles/foto-lamina';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 120;

/** Cuántos negocios por corrida. El tope es la unidad de costo; el resto queda anotado para los diez minutos siguientes. */
const WS_MAX = 50;
/** ms que se reservan para armar la respuesta después del último negocio (igual que `correrRonda`). */
const RESERVA_SALIDA_MS = 10_000;
/**
 * Lo mínimo que le tiene que quedar a un negocio para que darle el turno sirva: bajar una foto, subirla a «Subidos» y
 * guardar el diseño. Con menos se paga la lectura para arrancar algo que la plataforma mata a mitad.
 */
const MINIMO_MS = 20_000;

type Fila = { workspace_id: number | string | null; value: unknown };

/**
 * ¿Esa fila tiene algo que asentar? Se lee con la misma desconfianza que `pendientesDeFoto`: un valor que no parsea o una
 * lista vacía no son un negocio al que haya que entrar — ahí `asentarFotosDeLamina` se iría igual en la primera lectura.
 * `anotar` deja exactamente `[]` cuando se asentó el último pendiente, así que éste es el caso común.
 */
function tieneAlgo(value: unknown): boolean {
  if (typeof value !== 'string' || !value) return false;
  try {
    const a = JSON.parse(value);
    return Array.isArray(a) && a.length > 0;
  } catch { return false; }
}

export async function GET(req: NextRequest) {
  const guard = checkCronAuth(req);
  if (guard) return guard;

  const t0 = Date.now();
  const deadline = t0 + maxDuration * 1000 - RESERVA_SALIDA_MS;
  let filas: Fila[];
  try {
    // ⚠️ `order` para que la corrida sea DETERMINISTA: sin él el orden lo elige PostgREST, y dos corridas con el mismo
    // estado pueden servir a distintos negocios — que es lo que vuelve ilegible un log.
    const { data, error } = await getSupabaseServer()
      .from('app_settings')
      .select('workspace_id, value')
      .eq('key', KEY_FOTOS_LAMINA)
      .order('workspace_id')
      .limit(WS_MAX);
    if (error) throw new Error(error.message);
    filas = (data ?? []) as Fila[];
  } catch (e) {
    console.error('[cron:carruseles-fotos-lamina] no pude leer los pendientes:', e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: 'no se pudieron leer los pendientes' }, { status: 500 });
  }

  const negocios = [...new Set(filas.filter((f) => tieneAlgo(f.value)).map((f) => Number(f.workspace_id)))]
    .filter((ws) => Number.isFinite(ws) && ws > 0);
  // El caso de casi todas las corridas: nadie pidió una foto, o ya se asentaron todas. Una lectura y afuera.
  if (!negocios.length) return Response.json({ ok: true, negocios: 0, puestas: 0, caidas: 0, sinTurno: [] });

  let puestas = 0;
  let caidas = 0;
  const sinTurno: number[] = [];
  for (const ws of negocios) {
    if (!entraEnLaRonda(Date.now(), deadline, MINIMO_MS)) { sinTurno.push(ws); continue; }
    try {
      const r = await runWithWorkspace(ws, () => asentarFotosDeLamina(ws));
      puestas += r.puestas;
      caidas += r.caidas;
    } catch (e) {
      // ⚠️ UN NEGOCIO QUE ROMPE NO CORTA A LOS DEMÁS, y tampoco pierde nada: lo que no se asentó sigue anotado y se
      // reintenta en la próxima corrida (el pendiente se suelta solo cuando el trabajo falló o venció).
      console.error(`[cron:carruseles-fotos-lamina] ws ${ws}:`, e instanceof Error ? e.message : e);
    }
  }

  const sobraron = sinTurno.length ? `; sin turno: ${sinTurno.join(', ')}` : '';
  console.log(`[cron:carruseles-fotos-lamina] ${puestas} foto(s) asentada(s) y ${caidas} soltada(s) en ${negocios.length} negocio(s)${sobraron} (${Date.now() - t0} ms)`);
  return Response.json({ ok: true, negocios: negocios.length, puestas, caidas, sinTurno });
}

// =============================================================================
// El agendado de un mensaje: guardar el cron y drenar lo que venció
// =============================================================================
// La pantalla guarda acá y el cron lee de acá. El cálculo puro —cuándo es la
// próxima vez— vive en `lib/cron-aviso.ts`, sin `server-only`, para que se pueda
// testear sin base; este módulo es el que toca la tabla y el que manda.
//
// ⚠️ SALE POR `emitirAviso`, no por `enviarAlGrupoMaKo`. Es la diferencia entre un
// mensaje del producto y uno que se saltea todo: `emitirAviso` mira el interruptor
// del aviso, respeta los canales elegidos (WhatsApp / email), deja la entrada en el
// feed y abre las insistencias si el flujo las tiene. Las insistencias mandan por el
// grupo directo, y eso es correcto PARA UNA INSISTENCIA —ya salió una vez por el
// camino bueno— y sería un agujero acá: un aviso programado que el negocio apagó
// tiene que dejar de salir.

import 'server-only';

import { getTenantDb, getWorkspaceActual } from './workspace';
import { tzDeWorkspace } from './timezone';
import { referenciaPlantilla, plantillaActiva, getPlantilla } from './plantillas';
import { emitirAviso } from './avisos';
import { proximaOcurrencia, sanearCron, type CronAviso } from './cron-aviso';

export type Programado = {
  avisoId: string;
  cron: CronAviso;
  tz: string;
  proximaAt: string;
  ultimoEnvioAt: string | null;
  envios: number;
};

type Fila = {
  aviso_id: string; cron: unknown; tz: string;
  proxima_at: string; anterior_at: string; ultimo_envio_at: string | null; envios: number;
};

const aProgramado = (f: Fila): Programado | null => {
  const cron = sanearCron(f.cron);
  return cron ? {
    avisoId: f.aviso_id, cron, tz: f.tz, proximaAt: f.proxima_at,
    ultimoEnvioAt: f.ultimo_envio_at, envios: f.envios,
  } : null;
};

/** Lo agendado de un mensaje en el workspace actual, o `null` si sale por evento o a mano. */
export async function getProgramado(avisoId: string): Promise<Programado | null> {
  const db = await getTenantDb();
  const { data, error } = await db.from('avisos_programados')
    .select('aviso_id, cron, tz, proxima_at, anterior_at, ultimo_envio_at, envios')
    .eq('aviso_id', avisoId).maybeSingle();
  // Acá sí se puede devolver `null` en silencio ante un error: la pregunta es «¿hay un
  // horario?» y la respuesta honesta cuando no se pudo leer es la misma que la pantalla
  // ya sabe dibujar (sin agendar). Lo que NO puede pasar en silencio es una ESCRITURA
  // que no escribió — por eso el de abajo tira y éste no.
  if (error) console.error(`[avisos-programados] get ${avisoId}:`, error.message);
  if (error || !data) return null;
  return aProgramado(data as Fila);
}

/**
 * Agenda (o reprograma) un mensaje. `null` lo desagenda.
 *
 * ⚠️ LA ZONA SE RESUELVE ACÁ Y SE CONGELA EN LA FILA. `tzDeWorkspace` puede salir a
 * la red (Cal.com, Google Calendar) con una carrera de 4 s y, si no llega, devuelve
 * `America/Tijuana` sin guardarla. Resolverla en cada tick del cron sería pagar eso
 * 6 veces por tick (los seis workspaces activos sin `mako.timezone`) y, peor, dejar
 * que el horario de un mensaje se mueva solo el día que la averiguación conteste otra
 * cosa. Se resuelve una vez, se guarda, y la pantalla la MUESTRA.
 */
export async function setProgramado(avisoId: string, cron: unknown): Promise<Programado | null> {
  const db = await getTenantDb();
  const ws = await getWorkspaceActual();
  const limpio = sanearCron(cron);
  if (!limpio || ws == null) {
    await db.from('avisos_programados').delete().eq('aviso_id', avisoId);
    return null;
  }
  const tz = await tzDeWorkspace(ws).catch(() => 'America/Tijuana');
  const ahora = new Date();
  // El ancla de la PRIMERA vez es ahora: no hay ocurrencia anterior de la que colgarse.
  const proxima = proximaOcurrencia(limpio, ahora, tz, ahora);
  const { data, error } = await db.from('avisos_programados').upsert({
    workspace_id: ws, aviso_id: avisoId, cron: limpio, tz,
    proxima_at: proxima.toISOString(), anterior_at: ahora.toISOString(),
  }, { onConflict: 'workspace_id,aviso_id' })
    .select('aviso_id, cron, tz, proxima_at, anterior_at, ultimo_envio_at, envios').single();
  // ⚠️ EL ERROR NO SE TRAGA. La primera versión hacía `if (error || !data) return null`,
  // y con eso la ruta contestaba `{ ok: true, programado: null }` sobre un upsert que
  // había fallado: la pantalla pintaba el horario elegido (el estado optimista), la
  // tabla quedaba VACÍA y nadie se enteraba. Medido — cinco `cron-set` seguidos, cero
  // filas. «Una política puede RECHAZAR; no puede no dejar rastro», y acá ni rechazaba:
  // afirmaba que había guardado.
  if (error) throw new Error(`No se pudo agendar «${avisoId}»: ${error.message}`);
  if (!data) throw new Error(`No se pudo agendar «${avisoId}»: la base no devolvió la fila.`);
  return aProgramado(data as Fila);
}

/**
 * Manda lo que venció en el workspace actual.
 *
 * ⚠️ EL ORDEN ES: AVANZAR CON COMPARE-AND-SET Y RECIÉN DESPUÉS MANDAR. Al revés, dos
 * invocaciones del mismo tick —un reintento de Vercel, o un tick que tarda más que el
 * intervalo y se solapa con el siguiente— mandan dos veces. El precedente está medido
 * en esta casa: 21 pares duplicados el 27/09 sobre `mako_doer_conv`, causados por los
 * 7-10 s que el envío por WhatsApp retiene el HTTP abierto entre la lectura y la
 * marca. Y el reclamo que ya existía (`reclamarEspaciado`) NO cubre esto: se saltea
 * entero cuando el número es 0, y está medido que hoy es 0 en los 108 avisos activos.
 *
 * El costo de este orden es el opuesto y es el correcto: si el envío falla, la
 * ocurrencia se perdió y vuelve en la siguiente. Un mensaje de menos se nota; dos
 * mensajes iguales en el WhatsApp de un cliente, también, y ése no se puede deshacer.
 */
export async function drenarProgramados(): Promise<{ enviados: number; saltados: number }> {
  const db = await getTenantDb();
  const ahora = new Date();
  const { data, error } = await db.from('avisos_programados')
    .select('aviso_id, cron, tz, proxima_at, anterior_at, ultimo_envio_at, envios')
    .lte('proxima_at', ahora.toISOString())
    .order('proxima_at', { ascending: true })
    .limit(20);
  if (error || !data?.length) return { enviados: 0, saltados: 0 };

  let enviados = 0, saltados = 0;
  for (const f of data as Fila[]) {
    const cron = sanearCron(f.cron);
    if (!cron) continue;
    // El ancla es la ocurrencia AGENDADA que acaba de vencer, no `ahora`: es lo que
    // mantiene la grilla. Y `proximaOcurrencia` se saltea las perdidas, así que un
    // cron caído un día manda UNA vez y sigue en su horario.
    const proxima = proximaOcurrencia(cron, new Date(f.proxima_at), f.tz, ahora);
    const { error: upErr } = await db.from('avisos_programados').update({
      proxima_at: proxima.toISOString(),
      anterior_at: f.proxima_at,
      ultimo_envio_at: ahora.toISOString(),
      envios: f.envios + 1,
    }).eq('aviso_id', f.aviso_id).eq('proxima_at', f.proxima_at);   // compare-and-set
    if (upErr) { saltados++; continue; }

    // El interruptor se pregunta DESPUÉS de reclamar: si está apagado se avanza el
    // horario igual y no se manda. Al revés, un aviso apagado dejaría su fila vencida
    // y el drenador la leería en cada tick para siempre.
    if (!(await plantillaActiva(f.aviso_id))) { saltados++; continue; }
    try {
      const p = await getPlantilla(f.aviso_id);
      await emitirAviso({
        tipo: f.aviso_id,
        titulo: p?.titulo ?? f.aviso_id,
        texto: await referenciaPlantilla(f.aviso_id),
        categoria: p?.categoria,
      });
      enviados++;
    } catch (e) {
      saltados++;
      console.error(`[avisos-programados] ${f.aviso_id}:`, e instanceof Error ? e.message : String(e));
    }
  }
  return { enviados, saltados };
}

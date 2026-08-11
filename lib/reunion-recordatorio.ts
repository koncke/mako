import 'server-only';

// =============================================================================
// reunion-recordatorio — el WhatsApp de «en media hora entrás a la R1 con X»
// =============================================================================
// Estaba en el catálogo de avisos desde el principio con `yaImplementado: 'no'`:
// el texto existía y NADIE lo llamaba. Es el momento en el que más sirve saber
// quién es el lead —treinta minutos antes, con el teléfono en la mano— y era
// justo el que faltaba.
//
// CÓMO NO MANDA DOS VECES. El candado no es la ventana del cron: es una marca
// por REUNIÓN (`mako.recordatorio.<leadId>.<R1|R2>.<iso>`). Con eso el cron
// puede correr cada minuto, cada diez o dos veces por un reintento de Vercel y
// el mensaje sale una sola vez. Atarlo a la frecuencia del cron es lo que hace
// que un cambio de schedule duplique avisos meses después, sin que nadie
// relacione una cosa con la otra.
//
// Y la marca lleva el ISO adentro a propósito: si el lead REAGENDA, la fecha
// cambia, la key es otra y el recordatorio del horario nuevo sí sale.
// =============================================================================

import { getTenantDb } from './workspace';
import { getSetting, setSetting } from './settings';
import { emitirDelCatalogo } from './avisos';
import { textoAvisoPreLlamada } from './lead-resumen';

/**
 * Cuánto antes avisa. Treinta minutos es el hueco donde el aviso todavía sirve:
 * alcanza para abrir el resumen y no tanto como para olvidarse.
 */
export const MINUTOS_ANTES = 30;

/**
 * Cuánto para atrás mira. Es la RED por si el cron no corrió (deploy, caída,
 * cold start): una reunión que ya empezó hace 10 minutos todavía merece el
 * aviso. Más atrás que eso ya es ruido — la reunión está pasando.
 */
const TOLERANCIA_MIN = 10;

const keyMarca = (leadId: number, cual: 'R1' | 'R2', iso: string) =>
  `mako.recordatorio.${leadId}.${cual}.${iso}`;

export type ResultadoRecordatorios = {
  /** Reuniones dentro de la ventana. */ miradas: number;
  /** Avisos que salieron ahora. */ avisados: number;
  /** Ya avisadas antes (la marca las frenó). */ yaAvisadas: number;
  errores: number;
};

type FilaReunion = {
  id: number;
  nombre: string;
  junta_1_at: string | null;
  junta_2_at: string | null;
  asistio_j1: boolean | null;
  asistio_j2: boolean | null;
  estado_lead: string | null;
};

/**
 * Manda el recordatorio de las reuniones que arrancan en los próximos
 * `MINUTOS_ANTES`. Corre dentro de runWithWorkspace (lo llama el cron).
 */
export async function mandarRecordatoriosDeReunion(ws: number): Promise<ResultadoRecordatorios> {
  const out: ResultadoRecordatorios = { miradas: 0, avisados: 0, yaAvisadas: 0, errores: 0 };
  const supabase = await getTenantDb();

  const ahora = Date.now();
  const desde = new Date(ahora - TOLERANCIA_MIN * 60_000).toISOString();
  const hasta = new Date(ahora + MINUTOS_ANTES * 60_000).toISOString();

  // Se pregunta por las DOS columnas en una sola vuelta: `or` de Supabase con
  // los dos rangos. Traer todos los leads y filtrar en memoria funcionaba con
  // 200 leads y deja de funcionar sin avisar.
  const { data, error } = await supabase
    .from('leads')
    .select('id, nombre, junta_1_at, junta_2_at, asistio_j1, asistio_j2, estado_lead')
    .or(
      `and(junta_1_at.gte.${desde},junta_1_at.lte.${hasta}),` +
      `and(junta_2_at.gte.${desde},junta_2_at.lte.${hasta})`,
    );
  if (error) {
    console.error(`[recordatorio] ws=${ws} no se pudieron leer las reuniones: ${error.message}`);
    out.errores += 1;
    return out;
  }

  const dentro = (iso: string | null): boolean => {
    if (!iso) return false;
    const t = Date.parse(iso);
    return Number.isFinite(t) && t >= ahora - TOLERANCIA_MIN * 60_000 && t <= ahora + MINUTOS_ANTES * 60_000;
  };

  for (const lead of (data ?? []) as FilaReunion[]) {
    // Una reunión por lead por corrida: si las dos cayeran en la misma ventana
    // (no debería), gana la R2, que es la que viene después.
    const cual: 'R1' | 'R2' | null = dentro(lead.junta_2_at) ? 'R2' : dentro(lead.junta_1_at) ? 'R1' : null;
    if (!cual) continue;
    const iso = (cual === 'R2' ? lead.junta_2_at : lead.junta_1_at) as string;

    // Un lead que ya se cerró o se perdió sigue teniendo la fecha cargada: la
    // reunión no se borra al mover la etapa. Sin este filtro, el recordatorio de
    // una R1 vieja sale igual el día que alguien corrige una fecha a mano.
    if (lead.estado_lead && lead.estado_lead !== 'abierto') continue;
    // Y si la asistencia YA está marcada, la reunión ocurrió: lo que sigue es el
    // aviso post-llamada, no éste.
    if (cual === 'R1' && lead.asistio_j1 != null) continue;
    if (cual === 'R2' && lead.asistio_j2 != null) continue;

    out.miradas += 1;
    const key = keyMarca(lead.id, cual, iso);
    // Ante un error leyendo la marca se SALTEA (el catch devuelve 'error', que es
    // truthy): mejor perderse un recordatorio que mandar el mismo tres veces.
    if (await getSetting(key).catch(() => 'error')) { out.yaAvisadas += 1; continue; }

    try {
      const minutos = Math.max(0, Math.round((Date.parse(iso) - ahora) / 60_000));
      const texto = await textoAvisoPreLlamada({ leadId: lead.id, cual, minutos });
      if (!texto) { out.errores += 1; continue; }
      const aviso = await emitirDelCatalogo('reunion-recordatorio', { ws, texto });
      // La marca se escribe DESPUÉS del envío y solo si el aviso se procesó — el
      // candado se escribe después del efecto que protege (misma disciplina que
      // lib/reunion-auto.ts, donde escribirlo antes perdía las tareas para
      // siempre). `ok` cubre también el caso «apagado en Configuraciones»: ahí no
      // hay que reintentar, el dueño lo silenció a propósito.
      if (aviso.ok) {
        await setSetting(key, new Date().toISOString()).catch(() => {});
        out.avisados += 1;
      } else {
        out.errores += 1;
      }
    } catch (e) {
      out.errores += 1;
      console.error(`[recordatorio] ws=${ws} lead=${lead.id} ${cual}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return out;
}

// =============================================================================
// Cron: el TICK del motor de nutrición — cada minuto, las 24 h, sólo lo que acaba de vencer
// =============================================================================
// vercel.json: `1-59 * * * *` (el minuto 0 lo cubre /api/cron/nutricion, que barre todo).
//
// Sexta tanda (09/10/2026), decisión de Martín: las esperas se cumplen a la hora exacta, de día o
// de noche. Hasta acá el motor corría una vez por hora y sólo de 15 a 23 UTC: «Esperar 5 minutos»
// salía hasta una hora tarde, y de 17 a 9 de Ciudad de México a la mañana siguiente. La pantalla lo
// avisaba («Sigue a la hora en punto») y Martín lo mandó a sacar.
//
// ⚠️ EL TICK NO ES LA CORRIDA DE CADA HORA CADA MINUTO, y eso es lo que lo hace barato:
//   · Una consulta para TODOS los negocios (¿qué venció en los últimos `VENTANA_FRESCA_MIN`?) y otra
//     por los horarios de envío; sin nada, termina ahí. El motor corre sólo en los negocios con algo
//     que acaba de vencer, y sólo sobre ESAS filas (`vencidasDesde`). Lo viejo (frenado por el
//     anti-ban de 20 h, por el tope, por un canal apagado) lo sigue barriendo la corrida de cada hora:
//     si el tick lo mirara, cada fila frenada correría el motor de su negocio cada minuto.
//   · No evalúa desenlaces ni inscribe por cohorte, SALVO UN RECURRENTE QUE LLEGA A SU HORA (20/10/2026): el d2 de
//     #284 del ws11, «martes 16:15», salía a las 22:00 con la corrida de la hora. Ahora una lectura de las
//     automatizaciones activas de todos los negocios (medido ese día: 20 filas, 0,1 ms en la base) dice qué negocio
//     tiene una ocurrencia que acaba de vencer (`negociosConRecurrenteVencido`), y ahí se inscribe SÓLO lo de los CRON
//     con horario (`comprometerInscripciones({ soloRecurrentes })`, el mismo compare-and-set de la corrida de la hora)
//     antes de mover lo vencido. Si esa lectura falla, el tick sigue: el Recurrente sale a la hora en punto.
//   · El tope de WhatsApp es el de la HORA, compartido con la corrida de cada hora (`cupoPorHora`):
//     con un cupo de 6 por corrida, 60 corridas por hora mandarían 360 desde la línea del cliente.
//   · El TURNO del negocio (lib/motor-turno.ts): dos corridas del motor sobre el mismo negocio a la
//     vez mandan dos veces el mismo mensaje. Si otra lo tiene, ese negocio se saltea.
//   · Con HORARIO DE ENVÍO (opcional, lib/horario-envio.ts), en el minuto en que abre se barre ENTERO
//     lo vencido de ese negocio: «lo que vence fuera de horario sale al abrir».
//
// Modos manuales: `?dry=1` lista qué negocios correría y por qué, sin correr nada.
// Auth: Bearer ${CRON_SECRET}.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { getSupabaseServer } from '@/lib/supabase';
import { listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import { procesarEnvios, getSecuenciasActivas, comprometerInscripciones } from '@/lib/nutricion';
import { envioEmailHabilitado, envioWhatsappHabilitado } from '@/lib/envio-flags';
import { ESPERA_CORRIDA_HASTA_MS, VENTANA_FRESCA_MIN, desdeFresco } from '@/lib/espera-duracion';
import { KEY_HORARIO_ENVIO, horarioVigente, acabaDeAbrir } from '@/lib/horario-envio';
import { CLAVE_PREFIJO, sanearConfigAutomatizacion, abrioAlgunaPropia, type ConfigAutomatizacion } from '@/lib/config-automatizacion';
import { KEY_TIMEZONE } from '@/lib/timezone';
// LA regla de lectura de la zona (undécima tanda): la misma del motor y las pantallas; sin zona, `ZONA_POR_DEFECTO`.
import { zonaDeLoGuardado } from '@/lib/zona-negocio-reglas';
import { negociosDelTick, correSinCanales, negociosConRecurrenteVencido, type MotivoTick, type FilaRecurrente } from '@/lib/motor-tick';
import { conTurnoDelMotor } from '@/lib/motor-turno';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Fila = { workspace_id: number | string | null };
/** Las filas que el motor mueve: las mismas que lee `inscripcionesVencidas` (lib/nutricion.ts). */
const ESTADOS_QUE_SE_MUEVEN = ['activa', 'respondio'];
const idsDe =(filas: readonly Fila[] | null): number[] =>
  [...new Set((filas ?? []).map((f) => Number(f.workspace_id)).filter((n) => Number.isFinite(n) && n > 0))];

export async function GET(request: NextRequest) {
  const unauth = checkCronAuth(request);
  if (unauth) return unauth;
  const url = new URL(request.url);
  const ahora = Date.now();
  const ahoraIso = new Date(ahora).toISOString();
  const desde = desdeFresco(ahora);
  const db = getSupabaseServer();

  try {
    // 1. Lo que venció hace poco, en TODOS los negocios (índice `estado, proximo_envio_at`, 0034).
    //    ⚠️ Topea en 1000 filas (PostgREST): con más, algún negocio puede quedar para el minuto
    //    siguiente o para la corrida de la hora. No se pierde nada: la fila sigue vencida.
    //    Y las 'respondio' (undécima tanda, M4): el lead contestó pero el carril del recordatorio sigue vivo;
    //    `pausarPorRespuesta` les deja el próximo envío SÓLO a ésas, así que una 'respondio' vencida es del carril.
    //    Sin esto el «1 h antes» de quien contestó salía sólo si la corrida de cada hora caía en la tolerancia.
    const { data: frescas, error: eFrescas } = await db.from('nutricion_inscripciones')
      .select('workspace_id').in('estado', ESTADOS_QUE_SE_MUEVEN)
      .gte('proximo_envio_at', desde).lte('proximo_envio_at', ahoraIso).limit(1000);
    if (eFrescas) throw new Error(`vencidas: ${eFrescas.message}`);
    const conVencidoFresco = idsDe(frescas as Fila[]);

    // 2. Los horarios de envío que ACABAN de abrir (con algo vencido, de cualquier antigüedad).
    const { data: horarios, error: eHor } = await db.from('app_settings').select('workspace_id, value').eq('key', KEY_HORARIO_ENVIO);
    if (eHor) throw new Error(`horarios: ${eHor.message}`);
    const conHorario = new Map<number, ReturnType<typeof horarioVigente>>();
    for (const r of (horarios ?? []) as Array<{ workspace_id: number | string; value: string }>) {
      const h = horarioVigente(r.value);
      if (h) conHorario.set(Number(r.workspace_id), h);
    }
    // Y los horarios PROPIOS de una automatización (20/10/2026, lib/config-automatizacion.ts): si abre el de una, el
    // negocio se barre igual (lo que venció mientras estaba cerrada sale al abrir, como con el del negocio).
    const { data: propias, error: eProp } = await db.from('app_settings').select('workspace_id, value').like('key', `${CLAVE_PREFIJO}%`);
    if (eProp) throw new Error(`horarios propios: ${eProp.message}`);
    const propiasDe = new Map<number, ConfigAutomatizacion[]>();
    for (const r of (propias ?? []) as Array<{ workspace_id: number | string; value: string }>) {
      const c = sanearConfigAutomatizacion(r.value);
      if (!c.horario || !c.horario.activo) continue;
      const ws = Number(r.workspace_id);
      propiasDe.set(ws, [...(propiasDe.get(ws) ?? []), c]);
    }
    let abrieronConVencido: number[] = [];
    if (conHorario.size || propiasDe.size) {
      const { data: zonas, error: eZ } = await db.from('app_settings').select('workspace_id, value')
        .eq('key', KEY_TIMEZONE).in('workspace_id', [...new Set([...conHorario.keys(), ...propiasDe.keys()])]);
      if (eZ) throw new Error(`zonas: ${eZ.message}`);
      const zonaDe = new Map(((zonas ?? []) as Array<{ workspace_id: number | string; value: string }>).map((z) => [Number(z.workspace_id), z.value]));
      const abiertos = [...new Set([...conHorario.keys(), ...propiasDe.keys()])].filter((ws) => {
        const tz = zonaDeLoGuardado(zonaDe.get(ws));
        const h = conHorario.get(ws);
        return (!!h && acabaDeAbrir(ahora, tz, h, VENTANA_FRESCA_MIN)) || abrioAlgunaPropia(propiasDe.get(ws) ?? [], ahora, tz, VENTANA_FRESCA_MIN);
      });
      if (abiertos.length) {
        const { data: viejas, error: eV } = await db.from('nutricion_inscripciones')
          .select('workspace_id').in('estado', ESTADOS_QUE_SE_MUEVEN).lte('proximo_envio_at', ahoraIso).in('workspace_id', abiertos).limit(1000);
        if (eV) throw new Error(`vencidas al abrir: ${eV.message}`);
        abrieronConVencido = idsDe(viejas as Fila[]);
      }
    }

    // 3. Los RECURRENTES que acaban de llegar a su hora, en TODOS los negocios: todos sus CRON (las columnas y
    //    `disparadores`), así que se leen las activas enteras. Tolerante: una lectura que falla no frena las esperas.
    let conRecurrente: number[] = [];
    const { data: secs, error: eSecs } = await db.from('nutricion_secuencias')
      .select('workspace_id, trigger_tipo, etapa, etapas, funnel_id, producto_id, etiqueta_id, cron, cron_proxima_at, disparadores')
      .eq('activa', true).is('archivada_at', null).limit(1000);
    if (eSecs) console.error(`[cron:nutricion-tick] recurrentes: ${eSecs.message}`);
    else conRecurrente = negociosConRecurrenteVencido((secs ?? []) as FilaRecurrente[], ahora, Date.parse(desde));

    // Nada que hacer: el caso de casi todos los minutos. Sin leer los workspaces.
    if (!conVencidoFresco.length && !abrieronConVencido.length && !conRecurrente.length) return Response.json({ ok: true, negocios: 0 });

    const activos = new Set((await listarWorkspaces()).filter((w) => w.estado === 'activo').map((w) => w.id));
    const objetivo = negociosDelTick({ activos, conVencidoFresco, abrieronConVencido, conRecurrente });
    if (url.searchParams.get('dry') === '1') return Response.json({ ok: true, modo: 'dry-run', desde, objetivo });

    // El tope de las esperas cortas, UNO para toda la ruta (lib/espera-duracion.ts).
    const esperarHastaMs = Date.now() + ESPERA_CORRIDA_HASTA_MS;
    const resultados: Array<{ ws: number; motivo: MotivoTick; [k: string]: unknown }> = [];
    for (const { ws, motivo, recurrente } of objetivo) {
      try {
        const r = await runWithWorkspace(ws, () => conTurnoDelMotor(ws, async () => {
          // Con los dos canales apagados corre lo que no los usa: los pasos «⚡ Acción» y los mensajes
          // por Instagram o Messenger, que no tienen interruptor del negocio (`correSinCanales`, la
          // MISMA pregunta que hace la corrida de cada hora). Sin nada de eso, no hay nada que mover.
          const [waOn, emailOn] = await Promise.all([envioWhatsappHabilitado(), envioEmailHabilitado()]);
          // El Recurrente que llegó a su hora inscribe ANTES de mover lo vencido: sus inscriptos nacen con el primer envío
          // ahora, adentro de la ventana fresca, y salen en esta misma corrida. Sin canales, sólo el grupo de MaKo (como
          // la corrida de cada hora: con los canales apagados no se inscribe a nadie).
          const inscriptas = recurrente ? await comprometerInscripciones({ soloRecurrentes: true, ...(!waOn && !emailOn ? { soloGrupo: true } : {}) }) : null;
          const conInscriptas = inscriptas == null ? {} : { inscriptas };
          if (!waOn && !emailOn && !(await getSecuenciasActivas()).some((s) => s.pasos.some(correSinCanales))) return { modo: 'off', ...conInscriptas };
          const proc = await procesarEnvios({ esperarHastaMs, cupoPorHora: true, ...(motivo !== 'abrio' ? { vencidasDesde: desde } : {}) });
          return { ...proc, ...conInscriptas };
        }));
        resultados.push(r.corrio ? { ws, motivo, ...r.resultado } : { ws, motivo, saltado: r.porque === 'ocupado' ? 'otra corrida tiene el turno' : 'no pude leer el turno' });
      } catch (err) {
        // Un negocio que falla no corta a los demás.
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[cron:nutricion-tick] ws ${ws} error: ${msg}`);
        resultados.push({ ws, motivo, error: msg });
      }
    }
    const errores = resultados.filter((r) => 'error' in r).length;
    const todoFallo = resultados.length > 0 && errores === resultados.length;
    return Response.json({ ok: !todoFallo, negocios: resultados.length, errores, resultados }, { status: todoFallo ? 500 : 200 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cron:nutricion-tick] error: ${msg}`);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

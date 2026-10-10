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
//   · No inscribe por cohorte ni evalúa desenlaces: eso sigue en la corrida de cada hora.
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
import { procesarEnvios, getSecuenciasActivas } from '@/lib/nutricion';
import { envioEmailHabilitado, envioWhatsappHabilitado } from '@/lib/envio-flags';
import { ESPERA_CORRIDA_HASTA_MS, VENTANA_FRESCA_MIN, desdeFresco } from '@/lib/espera-duracion';
import { KEY_HORARIO_ENVIO, horarioVigente, acabaDeAbrir } from '@/lib/horario-envio';
import { KEY_TIMEZONE } from '@/lib/timezone';
import { zonaDelMotor } from '@/lib/nutricion-grafo-motor';
import { negociosDelTick, correSinCanales, type MotivoTick } from '@/lib/motor-tick';
import { conTurnoDelMotor } from '@/lib/motor-turno';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Fila = { workspace_id: number | string | null };
const idsDe = (filas: readonly Fila[] | null): number[] =>
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
    const { data: frescas, error: eFrescas } = await db.from('nutricion_inscripciones')
      .select('workspace_id').eq('estado', 'activa')
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
    let abrieronConVencido: number[] = [];
    if (conHorario.size) {
      const { data: zonas, error: eZ } = await db.from('app_settings').select('workspace_id, value')
        .eq('key', KEY_TIMEZONE).in('workspace_id', [...conHorario.keys()]);
      if (eZ) throw new Error(`zonas: ${eZ.message}`);
      const zonaDe = new Map(((zonas ?? []) as Array<{ workspace_id: number | string; value: string }>).map((z) => [Number(z.workspace_id), z.value]));
      const abiertos = [...conHorario.entries()]
        .filter(([ws, h]) => acabaDeAbrir(ahora, zonaDelMotor(zonaDe.get(ws) ?? null), h, VENTANA_FRESCA_MIN))
        .map(([ws]) => ws);
      if (abiertos.length) {
        const { data: viejas, error: eV } = await db.from('nutricion_inscripciones')
          .select('workspace_id').eq('estado', 'activa').lte('proximo_envio_at', ahoraIso).in('workspace_id', abiertos).limit(1000);
        if (eV) throw new Error(`vencidas al abrir: ${eV.message}`);
        abrieronConVencido = idsDe(viejas as Fila[]);
      }
    }

    // Nada que hacer: el caso de casi todos los minutos. Sin leer los workspaces.
    if (!conVencidoFresco.length && !abrieronConVencido.length) return Response.json({ ok: true, negocios: 0 });

    const activos = new Set((await listarWorkspaces()).filter((w) => w.estado === 'activo').map((w) => w.id));
    const objetivo = negociosDelTick({ activos, conVencidoFresco, abrieronConVencido });
    if (url.searchParams.get('dry') === '1') return Response.json({ ok: true, modo: 'dry-run', desde, objetivo });

    // El tope de las esperas cortas, UNO para toda la ruta (lib/espera-duracion.ts).
    const esperarHastaMs = Date.now() + ESPERA_CORRIDA_HASTA_MS;
    const resultados: Array<{ ws: number; motivo: MotivoTick; [k: string]: unknown }> = [];
    for (const { ws, motivo } of objetivo) {
      try {
        const r = await runWithWorkspace(ws, () => conTurnoDelMotor(ws, async () => {
          // Con los dos canales apagados corre lo que no los usa: los pasos «⚡ Acción» y los mensajes
          // por Instagram o Messenger, que no tienen interruptor del negocio (`correSinCanales`, la
          // MISMA pregunta que hace la corrida de cada hora). Sin nada de eso, no hay nada que mover.
          const [waOn, emailOn] = await Promise.all([envioWhatsappHabilitado(), envioEmailHabilitado()]);
          if (!waOn && !emailOn && !(await getSecuenciasActivas()).some((s) => s.pasos.some(correSinCanales))) return { modo: 'off' };
          return procesarEnvios({ esperarHastaMs, cupoPorHora: true, ...(motivo === 'vencio' ? { vencidasDesde: desde } : {}) });
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

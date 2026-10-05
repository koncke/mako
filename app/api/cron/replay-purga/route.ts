// =============================================================================
// Cron: sella las grabaciones y borra las que vencieron
// =============================================================================
// Hace DOS trabajos, y sin los dos el replay crece para siempre:
//
//   1. SELLAR. Los lotes viven en `replay_lotes`, el buffer caliente, y NADIE
//      los borra solos. Acá se convierten en UN objeto gzip del bucket `replays`
//      y las filas se van. Cubre las dos formas de terminar: la sesión que avisó
//      (`fin_at`) y la HUÉRFANA, que es la que cerró el navegador de golpe y no
//      avisó nunca.
//   2. PURGAR. La retención es 30 días (= Clarity) y 180 si ese visitante
//      terminó en lead. ⚠️ Sin este cron eso es una constante que nadie aplica:
//      `REPLAY_RETENCION_DIAS` existía antes que esta ruta y no borraba nada.
//      «El almacenamiento no es el problema; lo que no tiene techo es no tener
//      retención.»
//
// POR QUÉ CADA 10 MINUTOS y no una vez por día: el paso 1 no es limpieza, es
// parte de la ingesta — una grabación no se puede mirar hasta que está sellada, y
// esperar hasta mañana para ver la sesión de esta mañana es no tener la feature.
// El paso 2 es barato (una consulta indexada que casi siempre devuelve cero
// filas), así que corre en la misma vuelta en vez de tener su propio cron.
//
// ⚠️ CUENTA TODO LO QUE HACE, y eso no es decoración: un proceso que limpia y no
// dice cuánto no se puede auditar. La respuesta trae, por workspace, cuántas
// selló, cuántas descartó el piso, cuántas borró, cuántos objetos y —la que más
// importa— cuántas CONSERVÓ por ser de un lead. Sin ese último número, la
// retención de 180 días es una promesa sin evidencia.
//
// ⚠️ ITERA TODOS LOS WORKSPACES ACTIVOS, SIN MIRAR EL APAGADOR. Un cliente que
// apagó la grabación ayer tiene las de la semana pasada todavía guardadas: si el
// cron le pasara por encima porque hoy dice `activo: false`, apagar el
// interruptor congelaría esas grabaciones para siempre. Lo normal, con el
// apagador en false en todos, es que no haya una sola fila y esto no haga nada.
// =============================================================================

import type { NextRequest } from 'next/server';
import { checkCronAuth } from '@/lib/cron-auth';
import { listarWorkspaces, runWithWorkspace } from '@/lib/workspace';
import {
  barrerLotesHuerfanos,
  configDeReplay,
  purgarVencidas,
  RESUMEN_TOPES,
  sellarPendientes,
} from '@/lib/replay-ingesta';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Tope de sesiones a sellar por workspace y por vuelta.
 *
 * Sellar una sesión es leer hasta 2 MiB, descomprimir N lotes, parsearlos,
 * re-comprimir y subir un objeto. Con `maxDuration = 60` es mejor sellar 40 cada
 * 10 minutos —240 por hora, que es 27 veces el pico medido de 8.893 visitas al
 * MES— que morir a los 60 segundos en la primera corrida grande y no sellar
 * ninguna. Lo que queda espera la vuelta siguiente.
 */
const TOPE_SELLAR = 40;

/** Tope de sesiones a purgar por workspace y por vuelta. Borrar es mucho más barato. */
const TOPE_PURGAR = 200;

type PorWs = {
  ws: number;
  selladas: number;
  descartadas: number;
  borradas: number;
  objetos: number;
  conservadasPorLead: number;
  lotesHuerfanos: number;
  retencionDias: number;
};

export async function GET(req: NextRequest) {
  const denied = checkCronAuth(req);
  if (denied) return denied;

  const tStart = Date.now();
  let workspaces;
  try {
    workspaces = (await listarWorkspaces()).filter((w) => w.estado === 'activo');
  } catch (e) {
    console.error('[cron:replay-purga] listarWorkspaces falló:', e);
    return Response.json({ ok: false, error: 'no se pudo listar workspaces' }, { status: 500 });
  }

  const porWs: PorWs[] = [];
  const errores: Array<{ ws: number; error: string }> = [];

  for (const w of workspaces) {
    try {
      const fila = await runWithWorkspace(w.id, async (): Promise<PorWs | null> => {
        const cfg = await configDeReplay();

        const sellado = await sellarPendientes(w.id, TOPE_SELLAR);
        for (const e of sellado.errores) errores.push({ ws: w.id, error: `sellar: ${e}` });

        const purga = await purgarVencidas(w.id, cfg, TOPE_PURGAR);
        for (const e of purga.errores) errores.push({ ws: w.id, error: `purga: ${e}` });

        const huerfanos = await barrerLotesHuerfanos();
        if (huerfanos.error) errores.push({ ws: w.id, error: `lotes huerfanos: ${huerfanos.error}` });

        const nada =
          !sellado.selladas && !sellado.descartadas && !purga.filas &&
          !purga.conservadasPorLead && !huerfanos.lotes;
        // Un workspace donde no había nada que hacer no entra al resumen: con el
        // apagador apagado en todos, eso serían nueve filas de ceros tapando la
        // única que hizo algo.
        if (nada) return null;

        return {
          ws: w.id,
          selladas: sellado.selladas,
          descartadas: sellado.descartadas,
          borradas: purga.filas,
          objetos: purga.objetos,
          conservadasPorLead: purga.conservadasPorLead,
          lotesHuerfanos: huerfanos.lotes,
          retencionDias: cfg.retencionDias,
        };
      });
      if (fila) porWs.push(fila);
    } catch (e) {
      errores.push({ ws: w.id, error: e instanceof Error ? e.message : String(e) });
    }
  }

  const suma = (k: keyof Omit<PorWs, 'ws' | 'retencionDias'>) =>
    porWs.reduce((a, f) => a + f[k], 0);

  const total = {
    selladas: suma('selladas'),
    descartadas: suma('descartadas'),
    borradas: suma('borradas'),
    objetos: suma('objetos'),
    conservadasPorLead: suma('conservadasPorLead'),
    lotesHuerfanos: suma('lotesHuerfanos'),
  };

  // Una línea por corrida, con los números. Es lo que permite contestar «¿el piso
  // está tirando demasiado?» mirando la proporción entre selladas y descartadas,
  // sin abrir la base.
  if (porWs.length || errores.length) {
    console.log(
      `[cron:replay-purga] ${RESUMEN_TOPES} · selladas=${total.selladas} ` +
      `descartadas_por_piso=${total.descartadas} borradas=${total.borradas} ` +
      `objetos=${total.objetos} conservadas_por_lead=${total.conservadasPorLead} ` +
      `lotes_huerfanos=${total.lotesHuerfanos} errores=${errores.length} ` +
      `(${Date.now() - tStart} ms)`,
    );
  }

  return Response.json({
    ok: true,
    ms: Date.now() - tStart,
    workspaces: workspaces.length,
    total,
    por_ws: porWs,
    errores,
  });
}

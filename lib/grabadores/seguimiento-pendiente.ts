// =============================================================================
// grabadores/seguimiento-pendiente — anotar y redactar el seguimiento que esperaba la transcripción (server)
// =============================================================================
// Las reglas, con test: ./seguimiento-pendiente-reglas.ts. Lo anota `alTerminarReunion` cuando el grabador avisó sin la
// transcripción (tl;dv); lo drena el cron del Closing (app/api/cron/closing-sync), UNO por ronda: una reunión que ya
// tiene transcripción se redacta (`redactarFollowUpPostLlamada`, con su anti-duplicado) y sale de la lista; una que
// todavía no, queda; una de más de 48 h, se suelta.
// =============================================================================

import 'server-only';
import { getSetting, setSetting } from '../settings';
import { redactarFollowUpPostLlamada } from '../post-llamada';
import { leerReunion } from './index';
import { leerRef } from './reunion';
import { GrabadorSinRespuestaError } from './errores';
import { KEY_ESPERAN_SEGUIMIENTO, conEspera, leerEsperas, vigentes, type EsperaSeguimiento } from './seguimiento-pendiente-reglas';

/** Anota que el seguimiento de esta reunión espera su transcripción. Nunca tira: si no se pudo, se dice en el log. */
export async function anotarEsperaDeSeguimiento(e: Omit<EsperaSeguimiento, 'desde'>): Promise<void> {
  try {
    const lista = leerEsperas(await getSetting(KEY_ESPERAN_SEGUIMIENTO));
    await setSetting(KEY_ESPERAN_SEGUIMIENTO, JSON.stringify(conEspera(vigentes(lista), { ...e, desde: new Date().toISOString() })));
  } catch (err) {
    console.error(`[post-llamada] no pude anotar que el seguimiento de ${e.ref} espera la transcripción: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Redacta UN seguimiento que esperaba su transcripción, si ya está. Lo llama el cron del Closing con su reloj: no arranca
 * si no entra el análisis entero (`reservaMs`). Nunca tira.
 */
export async function seguimientosQueEsperaban(opts: { deadline: number; reservaMs: number }): Promise<{ esperan: number; redactado: boolean }> {
  try {
    const guardada = leerEsperas(await getSetting(KEY_ESPERAN_SEGUIMIENTO));
    let lista = vigentes(guardada);
    let redactado = false;
    for (const e of [...lista].reverse()) {
      if (Date.now() + opts.reservaMs > opts.deadline) break;
      const ref = leerRef(e.ref);
      if (!ref) { lista = lista.filter((x) => x.ref !== e.ref); continue; }
      let conTexto = false;
      try {
        conTexto = !!(await leerReunion(ref))?.transcripcion?.length;
      } catch (err) {
        if (!(err instanceof GrabadorSinRespuestaError)) console.warn(`[post-llamada] ${e.ref}: ${err instanceof Error ? err.message : String(err)} — sigue esperando`);
      }
      if (!conTexto) continue;
      const fu = await redactarFollowUpPostLlamada(e.leadId, e.link, e.reunion);
      console.log(`[post-llamada] ${e.ref} lead=${e.leadId}: la transcripción llegó — ${fu.creado ? 'borrador creado' : `no (${fu.motivo})`}`);
      lista = lista.filter((x) => x.ref !== e.ref);
      redactado = true;
      break;
    }
    if (lista.length !== guardada.length) await setSetting(KEY_ESPERAN_SEGUIMIENTO, lista.length ? JSON.stringify(lista) : '');
    return { esperan: lista.length, redactado };
  } catch (err) {
    console.error(`[post-llamada] los seguimientos que esperaban la transcripción: ${err instanceof Error ? err.message : String(err)}`);
    return { esperan: 0, redactado: false };
  }
}

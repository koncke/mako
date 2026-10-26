// =============================================================================
// grabadores/al-terminar — lo que MaKo hace cuando un grabador AVISA que terminó una reunión
// =============================================================================
// Era el cuerpo del webhook de Fathom (app/api/webhooks/fathom/route.ts) y desde el 26/10/2026 lo comparten todos los
// grabadores que avisan (tl;dv, Fireflies, Zoom, Read AI): cada webhook verifica SU firma y resuelve SU negocio, arma la
// `Reunion` y llama acá. Lo de adentro no cambió:
//
//   1. EL PLAN se entera al terminar (16/10/2026, «Fathom sin fricción»): la misma lectura del cron de cada hora
//      (`procesarReunionesNuevas`), acotada a esta reunión. En `after()`: una lectura son minutos.
//   2. EL CRM: el invitado EXTERNO (su email) se cruza con un lead; R1 o R2 por la fecha; se marca la asistencia (sólo si
//      estaba sin marcar) y se guarda el link. Es el disparador «asistencia» del funnel.
//   3. Lo de después de una llamada (en `after()`): el borrador del seguimiento por WhatsApp y el aviso al dueño.
//
// Todos los ⚠️ que explican por qué es así siguen en el webhook de Fathom, que es donde se escribieron.
// =============================================================================

import 'server-only';
import { after } from 'next/server';
import { findLeadByContacto, applyFathomRecording } from '../leads';
import { isoToFechaTijuana } from '../calendly';
import { emitirDelCatalogo } from '../avisos';
import { dispararEvento } from '../flujos';
import { runWithWorkspace } from '../workspace';
import { redactarFollowUpPostLlamada } from '../post-llamada';
import { datosPostLlamada } from '../reunion-grabada';
import { esGrabacionDeEntrega } from '../insights-llamada-reparto';
import { procesarReunionesNuevas } from '../reunion-auto';
import { wsEnLaRonda } from '../cron-workspaces';
import { anotaLaAsistencia, claveDeReunionDelLead, duracionMin, invitadoHablo, refDeReunion, type GrabadorId, type Reunion } from './reunion';
import { GRABADORES_QUE_SE_LEEN, leerReunion, leerFicha } from './index';
import { GrabadorSinRespuestaError } from './errores';
import { anotarEsperaDeSeguimiento } from './seguimiento-pendiente';

export type ResultadoAlTerminar =
  | { ok: true; ignored: true; reason: string; email?: string }
  | { ok: true; lead_id: number; which: 'j1' | 'j2'; markedAsistencia: boolean; addedLink: boolean; attended: boolean | null };

/**
 * Lo que pasa cuando el grabador avisa que terminó `r`, para el negocio `ws` (ya resuelto y con la firma verificada).
 * `hasta` = el reloj de la función (epoch ms) que comparten la lectura del Plan y el seguimiento. `log` = el prefijo
 * del webhook en los logs.
 *
 * `yaEnSegundoPlano`: quien llama YA está adentro de un `after()` (Zoom pide la respuesta en 3 s, así que su webhook
 * contesta primero y lee la reunión después). Ahí lo de después de la llamada no se vuelve a diferir: se espera, para que
 * la función no termine con el trabajo a medias.
 *
 * `transcripcionPendiente`: el grabador avisó antes de tener la transcripción (tl;dv) y `r` es la FICHA. El CRM engancha
 * el link, pero el seguimiento no se redacta todavía: queda esperando (`seguimiento-pendiente.ts`) y lo redacta el cron
 * del Closing cuando la transcripción esté.
 */
export async function alTerminarReunion(ws: number, r: Reunion, opts: { hasta: number; log: string; yaEnSegundoPlano?: boolean; transcripcionPendiente?: boolean }): Promise<ResultadoAlTerminar> {
  const { log } = opts;
  const pendientes: Array<Promise<unknown>> = [];
  const despues = (fn: () => Promise<unknown>) => { if (opts.yaEnSegundoPlano) pendientes.push(fn()); else after(fn); };

  // 1) EL PLAN, antes de matchear el lead y por su cuenta: una reunión de EQUIPO no tiene invitado externo ni lead.
  despues(() => runWithWorkspace(ws, async () => {
    try {
      // La MISMA vara que el cron: activo y con un grabador conectado.
      if (!(await wsEnLaRonda(GRABADORES_QUE_SE_LEEN, ws))) {
        console.log(`${log} plan ws ${ws}: no está activo o no tiene un grabador conectado — no se lee`);
        return;
      }
      const res = await procesarReunionesNuevas(ws, { hasta: opts.hasta, max: 1, ...(Number.isFinite(r.clave) ? { soloRecording: r.clave } : {}) });
      console.log(`${log} plan ws ${ws} reunion=${r.grabador}:${r.id}: miradas=${res.miradas} alPlan=${res.alPlan} borradores=${res.conTareas} tareas=${res.tareas}${res.enCurso ? ' · ya la leía otro' : ''}`);
    } catch (e) {
      console.error(`${log} plan ws ${ws}: la lectura falló (${e instanceof Error ? e.message : String(e)}) — la levanta el cron`);
    }
  }));

  // 2) EL CRM — todo confinado al workspace resuelto.
  const resultado = await runWithWorkspace(ws, async (): Promise<ResultadoAlTerminar> => {
    const invitee = r.invitados.find((i) => i.externo === true && i.email) ?? null;
    if (!invitee?.email) {
      console.warn(`${log} sin invitado externo con email — ignorado`);
      return { ok: true, ignored: true, reason: 'sin invitado externo' };
    }

    const lead = await findLeadByContacto(invitee.email, null);
    if (!lead) {
      console.warn(`${log} sin lead para email=${invitee.email} — ignorado`);
      return { ok: true, ignored: true, reason: 'sin match de lead', email: invitee.email };
    }

    // R1 vs R2: por la fecha de la grabación contra las fechas del lead.
    const startIso = r.inicio || r.programada || null;
    const fecha = startIso ? isoToFechaTijuana(startIso) : null;

    // ⚠️ UNA SESIÓN DE ENTREGA NO ES UNA R2 (06/10/2026): ver el webhook de Fathom.
    if (esGrabacionDeEntrega({ fecha }, lead)) {
      console.log(`${log} lead id=${lead.id} sesión de ENTREGA (${fecha} > cierre ${lead.fecha_cierre}) — no es R2, no se engancha`);
      return { ok: true, ignored: true, reason: 'sesion de entrega' };
    }
    let which: 'j1' | 'j2' = 'j1';
    if (fecha && lead.fecha_junta_2 && fecha === lead.fecha_junta_2) which = 'j2';
    else if (fecha && lead.fecha_junta_1 && fecha === lead.fecha_junta_1) which = 'j1';
    else if (lead.fecha_junta_2 && lead.asistio_j1 != null) which = 'j2'; // R1 ya resuelta → es la R2

    // Asistencia: si el aviso trae transcripción, confirmamos que el invitado habló (null = no se puede saber). Un «no se
    // sabe» es «asistió» SÓLO con Fathom, que atribuye voces: con tl;dv o Fireflies un no-show quedaba «asistió»
    // (`anotaLaAsistencia`, revisión del tren m). Ahí se engancha el link y la asistencia queda para una persona o la T1.
    const attended = invitadoHablo(r, invitee.email);
    const link = r.linkCompartido ?? r.link ?? null;
    const res = await applyFathomRecording(lead, which, link, attended, { marcarAsistencia: anotaLaAsistencia(r.grabador, attended) });

    // Aviso al dueño: sólo la 1ª vez que el aviso aporta algo nuevo a ese lead (idempotente ante los reintentos).
    if (res.markedAsistencia || res.addedLink) {
      const nombre = invitee.nombre?.trim() || lead.nombre;
      const reunion = which === 'j1' ? 'R1' : 'R2';
      const dur = duracionMin(r);
      // ⚠️ LA MISMA REUNIÓN, DOS GRABADORES (revisión del tren m, 26/10/2026): con Fathom y tl;dv grabando la R1 llegan dos
      // avisos con links distintos, y los dos «agregaban» un link. La clave es del lead y la reunión, no del grabador: los
      // flujos del dueño corren UNA vez y el aviso sale UNO (el segundo link se guarda igual).
      const claveReunion = claveDeReunionDelLead(lead.id, which, fecha);
      // ⚠️ EL `ws` VA EXPLÍCITO (06/10/2026): `dispararEvento` no lee el workspace del contexto.
      await dispararEvento('reunion.ocurrio', { ws, leadId: lead.id, leadNombre: nombre, reunion, dedupKey: claveReunion });

      // Post-llamada: el análisis y el borrador del seguimiento (nunca un envío automático), y DESPUÉS el aviso al dueño.
      despues(() => runWithWorkspace(ws, async () => {
        if (attended !== false && opts.transcripcionPendiente) {
          // Sin transcripción el análisis sale vacío y el borrador no se hace nunca: queda esperando (revisión del tren m).
          await anotarEsperaDeSeguimiento({ ref: refDeReunion(r), leadId: lead.id, link, reunion });
          console.log(`${log} follow-up post-llamada lead=${lead.id}: espera la transcripción de ${r.grabador} (lo redacta el cron del Closing)`);
        } else if (attended !== false) {
          try {
            const fu = await redactarFollowUpPostLlamada(lead.id, link, reunion);
            console.log(`${log} follow-up post-llamada lead=${lead.id}: ${fu.creado ? 'borrador creado' : `no (${fu.motivo})`}`);
          } catch (err2) {
            console.error(`${log} follow-up post-llamada lead=${lead.id} falló: ${err2 instanceof Error ? err2.message : String(err2)}`);
          }
        }
        try {
          await emitirDelCatalogo('reunion-ocurrio-fathom', { lead: { id: lead.id, nombre }, datos: datosPostLlamada({ reunion, duracionMin: dur }), dedupKey: claveReunion, dedupTtlMin: 180 });
        } catch (err3) {
          console.error(`${log} aviso post-llamada lead=${lead.id} falló: ${err3 instanceof Error ? err3.message : String(err3)}`);
        }
      }));
    }

    console.log(`${log} lead id=${lead.id} ${which} asistencia=${res.markedAsistencia} link=${res.addedLink} attended=${attended ?? 'desconocido'}`);
    return { ok: true, lead_id: lead.id, which, ...res, attended };
  });
  await Promise.allSettled(pendientes);
  return resultado;
}

/**
 * El aviso de un grabador que dice SÓLO qué reunión terminó (tl;dv, Fireflies, Zoom): se pide la reunión entera por su
 * API, con la clave del negocio, y sigue `alTerminarReunion`. Lo que trae el aviso NO se usa como contenido: tl;dv no
 * firma sus avisos, y así un aviso falso, a lo sumo, hace leer una reunión que de verdad es de ese negocio.
 *
 * Corre dentro del `after()` del webhook (Zoom pide la respuesta en 3 s). Si la transcripción todavía no está (tl;dv
 * avisa MeetingReady antes de tenerla), espera y reintenta mientras el reloj deje lugar a lo de después; si no llega,
 * sigue con la FICHA: el CRM engancha el link ahora, el Plan la lee cuando esté (la reintenta el cron) y el seguimiento
 * queda esperando la transcripción (`transcripcionPendiente`).
 */
export async function leerYTerminar(ws: number, ref: { grabador: GrabadorId; id: string }, opts: { hasta: number; log: string }): Promise<void> {
  const { log } = opts;
  await runWithWorkspace(ws, async () => {
    try {
      if (!(await wsEnLaRonda(ref.grabador, ws))) {
        console.log(`${log} ws ${ws}: no está activo o no tiene ${ref.grabador} conectado — no se lee`);
        return;
      }
      let r: Reunion | null = null;
      let transcripcionPendiente = false;
      for (let intento = 1; ; intento++) {
        try {
          r = await leerReunion(ref);
          break;
        } catch (e) {
          if (!(e instanceof GrabadorSinRespuestaError)) throw e;
          if (!entraOtraEspera(intento, opts.hasta)) {
            console.warn(`${log} ws ${ws} ${ref.grabador}:${ref.id}: ${e.message} — sigo con la ficha (el Plan la lee cuando esté)`);
            r = await leerFicha(ref);
            transcripcionPendiente = true;
            break;
          }
          await new Promise((listo) => setTimeout(listo, ESPERA_TRANSCRIPCION_MS));
        }
      }
      if (!r) { console.warn(`${log} ws ${ws} ${ref.grabador}:${ref.id}: no pude leer la reunión — la levanta el cron`); return; }
      const res = await alTerminarReunion(ws, r, { hasta: opts.hasta, log, yaEnSegundoPlano: true, transcripcionPendiente });
      console.log(`${log} ws ${ws} ${ref.grabador}:${ref.id}: ${'lead_id' in res ? `lead ${res.lead_id} ${res.which}` : `sin lead (${res.reason})`}`);
    } catch (e) {
      console.error(`${log} ws ${ws} ${ref.grabador}:${ref.id}: falló (${e instanceof Error ? e.message : String(e)}) — la levanta el cron`);
    }
  });
}

/** Cuánto se espera entre un pedido de la transcripción y el siguiente, y cuántos se hacen. */
export const ESPERA_TRANSCRIPCION_MS = 30_000;
export const INTENTOS_TRANSCRIPCION = 4;
/** Lo que hay que dejar libre después de esperar: el análisis del seguimiento (una llamada a Claude, ~135 s) y algo más. */
const RESERVA_DESPUES_MS = 150_000;

/** ¿Entra otra espera por la transcripción antes del reloj, dejando lugar a lo de después? */
export const entraOtraEspera = (intento: number, hasta: number, ahora = Date.now()): boolean =>
  intento < INTENTOS_TRANSCRIPCION && ahora + ESPERA_TRANSCRIPCION_MS + RESERVA_DESPUES_MS <= hasta;

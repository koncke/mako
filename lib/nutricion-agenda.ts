/**
 * ¿LE TOCA INSCRIBIR A ESTA SECUENCIA, O TODAVÍA NO?
 *
 * Una secuencia se dispara de una de dos formas, y son excluyentes (es el control que
 * /mensajes ya tenía y que el 05/10/2026 se pidió también para el chatbot: «el CRON
 * está mal, lo habíamos hecho ya… con las 2 opciones por tiempo o por acción»):
 *
 *  · POR UNA ACCIÓN (`cron = null`) — como siempre: el cron horario inscribe a quien
 *    esté en la cohorte, y los enganches de evento (`enrolarPorEvento`) disparan al
 *    instante. Es lo que hacen hoy las 62 filas de la base, así que `cron = null`
 *    tiene que seguir devolviendo exactamente el comportamiento de antes.
 *  · POR TIEMPO (`cron` puesto) — la inscripción sólo ocurre en el horario agendado.
 *    El cron horario sigue corriendo igual; lo que esto hace es ABSTENERSE las 23
 *    corridas que no toca.
 *
 * ⚠️ VIVE EN UN MÓDULO PURO Y SIN `server-only` PARA QUE TENGA TEST. Si la condición
 * viviera adentro de `comprometerInscripciones` —que escribe en la base— ningún test
 * la podría importar, y terminaría siendo lo único sin red justo donde más duele: lo
 * que esto decide es si salen mensajes de WhatsApp.
 */

import { proximaOcurrencia, type CronAviso } from './cron-aviso';

/** Lo que la secuencia trae de la base para esta decisión. */
export type AgendaSecuencia = {
  /** El horario. `null` = se dispara por una acción, como siempre. */
  cron: CronAviso | null;
  /** La próxima ocurrencia AGENDADA, en ISO. `null` = nunca se sembró. */
  cronProximaAt: string | null;
};

export type DecisionAgenda = {
  /** Si esta corrida tiene que inscribir. */
  toca: boolean;
  /**
   * Lo que hay que escribir en `cron_proxima_at`, o `null` si no hay nada que
   * escribir. Se escribe con compare-and-set contra el valor leído: dos
   * invocaciones del mismo tick inscribirían dos veces, y eso ya se midió en esta
   * casa (21 pares duplicados el 27/09 por los 7-10 s que el envío retiene el HTTP).
   */
  proxima: string | null;
};

const fecha = (iso: string | null): Date | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * ⚠️ EL ANCLA ES LA OCURRENCIA AGENDADA, NUNCA `ahora`. Es la regla de la casa
 * («un horario que se repite se ancla en la OCURRENCIA ANTERIOR»): con `ahora` un
 * «los lunes a las 9» que corre 9:07 agenda el lunes siguiente 9:07, después 9:14,
 * y el horario se corre para siempre sin que nada falle. `proximaOcurrencia` además
 * se saltea las perdidas, así que un cron caído un día inscribe UNA vez y sigue en
 * su grilla.
 *
 * ⚠️ Y SEMBRAR NO ES DISPARAR. Una secuencia con horario y sin `cron_proxima_at`
 * —recién configurada, o una fila vieja— devuelve `toca: false` y la fecha a
 * escribir. Si sembrar disparara, poner un horario mandaría los mensajes en ese
 * mismo momento, que es lo contrario de lo que la persona acaba de pedir.
 */
export function decidirAgenda(sec: AgendaSecuencia, tz: string, ahora: Date = new Date()): DecisionAgenda {
  if (!sec.cron) return { toca: true, proxima: null };

  const proximaAt = fecha(sec.cronProximaAt);
  if (!proximaAt) {
    return { toca: false, proxima: proximaOcurrencia(sec.cron, ahora, tz, ahora).toISOString() };
  }
  if (proximaAt.getTime() > ahora.getTime()) return { toca: false, proxima: null };

  return { toca: true, proxima: proximaOcurrencia(sec.cron, proximaAt, tz, ahora).toISOString() };
}

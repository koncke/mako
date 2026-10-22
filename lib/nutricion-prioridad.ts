// =============================================================================
// nutricion-prioridad — lo que ENTRA sale antes que una campaña, dentro del mismo cupo (puro)
// =============================================================================
// 21/10/2026, la prospección del Sprint de Mauricio: «La campaña no le quita el cupo a la bienvenida». El tope de
// WhatsApp (40/día y 6/hora de fábrica, hasta 150 y 30) es UNO por negocio, y la cola era FIFO por `proximo_envio_at`:
// una campaña de 1.000 inscripta a las 10:00 se ponía delante del audio de «Un Lead Entró» de un lead de anuncios que
// llegaba a las 10:05, y a la tarde ya se había comido las 40 del día — la bienvenida salía mañana.
//
// Dos reglas, las dos a la vista en Configuraciones › Límites (`textoPrioridad`):
//   1. PRIMERO LO QUE ENTRA. En cada corrida, antes que el resto, las inscripciones de un lead que ENTRÓ o AGENDÓ en
//      las últimas `HORAS_ENTRADA` horas (`esEntradaFresca`). Es del LEAD y no de la automatización a propósito: la
//      campaña de un CRM de prospección cuelga de una etapa igual que «Un Lead Entró», y lo que las separa es que a
//      una la dispara alguien que acaba de llegar y a la otra, una lista de leads de hace meses.
//   2. LA CAMPAÑA DEJA LUGAR. Un WhatsApp a un lead que NO es entrada fresca usa el cupo menos una reserva
//      (`reservaParaEntradas`: una hora del cupo por hora, hasta `TOPE_RESERVA_DIA`, por día; y 1 por hora). Lo que
//      entra usa el cupo entero. Sin esto, ordenar no alcanza: el cupo del día se gasta de a poco a lo largo de la
//      tarde, y lo que entra después lo encuentra vacío.
// Lo de siempre que no cambia: el carril del recordatorio, las acciones y el email no pasan por el cupo de WhatsApp.
// =============================================================================

/** Cuántas horas «entró o agendó» cuenta como entrada fresca. */
export const HORAS_ENTRADA = 24;
/** El techo de la reserva diaria: con los topes altos (150/30), una hora entera serían 30 por día sin usar. */
export const TOPE_RESERVA_DIA = 10;

/** Lo que se lee del lead. `fecha_agenda` es una fecha (YYYY-MM-DD, el día que agendó). */
export type LeadParaPrioridad = { created_at?: string | null; fecha_agenda?: string | null };

/** El corte de la entrada fresca, en ms, y su fecha (para `fecha_agenda`, que no tiene hora). */
export function corteEntrada(ahoraMs: number): { ms: number; fecha: string } {
  const ms = ahoraMs - HORAS_ENTRADA * 3_600_000;
  return { ms, fecha: new Date(ms).toISOString().slice(0, 10) };
}

/** ¿Este lead entró o agendó hace menos de `HORAS_ENTRADA` horas? */
export function esEntradaFresca(lead: LeadParaPrioridad | null | undefined, ahoraMs: number): boolean {
  if (!lead) return false;
  const c = corteEntrada(ahoraMs);
  const alta = lead.created_at ? Date.parse(lead.created_at) : NaN;
  if (Number.isFinite(alta) && alta >= c.ms) return true;
  const agenda = typeof lead.fecha_agenda === 'string' ? lead.fecha_agenda.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(agenda) && agenda >= c.fecha;
}

/** Lo que una campaña le deja a lo que entra, por día y por hora, con los topes del negocio. */
export function reservaParaEntradas(wa: { dia: number; hora: number }): { dia: number; hora: number } {
  const dia = Math.max(0, Math.min(wa.hora, TOPE_RESERVA_DIA, wa.dia - 1));
  const hora = wa.hora >= 2 ? 1 : 0;
  return { dia, hora };
}

/**
 * EL CUPO DE UNA CAMPAÑA EN ESTA CORRIDA: el de la corrida (`cupo`, el mínimo entre la hora y el día) menos la reserva.
 * `presupuesto` = lo que queda del día; `enLaHora` = lo que ya salió en esta hora (0 fuera de las corridas del cron,
 * que no miran la hora). Nunca negativo.
 */
export function cupoDeCampana(o: { cupo: number; presupuesto: number; horaTope: number; enLaHora: number; reserva: { dia: number; hora: number }; porHora: boolean }): number {
  const porDia = o.presupuesto - o.reserva.dia;
  const porHora = o.porHora ? o.horaTope - o.enLaHora - o.reserva.hora : Number.POSITIVE_INFINITY;
  return Math.max(0, Math.min(o.cupo, porDia, porHora));
}

/** La línea de Configuraciones › Límites: la regla dicha, con los números del negocio. */
export function textoPrioridad(wa: { dia: number; hora: number }): string {
  const r = reservaParaEntradas(wa);
  const deja = [r.dia ? `${r.dia} por día` : '', r.hora ? `${r.hora} por hora` : ''].filter(Boolean).join(' y ');
  return `Primero lo que entra: a un lead que entró o agendó en las últimas ${HORAS_ENTRADA} h le sale antes que a una campaña.`
    + (deja ? ` La campaña le deja ${deja}.` : '');
}

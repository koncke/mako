// =============================================================================
// nutricion-prioridad — lo que ENTRA sale antes que una campaña, dentro del mismo cupo (puro)
// =============================================================================
// 21/10/2026, la prospección del Sprint de Mauricio: «La campaña no le quita el cupo a la bienvenida». El tope de
// WhatsApp (40/día y 6/hora de fábrica, hasta 150 y 30) es UNO por negocio, y la cola era FIFO por `proximo_envio_at`:
// una campaña de 1.000 inscripta a las 10:00 se ponía delante del audio de «Un Lead Entró» de un lead de anuncios que
// llegaba a las 10:05, y a la tarde ya se había comido las 40 del día — la bienvenida salía mañana.
//
// Dos reglas, las dos a la vista en Configuraciones › Límites (`textoPrioridad`):
//   1. PRIMERO LO QUE ENTRA. En cada corrida, antes que el resto, las inscripciones de un lead que ENTRÓ (por un canal:
//      un formulario, una landing, una agenda — `origen_lead`) o AGENDÓ en las últimas `HORAS_ENTRADA` horas
//      (`esEntradaFresca`). Un lead IMPORTADO o cargado a mano no es una entrada: sin el origen, una base fría importada
//      a la mañana y lanzada en campaña a la tarde contaba como «fresca» y se llevaba el cupo entero (revisión adversarial
//      del 21/10/2026). Es del LEAD y no de la automatización a propósito: la
//      campaña de un CRM de prospección cuelga de una etapa igual que «Un Lead Entró», y lo que las separa es que a
//      una la dispara alguien que acaba de llegar y a la otra, una lista de leads de hace meses.
//   2. LA CAMPAÑA DEJA LUGAR. Un WhatsApp a un lead que NO es entrada fresca usa el cupo menos una reserva
//      (`reservaParaEntradas`: una hora del cupo por hora, hasta `TOPE_RESERVA_DIA`, por día; y 1 por hora). Lo que
//      entra usa el cupo entero. Sin esto, ordenar no alcanza: el cupo del día se gasta de a poco a lo largo de la
//      tarde, y lo que entra después lo encuentra vacío.
// Lo de siempre que no cambia: el carril del recordatorio, las acciones y el email no pasan por el cupo de WhatsApp. El email
// tiene su propia reserva para los leads nuevos desde el 13/11/2026 (abajo, ticket #93).
// =============================================================================

/** Cuántas horas «entró o agendó» cuenta como entrada fresca. */
export const HORAS_ENTRADA = 24;
/** El techo de la reserva diaria: con los topes altos (150/30), una hora entera serían 30 por día sin usar. */
export const TOPE_RESERVA_DIA = 10;

/** Lo que se lee del lead. `fecha_agenda` es una fecha (YYYY-MM-DD, el día que agendó); `origen_lead`, por dónde entró. */
export type LeadParaPrioridad = { created_at?: string | null; fecha_agenda?: string | null; origen_lead?: string | null };

/** El corte de la entrada fresca, en ms, y su fecha (para `fecha_agenda`, que no tiene hora). */
export function corteEntrada(ahoraMs: number): { ms: number; fecha: string } {
  const ms = ahoraMs - HORAS_ENTRADA * 3_600_000;
  return { ms, fecha: new Date(ms).toISOString().slice(0, 10) };
}

/** ¿Este lead entró por un canal, o agendó, hace menos de `HORAS_ENTRADA` horas? */
export function esEntradaFresca(lead: LeadParaPrioridad | null | undefined, ahoraMs: number): boolean {
  if (!lead) return false;
  const c = corteEntrada(ahoraMs);
  const alta = lead.created_at ? Date.parse(lead.created_at) : NaN;
  const porUnCanal = typeof lead.origen_lead === 'string' && lead.origen_lead.trim() !== '';
  if (porUnCanal && Number.isFinite(alta) && alta >= c.ms) return true;
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
  return `Primero lo que entra: a un lead que llegó por un formulario, una landing o una agenda, o que agendó, en las últimas ${HORAS_ENTRADA} h le sale antes que a una campaña.`
    + (deja ? ` La campaña le deja ${deja}.` : '');
}

// =============================================================================
// EL EMAIL TAMBIÉN DEJA LUGAR (13/11/2026, ticket #93)
// =============================================================================
// El tope de email del negocio también es UNO (hasta 500 por día, rodante) y lo de arriba sólo cuidaba el de WhatsApp. El
// 12/11 la lista fría de Mauricio («Sprint correos · Fríos», 853 leads de junio a octubre, inscriptos de una vez) mandó 398
// emails a las 7 de Tijuana —su horario propio— y a las 9, cuando abre el de «Leads calientes · Email», quedaban ~100: 34 de
// los 67 leads nuevos nunca recibieron el suyo. Ordenar no alcanza (a las 7 los calientes todavía no podían salir).
//   · CALIENTE, para el email: entró por un canal (`origen_lead`) hace menos de `DIAS_CALIENTE_EMAIL`, o es entrada fresca
//     (agendó). Son días y no las 24 h del WhatsApp: los emails de una secuencia de bienvenida siguen varios días.
//   · LA LISTA FRÍA DEJA LUGAR: un email a quien no es caliente usa el presupuesto del día MENOS la reserva
//     (`RESERVA_EMAIL_CALIENTES` del tope de hoy); a un caliente, el presupuesto entero. Sin ningún caliente en el negocio, no
//     se reserva nada: una campaña sola usa su tope entero.
// =============================================================================

/** Cuántos días un lead que entró por un canal cuenta como CALIENTE para el email. */
export const DIAS_CALIENTE_EMAIL = 7;
/** La parte del tope de email del día que una lista fría le deja a los calientes (de 500, 100). */
export const RESERVA_EMAIL_CALIENTES = 0.2;

/** El corte de «caliente» para el email, en ms. */
export const corteCalienteEmail = (ahoraMs: number): number => ahoraMs - DIAS_CALIENTE_EMAIL * 86_400_000;

/** ¿Un email a este lead va antes que una lista fría? Entró por un canal en los últimos días, o es entrada fresca (agendó). */
export function esCalienteParaEmail(lead: LeadParaPrioridad | null | undefined, ahoraMs: number): boolean {
  if (!lead) return false;
  if (esEntradaFresca(lead, ahoraMs)) return true;
  const alta = lead.created_at ? Date.parse(lead.created_at) : NaN;
  const porUnCanal = typeof lead.origen_lead === 'string' && lead.origen_lead.trim() !== '';
  return porUnCanal && Number.isFinite(alta) && alta >= corteCalienteEmail(ahoraMs);
}

/** Lo que la lista fría le deja a los calientes del tope de email de hoy. Sin calientes, nada. Nunca el tope entero. */
export function reservaEmailParaCalientes(o: { topeDia: number; hayCalientes: boolean }): number {
  if (!o.hayCalientes || o.topeDia <= 1) return 0;
  return Math.min(o.topeDia - 1, Math.floor(o.topeDia * RESERVA_EMAIL_CALIENTES));
}

/** ¿Un email más a este lead ya no entra en la corrida? `presupuesto`: lo que queda del tope de hoy; `enCorrida`: lo que ya salió. */
export function emailSinLugar(o: { caliente: boolean; enCorrida: number; presupuesto: number; reserva: number }): boolean {
  return o.enCorrida >= (o.caliente ? o.presupuesto : o.presupuesto - o.reserva);
}

/** La línea de «ver los límites» del email: la regla, con el tope del negocio. */
export function textoPrioridadEmail(topeDia: number): string {
  const r = reservaEmailParaCalientes({ topeDia, hayCalientes: true });
  return `Primero los leads nuevos: a quien entró por un formulario, una landing o una agenda en los últimos ${DIAS_CALIENTE_EMAIL} días le sale el email antes que a una lista fría.`
    + (r ? ` Una lista fría usa como mucho ${topeDia - r} de los ${topeDia} del día: los otros ${r} quedan para los leads nuevos.` : '');
}

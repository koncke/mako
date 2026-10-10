/**
 * ¿CUÁL evento de Google Calendar es la reunión de ESTE lead?
 *
 * Es la decisión que define a qué evento le pega un PATCH con `sendUpdates=all`
 * (`moverEventoDeReunion`, lib/google-calendar.ts): elegir mal le mueve la agenda al
 * dueño y le manda un aviso de cambio a gente que no tiene nada que ver. Vive acá, SIN
 * `server-only`, para que tenga test: adentro de google-calendar.ts no la podía
 * importar ninguno, y era lo único sin red justo donde más duele.
 *
 * ⚠️ Medido el 09/10/2026, grabando el video de la verificación de Google: reagendar
 * desde el CRM a un lead de prueba MOVIÓ la instancia del jueves 8 a las 15:00 de una
 * serie recurrente del dueño («Sprint 4», sin invitados) al domingo 12 a las 10:00. Dos
 * de las tres reglas de antes la aceptaban:
 *   · «arranca a ±10 min de la reunión vieja»: la hora sola no prueba nada — cualquier
 *     cosa que el dueño tenga a esa hora pasa;
 *   · «el lead está invitado»: el lead tenía el email del DUEÑO de la agenda, y el dueño
 *     figura como invitado (`self: true`) en sus propios eventos.
 * Las dos se fueron. El diagnóstico obvio («la ventana de 10 minutos es muy ancha») era
 * el equivocado: con cualquier ventana, la hora sola sigue sin decir de quién es.
 */

export type InvitadoCrudo = { email?: string; self?: boolean; resource?: boolean };
export type EventoParaElegir = {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  attendees?: InvitadoCrudo[];
};

const normEmail = (s: string | null | undefined): string => (s ?? '').trim().toLowerCase();

export const normTxt = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * ¿El título del evento y el que traemos hablan de lo mismo? `includes` en las
 * dos direcciones porque uno suele contener al otro («Juan Pérez» dentro de
 * «Llamada con Juan Pérez»). Pide 4 caracteres: con menos, cualquier evento
 * matchea con cualquier cosa.
 */
export function titulosParecidos(a: string, b: string): boolean {
  const x = normTxt(a);
  const y = normTxt(b);
  if (x.length < 4 || y.length < 4) return false;
  return x.includes(y) || y.includes(x);
}

/** Los invitados que son PERSONAS ajenas a la agenda: ni el dueño (`self`) ni una sala. */
const invitadosDeVerdad = (e: EventoParaElegir): InvitadoCrudo[] =>
  (e.attendees ?? []).filter((a) => !a.self && !a.resource && !!normEmail(a.email));

/**
 * El lead está invitado al evento — y NO como el dueño de la agenda. Un lead con el email
 * del dueño (uno de prueba, o el dueño cargado como lead) «está invitado» a todo lo que el
 * dueño tiene, porque Google lo lista en sus propios eventos con `self: true`.
 */
export function leadInvitado(e: EventoParaElegir, email: string | null | undefined): boolean {
  const em = normEmail(email);
  if (!em) return false;
  return invitadosDeVerdad(e).some((a) => normEmail(a.email) === em);
}

/**
 * El evento tiene invitados de verdad y el lead —cuyo email sabemos— no está entre ellos:
 * es una reunión con OTRA persona, por más que el título se parezca. Sin email del lead no
 * se puede afirmar nada y no veta.
 */
export function esConOtraPersona(e: EventoParaElegir, email: string | null | undefined): boolean {
  const em = normEmail(email);
  if (!em) return false;
  const otros = invitadosDeVerdad(e);
  return otros.length > 0 && !otros.some((a) => normEmail(a.email) === em);
}

/**
 * El evento de la reunión, o null si ninguno lo prueba. Deliberadamente EXIGENTE: ante la
 * duda no se encuentra nada, y el caller crea un evento nuevo (recuperable) o dice que no
 * lo encontró — nunca mueve algo ajeno.
 *
 * Prueba que un evento es el de la reunión, y nada más:
 *   · el lead está invitado (no como el dueño), o
 *   · el título se parece al que traemos Y el evento no es una reunión con otra persona.
 * La cercanía a la hora vieja sólo DESEMPATA entre los que ya probaron algo.
 */
export function elegirEventoDeReunion<T extends EventoParaElegir>(
  items: T[],
  p: { email?: string | null; titulo?: string | null; t0: number },
): T | null {
  const distancia = (e: T): number => {
    const st = Date.parse(e.start?.dateTime ?? e.start?.date ?? '');
    // Sin inicio legible, lejos de todo pero sin tapar la prueba: la ventana más ancha que
    // se lista es de 24 h (8,6e7 ms), muy por debajo del escalón de 1e15 entre pruebas.
    return Number.isFinite(st) ? Math.abs(st - p.t0) : 1e14;
  };
  let mejor: { e: T; score: number } | null = null;
  for (const e of items) {
    const porInvitado = leadInvitado(e, p.email);
    const porTitulo = !!p.titulo && titulosParecidos(e.summary ?? '', p.titulo) && !esConOtraPersona(e, p.email);
    if (!porInvitado && !porTitulo) continue;
    // El invitado manda sobre el título; a igualdad, el que arranca más cerca de la hora vieja.
    const score = (porInvitado ? 2 : 1) * 1e15 - distancia(e);
    if (!mejor || score > mejor.score) mejor = { e, score };
  }
  return mejor?.e ?? null;
}

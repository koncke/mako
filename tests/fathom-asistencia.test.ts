// =============================================================================
// La asistencia que deduce el webhook de Fathom
// =============================================================================
// `matched_calendar_invitee_email` es la HEURÍSTICA de Fathom (matchea el nombre
// del invitado del calendario contra el display name de quien habla), no un hecho
// sobre la asistencia. Leer su null como "no vino" mandó a Nutrición No Show una
// R1 de 64 minutos con 218 turnos del prospecto.
//
// Los casos de acá salen del payload REAL de esa llamada (lead 1696, 12/08/2026).
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inviteeSpoke, externalInvitee, type FathomWebhookPayload } from '../lib/fathom';

const HOST = 'mbustos@elevate.com.mx';
const LEAD = 'contacto@prosesamed.com';

/** El payload tal cual lo manda Fathom, con los hablantes que se le pasen. */
const P = (speakers: Array<string | null>, extra: Partial<FathomWebhookPayload> = {}): FathomWebhookPayload => ({
  recorded_by: { name: 'Mauricio Bustos Eguia', email: HOST },
  calendar_invitees: [
    // OJO: el `name` del invitado ES el email — una casilla genérica. Por eso
    // Fathom nunca lo matchea contra «Fernando», la persona real en la llamada.
    { name: LEAD, email: LEAD, is_external: true },
    { name: 'Mauricio Bustos Eguia', email: HOST, is_external: false },
  ],
  transcript: speakers.map((s) => ({ speaker: { matched_calendar_invitee_email: s } })),
  ...extra,
});

test('EL CASO: el prospecto habló 218 veces pero Fathom no lo matcheó → no se afirma nada', () => {
  // 540 turnos: 322 del host (matcheados) y 218 de «Fernando» (sin matchear).
  const payload = P([...Array(322).fill(HOST), ...Array(218).fill(null)]);
  assert.equal(inviteeSpoke(payload, LEAD), null, 'un hablante sin matchear puede ser el invitado: no se sabe');
});

test('cuando Fathom SÍ matchea al invitado, es certeza de que asistió', () => {
  assert.equal(inviteeSpoke(P([HOST, LEAD, HOST]), LEAD), true);
  // Y no se cuelga de mayúsculas ni espacios.
  assert.equal(inviteeSpoke(P([HOST, ' Contacto@Prosesamed.com ']), LEAD), true);
});

test('la ausencia SOLO se afirma si el transcript prueba que habló gente de casa', () => {
  // El host solo, esperando a alguien que nunca llegó: eso sí es un No Show.
  assert.equal(inviteeSpoke(P([HOST, HOST, HOST]), LEAD), false);
  // Host + un colega interno matcheado: sigue siendo todo gente de casa.
  const conInterno = P([HOST, 'ana@elevate.com.mx'], {
    calendar_invitees: [
      { name: LEAD, email: LEAD, is_external: true },
      { name: 'Ana', email: 'ana@elevate.com.mx', is_external: false },
    ],
  });
  assert.equal(inviteeSpoke(conInterno, LEAD), false);
  // Pero con UNA sola voz sin identificar, ya no se puede afirmar.
  assert.equal(inviteeSpoke(P([HOST, HOST, null]), LEAD), null);
});

test('sin transcript no se deduce nada (y el caller asume que asistió: hubo grabación)', () => {
  assert.equal(inviteeSpoke(P([]), LEAD), null);
  assert.equal(inviteeSpoke({ recorded_by: { email: HOST } }, LEAD), null);
});

test('un hablante SIN speaker tampoco autoriza a afirmar la ausencia', () => {
  // Entradas sin `speaker` (o con el campo vacío) no son "gente de casa": si el
  // `every` las diera por buenas, un transcript mal formado se leería como No Show.
  const roto: FathomWebhookPayload = { recorded_by: { email: HOST }, transcript: [{}, { speaker: {} }] };
  assert.equal(inviteeSpoke(roto, LEAD), null);
});

test('el invitado externo sigue saliendo del payload aunque su nombre sea un email', () => {
  assert.equal(externalInvitee(P([]))?.email, LEAD);
});

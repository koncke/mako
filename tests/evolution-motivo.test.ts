// =============================================================================
// El MOTIVO de un envío rechazado por Evolution, con el cuerpo MEDIDO
// =============================================================================
// 12/10/2026. En «Probar» con envío real se leía «No salió · Evolution 400» y parecía Railway
// sin pagar. Era un número sin WhatsApp: Evolution lo dice anidado en `response.message`, y
// `evFetch` sólo miraba `body.message` (docs/hallazgos-comunicacion.md, «No salió · Evolution 400»).
//
// PROBADO ROMPIÉNDOLO: con `motivoDeEvolution` leyendo sólo `body.message` (el lector viejo de
// `evFetch`) fallan 2 de 4 (el cuerpo medido da «Evolution 400» y el mensaje anidado no llega);
// con los envíos devolviendo `r.error` en vez de `r.motivo` falla 1 de 4 (el cableado). Con el
// código de hoy, 4 de 4.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { motivoDeEvolution } from '../lib/evolution-sonda';

// La forma en que Evolution 2.3.7 contesta un envío a un número sin WhatsApp (el destino del 12/10/2026).
const SIN_WHATSAPP_400 = {
  status: 400, error: 'Bad Request',
  response: { message: [{ exists: false, jid: '526881405022@s.whatsapp.net', number: '526881405022' }] },
};

test('un número sin WhatsApp lo dice, no «Evolution 400»', () => {
  assert.equal(motivoDeEvolution(400, SIN_WHATSAPP_400), 'Ese número no tiene WhatsApp');
});

test('un 400 sin cuerpo cae a «Evolution 400»', () => {
  assert.equal(motivoDeEvolution(400, {}), 'Evolution 400'); // `evFetch` parsea un texto vacío como {}
  assert.equal(motivoDeEvolution(400, ''), 'Evolution 400');
  assert.equal(motivoDeEvolution(400, undefined), 'Evolution 400');
  assert.equal(motivoDeEvolution(502, '<html>Bad Gateway</html>'), 'Evolution 502');
});

test('cualquier otro mensaje llega como texto, arriba o anidado', () => {
  assert.equal(
    motivoDeEvolution(500, { status: 500, error: 'Internal Server Error', response: { message: ['Error updating profile name', 'Error: Connection Closed'] } }),
    'Error updating profile name · Error: Connection Closed',
  );
  assert.equal(motivoDeEvolution(401, { message: 'Unauthorized' }), 'Unauthorized');
});

// Los tres envíos tienen `server-only` y no se pueden importar acá: se mira que devuelvan el motivo.
test('enviarTexto, enviarMedia y enviarAudio devuelven el motivo', () => {
  const src = readFileSync(new URL('../lib/evolution.ts', import.meta.url), 'utf8');
  for (const fn of ['enviarTexto', 'enviarMedia', 'enviarAudio']) {
    const desde = src.indexOf(`export async function ${fn}(`);
    assert.ok(desde >= 0, `no encontré ${fn}`);
    const resto = src.slice(desde);
    const cuerpo = resto.slice(0, resto.search(/\n\}\r?\n/));
    assert.match(cuerpo, /error: r\.motivo \?\? r\.error/, `${fn} volvió a devolver el error sin motivo`);
  }
  assert.match(src, /motivo: motivoDeEvolution\(res\.status, body\)/, 'evFetch ya no arma el motivo');
});

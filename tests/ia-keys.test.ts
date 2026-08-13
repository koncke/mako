// =============================================================================
// El nombre de una cuenta extra es un CONTRATO, no una convención
// =============================================================================
// `GEMINI_API_KEY_2` lo escriben tres capas que no se ven entre sí: el catálogo de
// /integraciones (el input), `credenciales` (la fila cifrada) y la cascada (a quién
// le pega). Si una deriva el nombre distinto que otra, la key se guarda y NUNCA se
// usa — que es el modo de falla clásico de este repo: se ve conectada y no corre.
// Y `slotDe` decide qué número se guarda en `anthropic_usage.cuenta`, o sea de qué
// cuenta se descuenta la cuota.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLAVES_EXTRA, MAX_KEYS, claveBaseDe, clavesDe, slotDe } from '../lib/ia-keys';

test('la primera clave es la de siempre (no se le renombra a nadie su key)', () => {
  assert.equal(clavesDe('gemini')[0], 'GEMINI_API_KEY');
  assert.equal(clavesDe('groq')[0], 'GROQ_API_KEY');
});

test('las extra son <BASE>_2 … _N y son exactamente MAX_KEYS', () => {
  assert.deepEqual(clavesDe('gemini'), ['GEMINI_API_KEY', 'GEMINI_API_KEY_2', 'GEMINI_API_KEY_3']);
  assert.equal(clavesDe('gemini').length, MAX_KEYS);
});

test('un proveedor sin multi-key no inventa claves', () => {
  assert.deepEqual(clavesDe('anthropic'), []);
  assert.deepEqual(clavesDe('openai'), []);
});

test('el nº de cuenta sale del NOMBRE, y es el que se descuenta de la cuota', () => {
  assert.equal(slotDe('GEMINI_API_KEY'), 1);
  assert.equal(slotDe('GEMINI_API_KEY_2'), 2);
  assert.equal(slotDe('GEMINI_API_KEY_3'), 3);
  // El índice en `clavesDe` y `slotDe` tienen que dar lo MISMO: la cascada usa el
  // índice y el registro de uso usa slotDe. Si divergen, el gauge descuenta de la
  // cuenta equivocada y el reparto que muestra es mentira.
  for (const c of clavesDe('gemini')) assert.equal(slotDe(c), clavesDe('gemini').indexOf(c) + 1);
});

test('una clave que TERMINA en número pero no es extra no se confunde', () => {
  // No hay ninguna hoy, pero el día que exista (`X_2FA`, `PANDA_V2`) el parser no
  // puede decidir por la forma: decide la lista.
  assert.equal(slotDe('META_API_2'), 1);
  assert.equal(claveBaseDe('META_API_2'), 'META_API_2');
  assert.equal(claveBaseDe('GEMINI_API_KEY_2'), 'GEMINI_API_KEY');
  assert.equal(claveBaseDe('GEMINI_API_KEY'), 'GEMINI_API_KEY');
});

test('CLAVES_EXTRA no incluye ninguna base (si no, la whitelist pediría la 1 dos veces)', () => {
  for (const c of CLAVES_EXTRA) assert.notEqual(slotDe(c), 1, `${c} entró como extra siendo la base`);
});

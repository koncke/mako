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
  assert.equal(clavesDe('gemini')[0], 'GEMINI_API_KEY');
  assert.equal(clavesDe('gemini')[1], 'GEMINI_API_KEY_2');
  assert.equal(clavesDe('gemini').at(-1), `GEMINI_API_KEY_${MAX_KEYS}`);
  assert.equal(clavesDe('gemini').length, MAX_KEYS);
  // Sin huecos ni repetidas: esta lista ES la whitelist del API. Una repetida sería
  // una key que la UI ofrece dos veces; un hueco, una que ofrece y el server rechaza.
  assert.equal(new Set(clavesDe('gemini')).size, MAX_KEYS);
});

test('el tope alcanza para lo que se consume hoy', () => {
  // 250k tokens/día por cuenta (LIMITES_PROVEEDOR.gemini en lib/ia-cuotas.ts) contra
  // ~860k/día medidos en el ws1 (agosto 2026). Si alguien baja MAX_KEYS, este test
  // dice por qué no se puede — el número no es estético, cubre un consumo real.
  assert.ok(MAX_KEYS * 250_000 > 860_000, 'MAX_KEYS no cubre el consumo diario medido del ws1');
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

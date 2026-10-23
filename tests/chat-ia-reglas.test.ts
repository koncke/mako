// =============================================================================
// Con qué IA corre UN chat: el contrato entre la caja y el turno (23/10/2026, feedback 8b)
// =============================================================================
// Martín: el «+» de la caja deja elegir con qué corre ese chat (el modelo y la cuenta); por defecto decide el chat jefe.
// Acordado con el chat IA del cliente: la caja manda `ia`, la ruta lo sanea y lo valida contra las cuentas del negocio, y
// `turnoApp` lo respeta. Acá, lo puro (lib/chat-ia-reglas.ts):
//   1. `sanearIA`: sólo una cuenta conocida y, si trae modelo, uno que esa cuenta acepta; lo demás es Automático (null);
//   2. los modelos por cuenta son los de sus configuraciones (MODELOS_PC; las de su Claude, IA5);
//   3. lo guardado por chat vale mientras esa cuenta se pueda elegir, y el renglón dice con qué va.
//
// Correr: node --import tsx --test tests/chat-ia-reglas.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { MODELOS_DE_LA_CUENTA, MODELOS_SU_CLAUDE, eleccionVigente, resumenDeIA, sanearIA, type CuentaDeIA } from '../lib/chat-ia-reglas';
import { MODELOS_PC } from '../lib/ia-pc-reglas';
import { MODELO_SU_CLAUDE } from '../lib/veto-claude';

test('1. sanearIA: sólo una cuenta conocida y un modelo que esa cuenta acepta; lo demás, Automático', () => {
  for (const nada of [undefined, null, '', '   ', 'pc', 42, [], ['pc'], {}, { cuenta: 'gemini' }, { cuenta: 'constructor' }, '{"cuenta":', 'x'.repeat(500)]) {
    assert.equal(sanearIA(nada), null, `Automático: ${JSON.stringify(nada)?.slice(0, 40)}`);
  }
  assert.deepEqual(sanearIA({ cuenta: 'pc' }), { cuenta: 'pc' });
  assert.deepEqual(sanearIA({ cuenta: 'pc', modelo: 'opus' }), { cuenta: 'pc', modelo: 'opus' });
  assert.deepEqual(sanearIA({ cuenta: 'pc', modelo: 'gpt-5' }), { cuenta: 'pc' }, 'un modelo que la cuenta no acepta no viaja');
  assert.deepEqual(sanearIA({ cuenta: 'anthropic', modelo: 'sonnet' }), { cuenta: 'anthropic', modelo: 'sonnet' });
  assert.deepEqual(sanearIA({ cuenta: 'anthropic', modelo: 'opus' }), { cuenta: 'anthropic' }, 'su Claude por clave: Haiku o Sonnet');
  assert.deepEqual(sanearIA({ cuenta: 'anthropic', modelo: 'constructor' }), { cuenta: 'anthropic' }, 'ni lo heredado');
  assert.deepEqual(sanearIA({ cuenta: 'openai', modelo: 'gpt-4o' }), { cuenta: 'openai' }, 'OpenAI, por ahora, sin elegir modelo');
  assert.deepEqual(sanearIA('{"cuenta":"anthropic","modelo":"haiku"}'), { cuenta: 'anthropic', modelo: 'haiku' }, 'el JSON de un multipart');
  assert.deepEqual(sanearIA({ cuenta: 'pc', modelo: 'haiku', otra: 'cosa' }), { cuenta: 'pc', modelo: 'haiku' }, 'sólo lo del contrato');
});

test('2. los modelos por cuenta son los de sus configuraciones', () => {
  assert.deepEqual([...MODELOS_DE_LA_CUENTA.pc], [...MODELOS_PC]);
  assert.deepEqual([...MODELOS_SU_CLAUDE].sort(), Object.keys(MODELO_SU_CLAUDE).sort(), 'los de su Claude (IA5): si cambian allá, cambian acá');
  assert.deepEqual([...MODELOS_DE_LA_CUENTA.openai], []);
});

test('3. lo guardado vale mientras se pueda elegir; el renglón dice con qué va', () => {
  const cuentas: CuentaDeIA[] = [
    { cuenta: 'pc', nombre: 'Tu computadora (Oficina)', modelos: ['sonnet', 'opus', 'haiku'], modeloDefault: 'sonnet' },
    { cuenta: 'anthropic', nombre: 'Tu Claude', modelos: ['haiku'], modeloDefault: 'haiku', soloHaiku: true },
  ];
  assert.deepEqual(eleccionVigente({ cuenta: 'pc', modelo: 'opus' }, cuentas), { cuenta: 'pc', modelo: 'opus' });
  assert.equal(eleccionVigente({ cuenta: 'openai' }, cuentas), null, 'una cuenta que ya no está: Automático');
  assert.deepEqual(eleccionVigente({ cuenta: 'anthropic', modelo: 'sonnet' }, cuentas), { cuenta: 'anthropic' }, 'sólo Haiku: el modelo no vale');
  assert.equal(eleccionVigente({ cuenta: 'pc' }, null), null, 'sin la lista, Automático');
  assert.equal(resumenDeIA({ cuenta: 'pc', modelo: 'opus' }, cuentas), 'Con tu computadora (Oficina) · Opus');
  assert.equal(resumenDeIA({ cuenta: 'anthropic' }, cuentas), 'Con tu Claude');
  assert.equal(resumenDeIA(null, cuentas), null, 'en Automático no se dice nada');
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 3/0):
//   · pasa cualquier modelo                            → 2/1 (1)
//   · pasa cualquier cuenta                            → 2/1 (1)
//   · los de su Claude se desvían de IA5               → 1/2 (1, 2)
//   · lo guardado vale aunque la cuenta ya no esté     → 2/1 (3)

// =============================================================================
// Los campos de salida que la capa barata le manda a cada modelo (23/10/2026, «Tu ChatGPT» con modelo a elegir)
// =============================================================================
// La capa barata mandaba `max_tokens` y `temperature: 0.2` a todo. Con `gpt-4o-mini` andaba, y era el único modelo de OpenAI
// que corría; los modelos con razonamiento (o1/o3, GPT-5 en adelante) contestan 400 a los dos. Darle a «Tu ChatGPT» un modelo
// capaz cambiando sólo el NOMBRE rompía cada turno. Acá, lo puro (lib/ai-cheap-techo.ts → `paramsDeSalida`).
//
// Correr: node --import tsx --test tests/openai-razonador.test.ts
// PROBADO ROMPIÉNDOLO, ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { AIRE_RAZONAMIENTO, esRazonadorOpenAI, paramsDeSalida } from '../lib/ai-cheap-techo';

const openai = { nombre: 'openai' };

test('1. qué modelos razonan: o-series y GPT-5 en adelante; los «-chat» y los de antes, no', () => {
  for (const m of ['gpt-5.6-luna', 'gpt-6-luna', 'gpt-6.1-sol', 'gpt-5', 'gpt-5.4-mini', 'o3', 'o4-mini', 'gpt-10']) {
    assert.equal(esRazonadorOpenAI(m), true, m);
  }
  for (const m of ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini', 'gpt-3.5-turbo', 'gpt-5-chat-latest', 'omni-moderation-latest']) {
    assert.equal(esRazonadorOpenAI(m), false, m);
  }
});

test('2. a un modelo de OpenAI con razonamiento: max_completion_tokens con aire, y sin temperature', () => {
  const p = paramsDeSalida(openai, 'gpt-5.6-luna', 1400, 0.2);
  assert.deepEqual(p, { max_completion_tokens: 1400 + AIRE_RAZONAMIENTO });
  assert.ok(!('max_tokens' in p) && !('temperature' in p), 'viajaría un campo que el modelo rechaza con 400');
  assert.deepEqual(paramsDeSalida(openai, 'gpt-6-luna', 30_000, 0.2), { max_completion_tokens: 16_384 }, 'sin techo propio, el más chico');
});

test('3. a los demás, lo de siempre: max_tokens con el techo de OpenAI, y la temperatura que se pidió', () => {
  assert.deepEqual(paramsDeSalida(openai, 'gpt-4o-mini', 32_000, 0.2), { max_tokens: 16_384, temperature: 0.2 });
  assert.deepEqual(paramsDeSalida({ nombre: 'gemini' }, 'gemini-flash-latest', 1400, 0), { max_tokens: 1400, temperature: 0 });
  // `openai/gpt-oss-20b` es de Groq: el nombre del modelo no decide, decide el proveedor.
  assert.deepEqual(paramsDeSalida({ nombre: 'groq' }, 'openai/gpt-oss-20b', 1400, 0.2), { max_tokens: 1400, temperature: 0.2 });
  assert.deepEqual(paramsDeSalida({ nombre: 'groq' }, 'gpt-5-que-no-es-de-openai', 1400, 0.2), { max_tokens: 1400, temperature: 0.2 });
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 3/0):
//   · `paramsDeSalida` sin la rama de razonamiento          → 2/1 (2)
//   · `esRazonadorOpenAI` sin excluir los «-chat»            → 2/1 (1)
//   · la rama de razonamiento sin mirar el proveedor         → 2/1 (3)

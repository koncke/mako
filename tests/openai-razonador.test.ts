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
import {
  AIRE_RAZONAMIENTO, aprenderFormatoSiLoRechaza, esRazonadorOpenAI, formatoDeSalida, olvidarFormatos, paramsDeSalida, tokensDeSalida,
} from '../lib/ai-cheap-techo';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

test('4. si OpenAI rechaza un campo de salida, se aprende el OTRO formato UNA vez, por modelo', () => {
  olvidarFormatos();
  const rechazo = "Unsupported parameter: 'max_completion_tokens' is not supported with this model. Use 'max_tokens' instead.";
  assert.equal(formatoDeSalida('gpt-5.6-luna'), 'razonador');
  assert.equal(aprenderFormatoSiLoRechaza('gpt-5.6-luna', rechazo), true, 'no aprendió del 400');
  assert.equal(formatoDeSalida('gpt-5.6-luna'), 'clasico');
  assert.deepEqual(paramsDeSalida(openai, 'gpt-5.6-luna', 1400, 0.2), { max_tokens: 1400, temperature: 0.2 }, 'el reintento salió con el mismo formato');
  assert.equal(aprenderFormatoSiLoRechaza('gpt-5.6-luna', rechazo), false, 'daría vueltas entre los dos formatos');
  assert.equal(formatoDeSalida('gpt-6-luna'), 'razonador', 'lo aprendido es por modelo');
  // Al revés también (un modelo que el nombre da por clásico y razona), y sólo con un 400 que nombre un campo de salida.
  assert.equal(aprenderFormatoSiLoRechaza('gpt-4o-mini', 'temperature does not support 0.2 with this model. Only the default (1) value is supported.'), true);
  assert.equal(formatoDeSalida('gpt-4o-mini'), 'razonador');
  assert.equal(aprenderFormatoSiLoRechaza('gpt-6-luna', 'Invalid value for messages[2].content'), false, 'aprendió de un 400 que no es de los campos');
  assert.equal(aprenderFormatoSiLoRechaza('gpt-6-luna', 'max_tokens is too large: 32000'), false, 'el techo de salida no es el formato');
  olvidarFormatos();
  assert.equal(formatoDeSalida('gpt-5.6-luna'), 'razonador', 'un proceso nuevo vuelve a probar el de su nombre');
  // Y el bucle de herramientas lo usa: repite el paso con el otro formato antes de la rotación de siempre.
  const ai = readFileSync(fileURLToPath(new URL('../lib/ai-cheap.ts', import.meta.url)), 'utf8').replace(/\r\n/g, '\n');
  assert.match(ai, /if \(p\.nombre === 'openai' && status === 400 && aprenderFormatoSiLoRechaza\(model, leido\.mensaje\)\) \{\n[^\n]*\n\s*continue;\n\s*\}\n\s*const tipo = tipoDeFallo\(status, leido\.mensaje\);/);
});

test('5. la salida cobrada: lo que piensa OpenAI ya está en completion_tokens; lo de Gemini, sólo en total_tokens', () => {
  // OpenAI con razonamiento: total = prompt + completion, y reasoning_tokens es un DESGLOSE de completion.
  assert.equal(tokensDeSalida({ prompt_tokens: 1000, completion_tokens: 3000, total_tokens: 4000, completion_tokens_details: { reasoning_tokens: 2500 } }), 3000);
  // Gemini compatible: lo pensado no viene en completion_tokens, sí en total_tokens.
  assert.equal(tokensDeSalida({ prompt_tokens: 1000, completion_tokens: 300, total_tokens: 2300 }), 1300);
  // Anthropic: sin total_tokens, lo de siempre.
  assert.equal(tokensDeSalida({ input_tokens: 1000, output_tokens: 200 }), 200);
  // Sin total y con el desglose, se suma (el caso que la fórmula vieja cubría).
  assert.equal(tokensDeSalida({ prompt_tokens: 1000, completion_tokens: 300, completion_tokens_details: { reasoning_tokens: 500 } }), 800);
  assert.equal(tokensDeSalida({}), 0);
  // recordUsage la usa: la suma de antes contaba dos veces lo pensado de OpenAI.
  const uso = readFileSync(fileURLToPath(new URL('../lib/anthropic-usage.ts', import.meta.url)), 'utf8');
  assert.match(uso, /const output = tokensDeSalida\(u\);/);
  assert.doesNotMatch(uso, /outputVisible \+ reasoning/);
});

test('6. cada modelo de «Tu ChatGPT» tiene precio y nombre en el historial de gasto', async () => {
  const { MODELOS_SU_OPENAI, NOMBRE_MODELO_IA } = await import('../lib/chat-ia-reglas');
  const { modeloLegible } = await import('../lib/ia-labels');
  const uso = readFileSync(fileURLToPath(new URL('../lib/anthropic-usage.ts', import.meta.url)), 'utf8');
  const tabla = uso.slice(uso.indexOf('const PRICING'), uso.indexOf('const DEFAULT_PRICE'));
  for (const m of MODELOS_SU_OPENAI) {
    // Sin fila, `costFor` cae a DEFAULT_PRICE (5/25): el gasto del negocio se anotaba ~25 veces más caro.
    assert.match(tabla, new RegExp(`'${m.replace(/\./g, '\\.')}': \\{ in: [\\d.]+, out: [\\d.]+ \\}`), `${m} sin precio`);
    assert.equal(modeloLegible(m), NOMBRE_MODELO_IA[m], `${m} con otro nombre en el historial`);
    assert.equal(modeloLegible(`fallo:${m}`), NOMBRE_MODELO_IA[m], 'la fila de un fallo, igual');
  }
  assert.equal(modeloLegible('gpt-5-mini'), 'GPT-5', 'los de antes, como antes');
});

// PROBADO ROMPIÉNDOLO (segunda ronda, 23/10/2026, base 5/0):
//   · no aprende del 400 de un campo de salida                → 4/1 (4)
//   · aprende una y otra vez (daría vueltas)                   → 4/1 (4)
//   · paramsDeSalida no lee lo aprendido                       → 4/1 (4)
//   · el bucle de herramientas no repite el paso               → 4/1 (4)
//   · la salida vuelve a sumar lo pensado de OpenAI            → 4/1 (5)
//
// PROBADO ROMPIÉNDOLO (23/10/2026, base 3/0):
//   · `paramsDeSalida` sin la rama de razonamiento          → 2/1 (2)
//   · `esRazonadorOpenAI` sin excluir los «-chat»            → 2/1 (1)
//   · la rama de razonamiento sin mirar el proveedor         → 2/1 (3)

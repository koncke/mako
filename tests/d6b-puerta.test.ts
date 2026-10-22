// =============================================================================
// IA6 (22/10/2026): con su IA conectada, TODO el negocio usa la suya — la PUERTA de la capa de IA decide D6b
// =============================================================================
// Hasta el 22/10, D6b («con su Claude o su GPT, ningún dato del negocio va a Gemini ni a una IA gratis») se prendía sólo
// donde quien atendía el pedido lo prendía: el turno del Ops Center y sus pantallas. El resto (crons, webhooks, WhatsApp,
// Offer, Automations, el simulador, los Analyst) seguía en Gemini aunque el negocio tuviera su Claude: el simulador del
// ws11 corrió con Groq y OpenRouter el 21/10 a las 20:51 UTC. Ahora cada función pública de lib/ai-cheap.ts y
// lib/anthropic.ts decide sola, con el workspace del pedido (lib/solo-su-ia.ts → `conD6bDelPedido`), si nadie lo hizo antes.
//
// Lo que fija este test, corriendo las entradas REALES a pelo (tests/_d6b-puerta-hijo.ts):
//   1. un negocio con su OpenAI (ws3) o con su Claude (ws11): ninguna entrada sale a Gemini, Groq, Mistral, OpenRouter ni
//      Cerebras — texto, texto atado a Gemini, herramientas, una foto, un audio, chatClaude — y ni sus keys de Gemini ni la
//      red de la plataforma se entregan; con su Claude, la foto la mira su Claude;
//   2. el Plan queda afuera (FEATURES_DEL_PLAN): pedido a Gemini, a Gemini va;
//   3. el control: un negocio sin su IA (ws13) y la plataforma (ws9) siguen como siempre (si no salieran, la prueba no vería
//      nada).
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada):
//   · la puerta de `chatCheapCascade` sacada → 1 en rojo; la de `chatCheapToolsCascade` → 1. (La de `leerDocumentoIA` sacada
//     sigue en verde, y está bien: adentro usa `provsDe` y la red de la plataforma, que tienen su propia puerta.)
//   · la puerta decidiendo «afuera» siempre → 1 en rojo; decidiendo «adentro» siempre → 2 y 3 en rojo;
//   · el Plan sin su excepción → 2 en rojo;
//   · la cascada con su IA respetando la lista del que llama (sin `PROVS_SU_IA`) → 1 en rojo (el texto atado a Gemini no
//     corría con nada);
//   · la foto sin su Claude primero → 1 en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const GRATIS = /generativelanguage\.googleapis\.com|api\.groq\.com|api\.mistral\.ai|openrouter\.ai|api\.cerebras\.ai/;
type Corrida = { red: string[]; valor?: unknown };
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_d6b-puerta-hijo.ts')], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 240_000, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as Record<string, Record<string, Corrida>> & { error?: string };
const CON_SU_IA = ['texto', 'textoAtadoAGemini', 'herramientas', 'foto', 'audio', 'chatClaude', 'keysDeGemini', 'redDeLaPlataforma'];

test('1. con su OpenAI o su Claude, NINGUNA entrada a pelo sale a una IA gratis (la puerta decide por el negocio)', () => {
  assert.equal(R.error, undefined, String(R.error));
  for (const ws of ['ws3', 'ws11']) {
    for (const e of CON_SU_IA) {
      assert.deepEqual(R[ws][e].red.filter((h) => GRATIS.test(h)), [], `${ws} · ${e} salió a una IA gratis: ${R[ws][e].red.join(', ')}`);
    }
    assert.equal(R[ws].keysDeGemini.valor, 0, `${ws}: sus keys de Gemini no se entregan`);
    assert.equal(R[ws].redDeLaPlataforma.valor, 0, `${ws}: la red de la plataforma no se entrega`);
  }
  // Y usa SU IA: su OpenAI en el ws3 (también lo atado a Gemini: la cascada es su IA), su Claude en el ws11.
  for (const e of ['texto', 'textoAtadoAGemini', 'herramientas', 'foto', 'audio']) assert.ok(R.ws3[e].red.includes('api.openai.com'), `ws3 · ${e} no usó su OpenAI`);
  for (const e of ['texto', 'textoAtadoAGemini', 'foto']) assert.ok(R.ws11[e].red.includes('api.anthropic.com'), `ws11 · ${e} no usó su Claude`);
});

test('2. el Plan queda afuera (regla de Martín): pedido a Gemini, a Gemini va aunque el negocio tenga su IA', () => {
  assert.ok(R.ws3.plan.red.some((h) => /generativelanguage/.test(h)), `ws3 · plan: ${R.ws3.plan.red.join(', ')}`);
});

test('3. el control: sin su IA (ws13) y la plataforma (ws9) siguen como siempre', () => {
  for (const ws of ['ws13', 'ws9']) {
    assert.ok(R[ws].textoAtadoAGemini.red.some((h) => GRATIS.test(h)), `${ws}: el control no salió a la red gratis`);
    assert.ok(Number(R[ws].keysDeGemini.valor) >= 1, `${ws}: sus keys de Gemini se entregan`);
    assert.ok(Number(R[ws].redDeLaPlataforma.valor) >= 1, `${ws}: la red de la plataforma se entrega`);
  }
});

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
//   2. el Plan (FEATURES_DEL_PLAN) se decide APARTE (Martín, 22/10/2026: «Sí, si es su clave»): con su clave que paga el
//      negocio, SÓLO su IA; sin clave, con su PC sola o con el crédito de Martín (ws10), como siempre;
//   3. el control: un negocio sin su IA (ws13) y la plataforma (ws9) siguen como siempre (si no salieran, la prueba no vería
//      nada).
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada):
//   · la puerta de `chatCheapCascade` sacada → 1 en rojo; la de `chatCheapToolsCascade` → 1. (La de `leerDocumentoIA` sacada
//     sigue en verde, y está bien: adentro usa `provsDe` y la red de la plataforma, que tienen su propia puerta.)
//   · la puerta decidiendo «afuera» siempre → 1 en rojo; decidiendo «adentro» siempre → 2 y 3 en rojo;
//   · el Plan sin su excepción → 2 en rojo. Con la regla del 22/10 (roturas del mismo día): el Plan siempre afuera → 2; el
//     Plan siguiendo la decisión del pedido de afuera → 4; la puerta sin volver a entrar por el Plan → 4; el crédito de
//     Martín contado como su clave → 4;
//   · la cascada con su IA respetando la lista del que llama (sin `PROVS_SU_IA`) → 1 en rojo (el texto atado a Gemini no
//     corría con nada);
//   · la foto sin su Claude primero → 1 en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
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

// Martín, 22/10/2026, textual: «Sí, si es su clave». Hasta ese día el Plan quedaba siempre afuera (a Gemini).
test('2. el Plan con su clave usa SÓLO su IA (su OpenAI, su Claude); sin clave, como siempre', () => {
  assert.deepEqual(R.ws3.plan.red.filter((h) => GRATIS.test(h)), [], `ws3 · plan salió a una IA gratis: ${R.ws3.plan.red.join(', ')}`);
  assert.ok(R.ws3.plan.red.includes('api.openai.com'), `ws3 · plan no usó su OpenAI: ${R.ws3.plan.red.join(', ')}`);
  assert.deepEqual(R.ws11.plan.red.filter((h) => GRATIS.test(h)), [], `ws11 · plan salió a una IA gratis: ${R.ws11.plan.red.join(', ')}`);
  assert.ok(R.ws11.plan.red.includes('api.anthropic.com'), `ws11 · plan no usó su Claude: ${R.ws11.plan.red.join(', ')}`);
  for (const ws of ['ws13', 'ws9']) assert.ok(R[ws].plan.red.some((h) => /generativelanguage/.test(h)), `${ws} · plan dejó de ir a Gemini: ${R[ws].plan.red.join(', ')}`);
});

test('3. el control: sin su IA (ws13) y la plataforma (ws9) siguen como siempre', () => {
  for (const ws of ['ws13', 'ws9']) {
    assert.ok(R[ws].textoAtadoAGemini.red.some((h) => GRATIS.test(h)), `${ws}: el control no salió a la red gratis`);
    assert.ok(Number(R[ws].keysDeGemini.valor) >= 1, `${ws}: sus keys de Gemini se entregan`);
    assert.ok(Number(R[ws].redDeLaPlataforma.valor) >= 1, `${ws}: la red de la plataforma se entrega`);
  }
});

// ── La revisión adversarial de IA6 (22/10/2026) ─────────────────────────────────────────────────────────────────────────
// Probado rompiéndolo: sin workspace sin guardar la decisión → 4 en rojo (el proceso se colgaba: lo frena el tope de 20 s);
// el Plan mirado después de «ya decidido» → 4 en rojo; «no pude saber» recordado → 4 en rojo; una función exportada nueva de
// la capa de IA sin su puerta → 5 en rojo.

test('4. revisión: sin workspace vuelve; el Plan adentro de otro pedido sigue SU regla; «no pude saber» no se recuerda', () => {
  const x = (R as unknown as { extra: Record<string, string[]> & { sinWorkspace: string } }).extra;
  assert.equal(x.sinWorkspace, 'volvió', 'sin workspace, la puerta se llamaba a sí misma y congelaba el proceso');
  assert.ok(x.planWs3AdentroDeAfuera.includes('api.openai.com'), `el Plan del ws3 adentro de un pedido «afuera» tiene que usar su OpenAI: ${x.planWs3AdentroDeAfuera.join(', ')}`);
  assert.deepEqual(x.planWs3AdentroDeAfuera.filter((h) => GRATIS.test(h)), [], 'el Plan del ws3 salió a una IA gratis');
  assert.ok(x.planWs13AdentroDeAdentro.some((h) => /generativelanguage/.test(h)), `el Plan del ws13 (sin clave) adentro de un pedido «adentro» tiene que ir a su Gemini: ${x.planWs13AdentroDeAdentro.join(', ')}`);
  // El ws10: su clave de Claude es el crédito de Martín. Su Plan NO la usa (no la paga el negocio) y sigue como siempre;
  // lo que no es del Plan sí corre con «su» Claude (IA5: Haiku), sin Gemini.
  assert.ok(!x.planWs10Credito.includes('api.anthropic.com'), 'el Plan del ws10 pagó con el crédito de Martín');
  assert.ok(x.planWs10Credito.some((h) => /generativelanguage/.test(h)), `el Plan del ws10 tiene que seguir como siempre: ${x.planWs10Credito.join(', ')}`);
  assert.ok(x.noPlanWs10Credito.includes('api.anthropic.com') && !x.noPlanWs10Credito.some((h) => GRATIS.test(h)), `lo del ws10 que no es del Plan, con su Claude: ${x.noPlanWs10Credito.join(', ')}`);
  assert.deepEqual(x.conBacheDeLaBase.filter((h) => GRATIS.test(h)), [], 'con la base caída, falla cerrada en ESE pedido');
  assert.ok(x.despuesDelBache.some((h) => /generativelanguage/.test(h)), 'con la base sana, el negocio sin su IA vuelve a su Gemini (no se recordó el «no pude saber»)');
});

test('5. toda función exportada de la capa de IA pasa por la puerta (o está en la lista, con su porqué)', () => {
  const SIN_PUERTA: Record<string, string> = {
    'lib/ai-cheap.ts#chatCheapJson': 'llama a chatCheap, que tiene la suya',
    'lib/anthropic.ts#permisoDeLaClaveDelNegocio': 'la clave del negocio: nunca una IA gratis',
    'lib/anthropic.ts#conClaveDelNegocio': 'la clave del negocio: nunca una IA gratis',
    'lib/anthropic.ts#conCreditoDeLaPlataforma': 'el crédito de Claude de la plataforma, sólo en el onboarding (lo decide Martín): no es una IA gratis',
  };
  const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const faltan: string[] = [];
  for (const f of ['lib/ai-cheap.ts', 'lib/anthropic.ts']) {
    const src = sinComentarios(readFileSync(join(RAIZ, f), 'utf8'));
    for (const m of src.matchAll(/export async function (\w+)/g)) {
      const clave = `${f}#${m[1]}`;
      if (SIN_PUERTA[clave]) continue;
      // La puerta va en las primeras líneas del cuerpo.
      const cuerpo = src.slice(src.indexOf('{', src.indexOf(')', m.index!) ), m.index! + 6000).split('\n').slice(0, 6).join('\n');
      if (!/conD6bDelPedido\(/.test(cuerpo) && !/conD6bDelPedido\(/.test(src.slice(m.index!, m.index! + 400))) faltan.push(clave);
    }
  }
  assert.deepEqual(faltan, [], 'estas funciones de la capa de IA no pasan por la puerta de D6b: con un workspace, decidirían sin mirar si el negocio tiene su IA');
});

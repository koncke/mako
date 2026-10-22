// =============================================================================
// WA1 (22/10/2026): Hola MaKo contesta con el Claude o el GPT del negocio (por clave, nunca por suscripción)
// =============================================================================
// Los candidatos del doer de WhatsApp eran [pin, groq, openai] y el escalado pedía `claude-sonnet-5` con `model` explícito,
// que el veto corta: el Claude del negocio no se probaba nunca, y en 30 días hubo 231 llamadas a Gemini desde el doer. Lo
// que fija este test:
//   1. el doer pregunta `negocioConSuIA(wsData)`, y con su IA los candidatos son sólo su OpenAI (sin Groq ni Gemini);
//   2. después de su OpenAI, su Claude por la puerta 2 (`soloSuClaude`), sólo si el turno no ejecutó nada, y la red gratis
//      de la plataforma ni se arma;
//   3. corriendo `chatClaudeTools` con `soloSuClaude` (tests/_doer-su-claude-hijo.ts): con su clave, a Anthropic con SU
//      clave y el modelo de la puerta 2, con su marca; sin su clave, «falló la IA», sin tocar la de MaKo.
// Nunca la suscripción: el doer no encola nada a la PC (D6a: es de fondo).
//
// Probado rompiéndolo (22/10/2026, una rotura por vez, restaurada):
//   · sin el chequeo de su IA en los candidatos (vuelve a [pin, groq, openai]) → 1 en rojo;
//   · sin el intento de su Claude → 2 en rojo;
//   · su Claude aunque el turno ya ejecutó algo → 2 en rojo;
//   · `soloSuClaude` cayendo al Claude de MaKo → 3 en rojo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const DOER = sinComentarios(readFileSync(join(RAIZ, 'lib/mako-doer-in.ts'), 'utf8')).replace(/\r\n/g, '\n');

test('1. con su IA, los candidatos del doer son sólo su OpenAI', () => {
  assert.match(DOER, /const suIA = \(await negocioConSuIA\(wsData\)\)\.suIA;/);
  assert.match(DOER, /const cands = suIA \? \['openai'\] : \[pinL\.provider, 'openai'\]/);
  assert.match(DOER, /const pinL = pin && pin\.provider !== 'anthropic' \? pin : suIA \? \{ provider: 'openai'/, 'con su IA y sin pin barato, el loop corre igual (con su OpenAI)');
});

test('2. después de su OpenAI, su Claude por la puerta 2 — sólo si el turno no ejecutó nada — y sin la red de la plataforma', () => {
  const i = DOER.indexOf('if (!respuesta && suIA && !linkBorrador && corridasDelTurno === 0) {');
  assert.ok(i > 0, 'falta el intento con su Claude (o perdió la guarda de «no ejecutó nada»)');
  const bloque = DOER.slice(i, i + 900);
  assert.match(bloque, /chatClaudeTools\(system, msgs, tools, nuevoIntento\(\), \{\s*feature: 'mako-doer-in', soloSuClaude: true,/);
  assert.doesNotMatch(bloque, /model: '/, 'sin `model` explícito: eso va al veto de la plataforma');
  assert.match(DOER, /const turnoRed = respuesta \|\| suIA \? null : turnoParaLaRed\(/, 'con su IA, la red gratis ni se arma');
});

test('3. `soloSuClaude` de verdad: su clave y su marca; sin su clave, «falló la IA» y la de MaKo intacta', () => {
  const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_doer-su-claude-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 90_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const r = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length));
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.ws3.r.text, 'Tienes 3 leads nuevos hoy.');
  assert.deepEqual(r.ws3.pedidos.map((p: { clave: string; model: string }) => [/DEL-NEGOCIO/.test(p.clave), p.model]), [[true, 'claude-haiku-4-5']]);
  assert.match(String(r.ws13.r), /^tiró: falló la IA \(el negocio no tiene su clave de Claude\)/);
  assert.deepEqual(r.ws13.pedidos, [], 'sin su clave no se le pide nada a nadie');
  for (const g of r.gasto as Array<{ motivo: string }>) assert.match(g.motivo, /^⚠ clave de Anthropic del negocio/);
});

// =============================================================================
// Lo que Gemini cachea se ANOTA, y no cambia ni el costo ni el medidor de cuota
// =============================================================================
// Medido el 08/10/2026 contra el endpoint que usa el doer: con el mismo system y las
// mismas tools, el 2º pedido vino con `prompt_tokens_details.cached_tokens` = 86% del
// prefijo. `recordUsage` sólo leía `cache_read_input_tokens` (la forma de Claude), así que
// `anthropic_usage.cache_read_tokens` decía 0 en todas las filas de Gemini y no había forma
// de saber si el prefijo que el loop re-manda en cada paso ya salía barato.
//
// PROBADO ROMPIÉNDOLO (con todo puesto: 2 pasan, 0 fallan):
//   · `recordUsage` deja de leer `prompt_tokens_details`          -> 1 / 1
//   · lo cacheado entra al costo (`costFor` lo recibe)            -> 1 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../lib/anthropic-usage.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const i = SRC.indexOf('export async function recordUsage(');
const CUERPO = sinComentarios(SRC.slice(i, SRC.indexOf('\n}\n', i)));

test('recordUsage anota lo cacheado de los compatibles con OpenAI en cache_read_tokens', () => {
  assert.ok(i > 0, 'no encontré recordUsage');
  assert.match(CUERPO, /prompt_tokens_details[\s\S]{0,80}cached_tokens/, 'volvió a ignorar lo cacheado de Gemini: la tabla vuelve a decir 0');
  assert.match(CUERPO, /cache_read_tokens: cacheRead \|\| cacheadoCompat/, 'lo cacheado no llega a la columna');
});

test('lo cacheado NO entra al costo ni se descuenta del input (el medidor de cuota suma input+output)', () => {
  const costo = /costFor\(model, \{([^}]*)\}/.exec(CUERPO);
  assert.ok(costo, 'no encontré la llamada a costFor');
  assert.ok(!/cacheadoCompat/.test(costo[1]), 'lo cacheado entró al costo: cambia lo que dice el Saldo de IA sin que nadie lo decida');
  assert.match(CUERPO, /input_tokens: input,/, 'el input dejó de ser el prompt entero: el medidor de cuota cambiaría de escala');
});

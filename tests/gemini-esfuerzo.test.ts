// =============================================================================
// Gemini dejó de aceptar `reasoning_effort: 'minimal'`, y su error venía escondido en un ARRAY (15/10/2026)
// =============================================================================
// El chat de Automations de Joan (ws17, una sola key de Gemini) fallaba siempre con «Falló de nuestro lado, no de tus
// keys». Medido con su key y con la de la plataforma: desde el 14/10 a las 20:31 UTC `gemini-flash-latest` contesta 400
// «Thinking level MINIMAL is not supported for this model» a todo `chatCheap`, que manda `minimal` siempre. Con `low`
// contesta 200. Y `chatCheap` leía `data.error.message` sobre un ARRAY: el 400 llegaba pelado y el clasificador no tenía
// qué leer. Diseño y medición: docs/hallazgos-ia.md (15/10/2026).
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.
//
// Correr: node --import tsx --test tests/gemini-esfuerzo.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esfuerzoParaGemini, aprenderSinMinimal, olvidarEsfuerzos, rechazaElEsfuerzo, AIRE_SIN_MINIMAL } from '../lib/gemini-esfuerzo';
import { leerErrorProveedor } from '../lib/ia-rotacion-modelo';

const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** El cuerpo LITERAL que contestó Google el 15/10/2026 (con la key de la plataforma y con la de Joan). */
const CUERPO_400 = [{ error: { code: 400, message: 'Thinking level MINIMAL is not supported for this model. Please retry with other thinking level.', status: 'INVALID_ARGUMENT' } }];

test('el 400 del pensar se reconoce leído del ARRAY de Gemini, y nada más lo dispara', () => {
  const e = leerErrorProveedor(CUERPO_400, 400);
  assert.match(e.mensaje, /Thinking level MINIMAL is not supported/, 'el error del array llegó pelado');
  assert.equal(rechazaElEsfuerzo(400, e.mensaje), true);
  assert.equal(rechazaElEsfuerzo(503, e.mensaje), false, 'sólo un 400');
  assert.equal(rechazaElEsfuerzo(400, 'API key not valid. Please pass a valid API key.'), false, 'una key inválida no es el pensar');
  assert.equal(rechazaElEsfuerzo(400, 'HTTP 400'), false);
});

test('se aprende POR MODELO: el que rechazó `minimal` pasa a `low` con aire; los demás siguen igual', () => {
  olvidarEsfuerzos();
  assert.deepEqual(esfuerzoParaGemini('gemini-flash-latest', 'minimal'), { esfuerzo: 'minimal', aire: 0 }, 'arranca probando minimal');
  aprenderSinMinimal('gemini-flash-latest');
  assert.deepEqual(esfuerzoParaGemini('gemini-flash-latest', 'minimal'), { esfuerzo: 'low', aire: AIRE_SIN_MINIMAL });
  assert.deepEqual(esfuerzoParaGemini('gemini-flash-lite-latest', 'minimal'), { esfuerzo: 'minimal', aire: 0 }, 'flash-lite sí acepta minimal');
  // Lo que se pide explícito no se toca.
  assert.deepEqual(esfuerzoParaGemini('gemini-flash-latest', 'high'), { esfuerzo: 'high', aire: 0 });
  olvidarEsfuerzos();
  assert.deepEqual(esfuerzoParaGemini('gemini-flash-latest', 'minimal'), { esfuerzo: 'minimal', aire: 0 }, 'la memoria es del proceso: un arranque nuevo vuelve a probar');
  assert.ok(AIRE_SIN_MINIMAL >= 512, 'con low el pensar come del mismo tope');
});

test('chatCheap: reintenta UNA vez, aprende ese modelo, y lee el error con `leerErrorProveedor`', () => {
  const src = sinComentarios(leer('lib/ai-cheap.ts'));
  const i = src.indexOf('export async function chatCheap(');
  const cuerpo = src.slice(i, src.indexOf('\n}\n', i));
  assert.match(cuerpo, /let \{ esfuerzo, aire \} = p\.nombre === 'gemini' \? esfuerzoParaGemini\(model, pedido\) : \{ esfuerzo: pedido, aire: 0 \};/);
  assert.match(cuerpo, /max_tokens: \(opts\.maxTokens \?\? 512\) \+ aire,/);
  assert.match(cuerpo, /reasoning_effort: esfuerzo/);
  // UNA vez: un `if`, no un bucle; sólo desde `minimal`, y aprende ESE modelo.
  assert.match(cuerpo, /if \(p\.nombre === 'gemini' && !res\.ok && esfuerzo === 'minimal' && rechazaElEsfuerzo\(res\.status, leerErrorProveedor\(data, res\.status\)\.mensaje\)\) \{\n\s*aprenderSinMinimal\(model\);/);
  assert.equal((cuerpo.match(/await pedir\(/g) ?? []).length, 2, 'más de un reintento');
  assert.match(cuerpo, /throw new Error\(`chatCheap\(\$\{rotulo\(p\)\}\): \$\{leerErrorProveedor\(data, res\.status\)\.mensaje\}\$\{extra\}`\);/);
  assert.doesNotMatch(cuerpo, /data\?\.error\?\.message/, 'volvió a leer sólo `data.error`');
  // Y los demás lectores de ai-cheap tampoco leen sólo `data.error` (los documentos, las notas de voz, el cierre del doer).
  assert.doesNotMatch(src, /\?\.error\?\.message/, 'quedó un lector que no ve el error dentro de un array');
});

test('el chat de Automations tiene su red de plataforma, y lo de la red no va al mensaje del negocio', () => {
  const src = sinComentarios(leer('lib/flujo-ia-crear.ts'));
  assert.equal((src.match(/redDePlataforma: true/g) ?? []).length, 2, 'la pasada y la reparación del JSON');
  assert.match(src, /erroresPlataformaOut: p\.erroresRed,/);
  assert.match(src, /erroresPlataformaOut: erroresRed,/);
  assert.match(src, /return falloDeIA\(errores, hayIA\);/, 'el mensaje habla de las keys del negocio');
});

// ── ROTURAS (15/10/2026) ────────────────────────────────────────────────────────────────────────
// Con el arnés del scratchpad (rompe UNA, corre este archivo y tests/crear-ia-tercera.test.ts, restaura DE MEMORIA; nunca
// git). Base: 18 / 0. Cada una dio 17 / 1: la memoria global en vez de por modelo · sin aire en el tope · cualquier 400
// tomado como el pensar · `chatCheap` leyendo sólo `data.error` · `chatCheap` sin el reintento · los lectores de
// documentos ciegos al array · el chat sin la red de plataforma · el pensar sin ser «nuestro» · el fallback que vuelve a
// tragarse la causa. Restaurado: 18 / 0.
// Y medido de verdad (15/10/2026, la key de Joan y la de la plataforma): la primera vuelta pasa el 400 con `low`, la
// segunda va directo con `low` (740 ms, una sola llamada), y con la de la plataforma contestó «OK».

// =============================================================================
// Offer resume lo que pasa los 30 mensajes (lib/offer-reglas.ts → conversacionParaPrompt, 12/11/2026)
// =============================================================================
// Martín, 11/11: los chats de MaKo, como un chat con Claude. Offer le mostraba al modelo los últimos 30 mensajes y «(Se omiten los N
// mensajes más viejos.)»: en una conversación de 103 mensajes, lo que el dueño dijo al principio no existía para el modelo. Lo que fija:
//   1. sin pasar el resumen, como siempre (los demás pedidos de Offer y Competitors Spy no cambian);
//   2. con el resumen, lo que pasa los 30 va resumido y lo que el resumen todavía no cubre va entero hasta el umbral, sin hueco;
//   3. lo que hay que resumir, para `resumirDespues` (lib/conversacion-resumen.ts).
// El cableado (la ruta lo lee, lo pasa a los tres pedidos y resume después) está en tests/chat-app-hilo.test.ts.
// Probado rompiéndolo: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conversacionParaPrompt, entradasDeOffer, sinResumirDeOffer, MAX_MENSAJES_PROMPT, type MensajeParaPrompt } from '../lib/offer-reglas';
import { tocaResumir } from '../lib/conversacion-resumen-reglas';

const T0 = Date.parse('2026-11-01T12:00:00Z');
const m = (i: number, texto: string): MensajeParaPrompt => ({ id: `m${i}`, at: new Date(T0 + i * 60_000).toISOString(), de: i % 2 ? 'mako' : 'yo', texto });
const cortos = Array.from({ length: 40 }, (_, i) => m(i, `mensaje ${i}`));
// Los 10 primeros, largos (~1.000 tokens cada uno): el precio del dueño está en el primero.
const largos = Array.from({ length: 40 }, (_, i) => m(i, i === 0 ? `Mi precio es US$2.500. ${'contexto '.repeat(390)}` : i < 10 ? `parte ${i} ${'contexto '.repeat(390)}` : `mensaje ${i}`));

test('1. sin pasar el resumen, como siempre: los 30 y «se omiten»', () => {
  const s = conversacionParaPrompt(cortos);
  assert.match(s, /^\(Se omiten los 10 mensajes más viejos\.\)\nDUEÑO: mensaje 10\n/);
  assert.equal(s.split('\n').length, MAX_MENSAJES_PROMPT + 1);
});

test('2. con el resumen: lo de antes resumido y lo que no cubre entero, sin hueco', () => {
  // Sin resumen todavía y poco que resumir: va todo entero.
  const todo = conversacionParaPrompt(cortos, MAX_MENSAJES_PROMPT, null);
  assert.ok(todo.startsWith('DUEÑO: mensaje 0\n'), 'con 10 mensajes cortos de más, se omitieron igual');
  // Sin resumen y mucho: los 30 más lo que entra en el umbral; lo demás se omite (y se resume después).
  const sin = conversacionParaPrompt(largos, MAX_MENSAJES_PROMPT, null);
  assert.match(sin, /^\(Se omiten los \d mensajes más viejos\.\)/);
  assert.ok(!sin.includes('US$2.500'), 'el primero, largo, entró igual');
  // Con un resumen que cubre hasta el 7: lo resumido va en una línea, y el 8 y el 9 (sin cubrir) enteros.
  const r = { v: 1 as const, texto: 'El dueño dijo que su precio es US$2.500.', hastaAt: T0 + 7 * 60_000, hastaId: 'm7', at: 0 };
  const con = conversacionParaPrompt(largos, MAX_MENSAJES_PROMPT, r);
  assert.match(con, /^\(Antes de esto hubo 8 mensajes más\. Lo que se habló ahí, resumido: El dueño dijo que su precio es US\$2\.500\.\)\nDUEÑO: parte 8 /,'hay un hueco entre el resumen y la conversación');
});

test('3. lo que hay que resumir: lo que pasa los 30 y el resumen no cubre', () => {
  assert.deepEqual(sinResumirDeOffer(cortos.slice(0, 30), null).porResumir, []);
  const sin = sinResumirDeOffer(largos, null);
  assert.equal(sin.porResumir[0].id, 'm0');
  assert.ok(tocaResumir(sin.porResumir), 'diez mensajes largos no piden resumen');
  const r = { v: 1 as const, texto: 'x', hastaAt: T0 + 7 * 60_000, hastaId: 'm7', at: 0 };
  assert.deepEqual(sinResumirDeOffer(largos, r).porResumir.map((e) => e.id), ['m8', 'm9']);
  // «Estoy leyendo tus documentos» no es de la conversación.
  assert.equal(entradasDeOffer([{ ...m(0, 'x'), leyendo: { nombres: [], desde: '' } as never }]).length, 0);
  assert.equal(entradasDeOffer([m(0, 'hola')])[0].quien, 'El dueño');
});

// ── Probado rompiéndolo (12/11/2026; cada rotura sola, restaurada después; base 3/0) ──
//   · `conversacionParaPrompt` sin el resumen (siempre los 30) → falla 2.
// Y en los grupos, el módulo sin la conversación de la línea (`deLaLinea`) → tests/hilo-del-superadmin.test.ts falla 4: el refactor
// de `conversacionDelTurno` (las `entradas`) sigue pasando por la fusión de siempre.

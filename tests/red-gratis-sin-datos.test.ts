// =============================================================================
// A la red GRATIS de la plataforma no viajan datos de clientes: ni el historial, ni el guion (17/10/2026)
// =============================================================================
// La red gratis (el plan gratis de Gemini y Groq de la agencia) entrena con lo que recibe. El corte del doer de
// WhatsApp (`turnoParaLaRed`) miraba lo que se PIDIÓ en este turno, y dejaba dos huecos anotados en
// docs/hallazgos-ia.md (17/10): el HISTORIAL del grupo viajaba entero (un lead nombrado en un turno anterior iba a
// la red) y el ✦ que escribe los mensajes de Automations (app/api/chat-agent/redactar) tenía su propia red sin
// corte. Ahora la red recibe sólo el turno (`soloElTurno`) y el guion va sin las lecturas que el registro marca
// con datos de clientes (`llevaDatosDeClientes`).
//
// Probado rompiéndolo (17/10/2026), sobre los 3 de este archivo (base 3 / 0): con la red del doer recibiendo
// `msgs` → 2 / 1; con el guion mandando `user` a la red → 2 / 1; con `soloElTurno` devolviendo todo → 2 / 1.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloElTurno } from '../lib/doer-herramientas';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

test('soloElTurno deja sólo el último mensaje', () => {
  const msgs = [{ role: 'user', content: '¿qué pasó con Juan Pérez, 5491122334455?' }, { role: 'assistant', content: 'Juan dijo que…' }, { role: 'user', content: 'hola MaKo' }];
  assert.deepEqual(soloElTurno(msgs), [{ role: 'user', content: 'hola MaKo' }]);
  assert.deepEqual(soloElTurno([]), []);
});

test('la red del doer de WhatsApp recibe sólo el turno, nunca el historial', () => {
  const src = leer('lib/mako-doer-in.ts');
  // 24/10/2026: la lista de la red se pide antes de `turnoParaLaRed` (lib/mako-doer-in.ts, el cartel del ws21), y ya no es
  // `const red = await …` a secas: el ancla es la llamada, no la declaración.
  const i = src.indexOf('await provsGratisDePlataforma()');
  assert.ok(i > 0, 'el doer ya no pide la red');
  const red = src.slice(i);
  const llamada = /await chatCheapTools\(systemRed, ([^,]+), toolsRed/.exec(red);
  assert.ok(llamada, 'no encontré la llamada a la red');
  assert.equal(llamada[1], 'soloElTurno(msgs)');
});

test('el ✦ de Automations manda a la red el pedido SIN las lecturas con datos de clientes', () => {
  const src = leer('app/api/chat-agent/redactar/route.ts');
  const red = src.slice(src.indexOf('// 2) La RED DE PLATAFORMA'));
  assert.match(red, /const leidoRed = leido\.filter\(\(l\) => !llevaDatosDeClientes\(l\.id\)\);/);
  assert.match(red, /const userRed = userDeRedacta\(p, leidoRed\);/);
  assert.match(red, /chatCheapTools\(system, \[\{ role: 'user', content: userRed \}\]/);
  assert.doesNotMatch(red, /content: user \}/, 'la red volvió a recibir el pedido entero');
});

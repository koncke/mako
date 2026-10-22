// =============================================================================
// Un mensaje sin respuesta no queda mudo (22/10/2026, el cliente roto del ws1)
// =============================================================================
// El «Cerebro» de Mauricio (ws1, chat 40) tenía dos mensajes suyos del 18/10 sin nada debajo. Medido: el turno intentó con
// Claude, quedó «anthropic vetado: mako-doer» y no cayó a nada; lo que dice el fallo es un aviso de la pantalla que NO se
// guarda, así que al recargar el hilo terminaba en su pregunta. Ahora, pasado el techo del turno, se dice «No te pude
// contestar esto.» con «Reintentar», en la computadora y en el teléfono (los dos cargan el hilo con el mismo motor).
//
// Correr: node --import tsx --test tests/ops-sin-silencio.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conSinRespuesta, itemsDeSesion, SIN_RESPUESTA, TECHO_TURNO_MS } from '../app/m/mako/chat-ui';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el caso de Mauricio: sus dos mensajes del 18/10 sin respuesta terminan con «No te pude contestar» y «Reintentar»', () => {
  // Lo guardado en chart_chats para la sesión 40 del ws1 (los textos, cortos).
  const hilo = itemsDeSesion([
    { role: 'user', content: 'Dame claridad de mi avatar…', created_at: '2026-10-18T03:50:38Z' },
    { role: 'user', content: 'funciona esta seccion ?', created_at: '2026-10-18T04:13:47Z' },
  ], []);
  const ahora = Date.parse('2026-10-22T12:00:00Z');
  const r = conSinRespuesta(hilo, ahora);
  const ult = r[r.length - 1];
  assert.equal(ult.k, 'aviso');
  assert.ok(ult.k === 'aviso' && ult.texto === SIN_RESPUESTA);
  assert.ok(ult.k === 'aviso' && ult.reintentar === 'funciona esta seccion ?', 'manda de nuevo lo último que escribió');
  // Con la respuesta de MaKo debajo, nada.
  const contestado = itemsDeSesion([
    { role: 'user', content: 'hola', created_at: '2026-10-18T03:50:38Z' },
    { role: 'assistant', content: 'Hola, ¿en qué te ayudo?', created_at: '2026-10-18T03:50:50Z' },
  ], []);
  assert.deepEqual(conSinRespuesta(contestado, ahora), contestado);
  // Recién mandado (el turno puede seguir corriendo, en otra pestaña o el teléfono): todavía no.
  const recien = itemsDeSesion([{ role: 'user', content: 'hola', created_at: new Date(ahora - TECHO_TURNO_MS + 60_000).toISOString() }], []);
  assert.deepEqual(conSinRespuesta(recien, ahora), recien);
});

test('2. el hilo dibuja el «Reintentar», y el motor lo pone al cargar (computadora y teléfono)', () => {
  const hilo = sinComentarios(leer('app/_chat/HiloMako.tsx'));
  assert.match(hilo, /\{x\.reintentar && onResponder && <> <button type="button" className="ch-enlace" onClick=\{\(\) => onResponder\(x\.reintentar!\)\}>Reintentar<\/button><\/>\}/);
  assert.match(sinComentarios(leer('app/second-brain/useChatCliente.ts')), /setItems\(conSinRespuesta\(itemsDeSesion\(l\.datos\.mensajes \?\? \[\]/);
  assert.match(sinComentarios(leer('app/second-brain/PiezasCliente.tsx')), /onResponder=\{\(t\) => k\.enviar\(t\)\}/, 'Reintentar manda por el motor');
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 2/0):
//   · conSinRespuesta sin mirar si lo último es de la persona     → 1/1 (1)
//   · sin el techo del turno (avisa apenas se manda)              → 1/1 (1)
//   · el motor sin conSinRespuesta al cargar                      → 1/1 (2)

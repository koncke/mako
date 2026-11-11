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
import { AVISO_CONECTA_TU_PC, AVISO_SIN_IA, AVISO_SU_CLAVE, porQueSinRespuesta } from '../lib/mako-turno-app-reglas';
import { bloquesGuardados, esPorQueGuardado } from '../lib/chat-bloques';

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

// ── El porqué conocido queda en el hilo (el Cerebro, 22/10/2026, con la captura de Martín) ─────────────────────────────
// Lo de arriba cubre el silencio; esto, que no se diga «No te pude contestar esto» cuando sí se sabe por qué. Mauricio (ws1)
// no tiene IA propia (sus filas de IA son copias de la plataforma, sin PC): el turno le decía «conecta tu IA» en un aviso de
// la pantalla que no se guardaba, y al volver a entrar veía sus dos mensajes sin nada y «No te pude contestar esto».

test('3. con un porqué conocido, el turno lo GUARDA como mensaje de MaKo; sin porqué, el cartel de siempre', () => {
  // El primero que se sabe gana, en el orden del turno: la PC, su clave, sin IA, la PC ilegible.
  assert.equal(porQueSinRespuesta({ delaPc: null, deSuClave: null, sinIA: AVISO_SIN_IA, pcIlegible: null }), AVISO_SIN_IA);
  assert.equal(porQueSinRespuesta({ delaPc: 'Tu computadora está apagada.', deSuClave: AVISO_SU_CLAVE, sinIA: AVISO_SIN_IA, pcIlegible: null }), 'Tu computadora está apagada.');
  assert.equal(porQueSinRespuesta({ delaPc: null, deSuClave: AVISO_SU_CLAVE, sinIA: AVISO_CONECTA_TU_PC, pcIlegible: null }), AVISO_SU_CLAVE);
  assert.equal(porQueSinRespuesta({ delaPc: null, deSuClave: undefined, sinIA: undefined, pcIlegible: null }), null, 'sin porqué, nada que guardar');
  // El turno lo guarda en el hilo (`anotarEnHilo`) y NO en `guardados` (en la respuesta va como aviso, con su botón).
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  const i = turno.indexOf('const porQue = porQueSinRespuesta(');
  assert.ok(i > 0, 'el turno no calcula el porqué');
  // Con la MARCA `porque` (y su botón): así la pantalla lo dibuja como aviso y el modelo no lo lee como algo que dijo.
  const bloque = turno.slice(i, i + 600);
  assert.match(bloque, /if \(porQue\) \{\s*const boton = sinIAEs\?\.conectar \?\? (?:deSuClave|deSuCuenta)\?\.conectar \?\? null;\s*await anotarEnHilo\(s\.id, porQue, \[\{ t: 'porque', \.\.\.\(boton \? \{ conectar: boton \} : \{\}\) \}\]\);\s*\}\s*aviso = \[aviso, porQue \?\? AVISO_NO_PUDE\]/);
  assert.doesNotMatch(bloque, /guardados\.push/);
  // Y lo que dice sin IA nombra las tres que puede conectar.
  // Sin Gemini desde el 25/10/2026 (docs/conexiones-y-ayuda.md, decisión 1).
  assert.equal(AVISO_SIN_IA, 'Para contestarte necesito tu IA: conecta tu Claude o tu GPT y mándamelo de nuevo.');
});

test('4. al volver a entrar: el aviso de MaKo con su botón, no «No te pude contestar esto»', () => {
  const ahora = Date.parse('2026-10-22T12:00:00Z');
  // Lo que deja el turno: el porqué con la marca, guardada como `{ k: 'bloque', b }` y leída con `bloquesGuardados`.
  const guardado = bloquesGuardados([{ k: 'bloque', b: { t: 'porque', conectar: 'anthropic' } }]);
  const hilo = itemsDeSesion([
    { role: 'user', content: 'funciona esta seccion ?', created_at: '2026-10-22T10:00:00Z' },
    { role: 'assistant', content: AVISO_SIN_IA, created_at: '2026-10-22T10:00:03Z', bloques: guardado },
  ], []);
  const r = conSinRespuesta(hilo, ahora);
  assert.ok(!r.some((x) => x.k === 'aviso' && x.texto === SIN_RESPUESTA), 'dijo «No te pude contestar esto» con el porqué guardado');
  const ult = r[r.length - 1];
  assert.deepEqual(ult.k === 'aviso' ? { texto: ult.texto, tono: ult.tono, conectar: ult.conectar } : ult,
    { texto: AVISO_SIN_IA, tono: 'mako', conectar: 'anthropic' }, 'el porqué no volvió como aviso de MaKo con su botón');
  assert.ok(!r.some((x) => x.k === 'bloque'), 'la marca se dibujó como un bloque');
  // La marca no se dibuja por su lado (el último caso de BloqueHilo es una pregunta: sin esto, saldría como una).
  assert.match(sinComentarios(leer('app/_chat/BloqueHilo.tsx')), /if \(b\.t === 'porque'\) return null;/);
});

test('5. el modelo no lee el porqué como algo que dijo (un cartel de la plataforma no es un turno, AGENTS.md)', () => {
  assert.equal(esPorQueGuardado([{ k: 'bloque', b: { t: 'porque' } }]), true);
  assert.equal(esPorQueGuardado([{ k: 'bloque', b: { t: 'creado', titulo: 'x' } }]), false);
  assert.equal(esPorQueGuardado(null), false);
  // `conectar` sólo con la forma de una integración.
  assert.deepEqual(bloquesGuardados([{ k: 'bloque', b: { t: 'porque', conectar: '/robar?x=1' } }]), [{ t: 'porque' }]);
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(turno, /const previos = \(await getSessionMessagesConBloques\(s\.id\)\)\.filter\(\(m\) => !\(m\.role === 'assistant' && esPorQueGuardado\(m\.bloques\)\)\);/);
  // 32f430356 (tipos, 24/10) le puso un alias tipado a `previos`: mismo arreglo, así que se sigue el alias hasta el historial.
  // Desde el 10/11/2026 pasa por `delHiloDeLaTab` (la charla del CoPilot no es historial de otra tab, tests/hilo-propio-de-tab.test.ts):
  // sigue saliendo de `hilo`, el mismo `previos` sin el porqué.
  assert.match(turno, /const hilo: readonly ChartMsg\[\] = previos;\s*const historial = historialParaModelo\((?:delHiloDeLaTab\()?hilo,/, 'el historial del modelo sale de `previos`, ya sin el porqué');
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 2/0):
//   · conSinRespuesta sin mirar si lo último es de la persona     → 1/1 (1)
//   · sin el techo del turno (avisa apenas se manda)              → 1/1 (1)
//   · el motor sin conSinRespuesta al cargar                      → 1/1 (2)
// Y el porqué en el hilo (22/10/2026, base 5/0, romper.mjs, las 10 en rojo): el turno no lo guarda → 3; lo guarda sin la
// marca → 3; `porQueSinRespuesta` siempre null → 3; también en `guardados` → 3; el aviso viejo («Conecta la tuya») → 3; el
// historial del modelo con el porqué → 5; `conectar` sin mirar su forma → 5; el hilo lo dibuja como mensaje → 4; BloqueHilo
// sin su `null` → 4; `sanearBloque` sin la marca → 4.

// =============================================================================
// Las decisiones como en Claude: un bloque arriba de la caja, una pregunta por vez (22/10/2026)
// =============================================================================
// Martín, con captura del chat «Cerebro»: «Las decisiones deben salir como en Claude, un bloque arriba del chat con las
// opciones, y tipo form de 1 pregunta, respondo 1 y va a la siguiente...». Y después: «las preguntas tipo bloque de Claude en
// la app... siempre deben aparecer en la app de Ops Center».
//   1. el cartero 1.18.0 sube las preguntas de un AskUserQuestion (origen `ask`), con la recomendada y un id fijo;
//   2. una de AskUserQuestion queda atrás cuando el chat sigue (Martín la contestó en la app); una de wrap_up, como antes;
//   3. qué va a cada bloque: las de `preguntar` y wrap_up se contestan arriba de la caja; las de la app se ven ahí;
//      lo contestado queda en el hilo como «Decisión: …» y lo superado no se dibuja;
//   4. el bloque: «1 de 2», la recomendada marcada, «Escribe otra cosa»; con una sola, sin el contador; las de la app, sin
//      poder contestarlas; y las dos pantallas lo montan;
//   5. la regla para los chats (AGENTS.md): preguntar con `cartero preguntar`, con su ejemplo.
//
// Correr: node --import tsx --test tests/ops-center-decisiones.test.ts
// PROBADO ROMPIÉNDOLO (base 5/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sanearPregunta, superarPreguntas, textoDeDecision, type PreguntaChat } from '../lib/centro-preguntas-chat';
import { historialDelChat, preguntasDeLaApp, preguntasParaElBloque, type ChatCentro } from '../lib/centro-chats';
import { BloqueDePreguntas } from '../app/admin/operaciones/PreguntasDelChat';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const cartero = () => import('../scripts/operaciones/cartero.mjs');
const LOCAL = 'local_428051c1-0369-4df2-ae6b-bcb42f63b64b';

// Un AskUserQuestion con la forma del transcript (las del Cerebro del 22/10, cortas).
const ask = JSON.stringify({
  type: 'assistant', uuid: 'a-ask-0001', timestamp: '2026-10-22T12:00:00Z',
  message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_ASK1', name: 'AskUserQuestion', input: { questions: [
    { question: '¿Subo hoy el instalador 0.3.2?', header: 'Instalador', multiSelect: false, options: [
      { label: 'Lo subo yo', description: 'Queda esperando.' },
      { label: 'Súbelo ya (Recommended)', description: 'Lo sube el chat IA del cliente.' },
    ] },
    { question: '¿Qué canales activo?', header: 'Canales', multiSelect: true, options: [
      { label: 'WhatsApp', description: 'La línea no oficial.' }, { label: 'Email', description: 'Desde el dominio del negocio.' },
    ] },
  ] } }] },
});

test('1. el cartero sube las preguntas de un AskUserQuestion: una por pregunta, con su recomendada, y con el mismo id siempre', async () => {
  const { turnosDeLineas, VERSION } = await cartero();
  assert.equal(VERSION, '1.27.0'); // 1.27.0: `preguntar` rechaza la pregunta técnica (tests/pregunta-para-martin.test.ts); 1.26.1: la revisión del servicio (tests/cartero-servicio.test.ts); 1.26.0: lo que espera un chat cerrado le llega al Cerebro; 1.24.0: el pedido delegado desde el grupo (tests/tickets-al-cerebro.test.ts); 1.23.0: los tickets que esperan a Martín le llegan al Cerebro (tests/tickets-al-cerebro.test.ts); 1.22.1: el pedido dice cómo se escribe el cierre; 1.22.0: los adjuntos del chat nuevo (tests/centro-nuevo-con-adjuntos.test.ts); 1.21.0: el resumen del wrap_up (tests/chat-en-el-acto.test.ts); 1.20.0: el ticket aprobado por regla (tests/feedback-2710-tanda1.test.ts); 1.18.1: «la última de cada chat», sólo de wrap_up; 1.19.0: los turnos, enteros (tests/turnos-enteros.test.ts)
  const r = turnosDeLineas([ask]);
  assert.equal(r.preguntas.length, 2);
  const [a, b] = r.preguntas;
  assert.equal(a.origen, 'ask');
  assert.equal(a.pregunta, '¿Subo hoy el instalador 0.3.2?');
  assert.equal(a.contexto, 'Instalador', 'el tema corto de Claude, como contexto');
  assert.deepEqual(a.opciones.map((o: { titulo: string }) => o.titulo), ['Lo subo yo', 'Súbelo ya'], 'sin el «(Recommended)» en el título');
  assert.equal(a.recomendada, 1);
  assert.equal(b.varias, true);
  assert.equal(turnosDeLineas([ask]).preguntas[0].id, a.id, 'releer el transcript sube la MISMA pregunta');
  assert.ok(sanearPregunta({ ...a, local: LOCAL }), 'MaKo la acepta, con su origen');
  assert.equal(sanearPregunta({ ...a, local: LOCAL })!.origen, 'ask');
});

const pq = (id: string, at: string, extra: Partial<PreguntaChat> = {}): PreguntaChat => ({
  id, local: LOCAL, pregunta: `Pregunta ${id.slice(0, 4)}`, contexto: null, opciones: [{ titulo: 'Sí', detalle: null }, { titulo: 'No', detalle: null }],
  recomendada: 0, varias: false, at, respuesta: null, ...extra,
});
const ID = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-000000000000`;

test('2. la de la app queda atrás cuando el chat sigue (Martín la contestó ahí); la de wrap_up, pasado el margen de su cierre', () => {
  const deApp = pq(ID(1), '2026-10-22T12:00:00Z', { origen: 'ask' });
  const deWrap = pq(ID(2), '2026-10-22T12:00:00Z', { origen: 'wrap_up' });
  const delChat = [{ local: LOCAL, rol: 'el', at: '2026-10-22T12:05:00Z' }];
  const [a, w] = superarPreguntas([deApp, deWrap], delChat);
  assert.equal(a.superada, '2026-10-22T12:05:00.000Z', 'lo que el chat escribe después la deja atrás');
  // Desde el 27/10 lo del chat también deja atrás una de wrap_up, pero no su propio mensaje de cierre (el margen):
  // tests/preguntas-superadas-hueco.test.ts.
  assert.equal(w.superada, undefined, 'su propio mensaje de cierre la dejó atrás');
  assert.equal(superarPreguntas([deApp], [{ local: LOCAL, rol: 'el', at: '2026-10-22T11:59:00Z' }])[0].superada, undefined, 'lo de ANTES no cuenta');
});

test('3. qué va a cada bloque, y cómo queda en el hilo', () => {
  const chat = { clave: LOCAL, miembros: [LOCAL], pedidos: [], trabajos: [] } as unknown as ChatCentro;
  const preguntas = [
    pq(ID(3), '2026-10-22T12:02:00Z'),                                            // de `preguntar`, abierta
    pq(ID(4), '2026-10-22T12:01:00Z', { origen: 'wrap_up' }),                      // de wrap_up, abierta (más vieja)
    pq(ID(5), '2026-10-22T12:03:00Z', { origen: 'ask' }),                          // de la app
    pq(ID(6), '2026-10-22T11:00:00Z', { respuesta: { elegidas: [1], otra: 'mañana', at: '2026-10-22T11:30:00Z', trabajo: ID(9) } }),
    pq(ID(7), '2026-10-22T10:00:00Z', { origen: 'wrap_up', superada: '2026-10-22T10:30:00Z' }),
  ];
  const lineas = historialDelChat(chat, new Map(), [], [], [], preguntas);
  assert.deepEqual(preguntasParaElBloque(lineas).map((p) => p.id), [ID(4), ID(3)], 'las que se contestan acá, la más vieja primero');
  assert.deepEqual(preguntasDeLaApp(lineas).map((p) => p.id), [ID(5)], 'las de la app, aparte');
  assert.equal(textoDeDecision(preguntas[3], preguntas[3].respuesta!), 'Decisión: No · mañana');
  const hilo = sinComentarios(leer('app/admin/operaciones/Hilo.tsx'));
  const rama = hilo.slice(hilo.indexOf("if (l.tipo === 'pregunta') {"), hilo.indexOf("if (l.tipo === 'trabajo') return"));
  assert.match(rama, /if \(!r && !l\.trabajo\) return null;/, 'la abierta va arriba y la superada no se dibuja');
  assert.match(rama, /\{r \? textoDeDecision\(l\.pregunta, r\) : 'Decisión enviada'\}/);
  assert.doesNotMatch(hilo, /<PreguntaChat /, 'la tarjeta de la pregunta ya no va en el hilo');
});

test('4. el bloque: de a una con «1 de 2», la recomendada marcada y «otra cosa»; las de la app, sin contestar; en las dos pantallas', () => {
  const dos = [pq(ID(3), '2026-10-22T12:02:00Z'), pq(ID(4), '2026-10-22T12:03:00Z')];
  const html = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'x', delChat: dos, onResponder: async () => null }));
  assert.match(html, /1 de 2/);
  assert.match(html, /Pregunta 0000/);
  assert.match(html, /\(Recomendada\)/);
  assert.match(html, /placeholder="Escribe otra cosa"/);
  const una = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'x', delChat: [dos[0]], onResponder: async () => null }));
  assert.doesNotMatch(una, /1 de 1/, 'con una sola no hay contador: tocar una opción la manda');
  const app = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'x', deLaApp: [pq(ID(5), '2026-10-22T12:03:00Z', { origen: 'ask' })] }));
  // 24/10/2026: arriba, y también en el teléfono (tests/ops-pregunta-app-movil.test.ts).
  assert.match(app, /Se contesta en la app de Claude, en la computadora: desde aquí no se puede/);
  assert.doesNotMatch(app, /<button[^>]*class="co-preg__op"|<input/, 'no se contesta desde acá');
  const comp = sinComentarios(leer('app/admin/operaciones/PreguntasDelChat.tsx'));
  assert.match(comp, /if \(delChatAbiertas\.every\(\(q\) => todo\[q\.id\]\)\) \{ void enviar\(todo\); return; \}/, 'con una sola pregunta, sale al elegir; con varias, al contestar todas');
  assert.match(comp, /for \(const q of delChatAbiertas\) \{/, 'al final salen todas, en orden');
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /<BloqueDePreguntas key=\{`b-\$\{/, `${f}: el bloque`);
    assert.match(src, /deLaApp=\{deLaApp\} \/>/, `${f}: las de la app, en el mismo bloque`);
    assert.match(src, /const bloque = preguntasParaElBloque\(lineas\);/);
  }
  assert.match(leer('app/admin/operaciones/centro.css'), /@media \(hover: none\) and \(pointer: coarse\) \{ \.co-preg--arriba \.co-preg__op \{ min-height: 48px; \}/, 'en el teléfono, del alto de un dedo');
});

test('5. la regla para los chats: preguntar con `cartero preguntar`, con su ejemplo', () => {
  const agents = leer('AGENTS.md');
  assert.match(agents, /NO LE PREGUNTES A MARTÍN CON AskUserQuestion/);
  const ejemplo = /```json\n(\{[\s\S]*?\})\n```\n\nSi una pregunta tuya/.exec(agents)?.[1];
  assert.ok(ejemplo, 'falta el ejemplo del archivo');
  const j = JSON.parse(ejemplo!);
  assert.ok(sanearPregunta({ ...j, id: ID(8), local: LOCAL, at: '2026-10-22T12:00:00Z', respuesta: null }), 'el ejemplo es una pregunta válida');
  assert.equal(j.recomendada, 0);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 5/0):
//   · el cartero sin `preguntasDeAsk` en turnosDeLineas                    → 4/1 (1)
//   · superarPreguntas sin el caso `ask`                                    → 4/1 (2)
//   · el bloque con las de la app adentro (sin el filtro de seContestaEnLaApp) → 4/1 (3)
//   · el hilo dibujando la pregunta abierta otra vez                        → 4/1 (3)
//   · con una sola pregunta, el contador «1 de 1»                           → 4/1 (4)

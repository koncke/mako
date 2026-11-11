// =============================================================================
// La pregunta de la app de Claude en el teléfono, y el mensaje que espera dice por qué (24/10/2026)
// =============================================================================
// Martín, desde el teléfono: «Intenté responder esa pregunta en mobile y no funcionó, en Ops Center... Y respondí a mano,
// y no se envió el mensaje». Medido con un teléfono emulado de verdad (CDP, 390 × 844, toques con Input.dispatchTouchEvent):
// las preguntas de `cartero preguntar` SÍ se tocan (con el hilo corto y largo, con y sin temblor del dedo). La que no se
// pudo era un AskUserQuestion del Cerebro: el Ops Center la muestra y a propósito no la contesta (mientras espera, al chat
// no le entra nada: medido el 22/10). En el teléfono se veía igual que una que se contesta, y el renglón que lo explicaba lo
// escondía la regla táctil de centro.css. Y su mensaje decía «El Runner lo toma en segundos» con el chat trabado.
//   1. con el chat trabado en una pregunta de la app, el mensaje lo dice EN EL ACTO;
//   2. sin nada que lo frene, no promete segundos: la PC lo toma en su vuelta, y dice cuándo fue la última;
//   3. la pregunta de la app dice arriba por qué no se contesta desde acá y lo que cuesta, también en el teléfono;
//   4. las dos pantallas le pasan al hilo que el chat está trabado.
//
// Correr: node --import tsx --test tests/ops-pregunta-app-movil.test.ts
// Probado rompiéndolo (24/10/2026, con la base en 0 fallos):
//   · `trabado` esperando `TARDA_MS` como lo demás              → 1 fallo (1);
//   · de vuelta «El Runner lo toma en segundos.»                 → 1 fallo (2);
//   · el aviso abajo, como el pie viejo (la regla táctil lo esconde) → 1 fallo (3);
//   · el teléfono sin `trabado` en `vivo`                        → 1 fallo (4).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { POR_QUE_TRABADO, TARDA_MS, estadoDelEnvio, type CarteroP, type TrabajoP } from '../lib/centro-chats';
import { BloqueDePreguntas } from '../app/admin/operaciones/PreguntasDelChat';
import type { PreguntaChat } from '../lib/centro-preguntas-chat';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const AHORA = Date.parse('2026-10-24T18:22:00Z'); // 15:22 en Argentina, la hora del mensaje de Martín
const iso = (msAntes: number) => new Date(AHORA - msAntes).toISOString();
const S1 = 'local_94ec0e46-f987-4530-a3cc-c5c1a0bc0601';
const chatPC = { local: S1, titulo: 'Cerebro', cuenta: 'claude1', vivo: true, estado: 'idle' as const, actividad: iso(60_000), runner: true };
const carteros: CarteroP[] = [{ cuenta: 'claude1', vistoAt: iso(20_000), chats: [chatPC] }];
const trabajo = (estado: TrabajoP['estado'], msAntes: number): TrabajoP => ({
  id: 't1', destino: S1, destino_titulo: 'Cerebro', destino_cuenta: 'claude1', created_at: iso(msAntes), texto: 'Sí, y que la criatura vea la hoja', estado, motivo: null, cierre: null,
});
const abierto = { estado: 'abierto' as const, viejo: false };

test('1. con el chat trabado en una pregunta de la app, el mensaje lo dice en el acto', () => {
  assert.deepEqual(estadoDelEnvio(trabajo('escrito', 3_000), abierto, carteros, AHORA, true), { fase: 'enviado', texto: 'Enviado', porQue: POR_QUE_TRABADO },
    'a los 3 segundos ya: esperar 30 era lo que lo hacía parecer roto');
  assert.equal(estadoDelEnvio(trabajo('tomado', 3_000), abierto, carteros, AHORA, true)?.porQue, POR_QUE_TRABADO);
  assert.equal(estadoDelEnvio(trabajo('entregado', 3_000), abierto, carteros, AHORA, true), null, 'lo que ya tiene el chat lo dicen los ✓✓');
  assert.match(POR_QUE_TRABADO, /app de Claude, en la computadora/);
  assert.equal(estadoDelEnvio(trabajo('escrito', 3_000), abierto, carteros, AHORA)?.porQue, null, 'sin trabarse, recién mandado no tiene motivo');
});

test('2. sin nada que lo frene, no promete segundos: dice cuándo fue la última vuelta', () => {
  const r = estadoDelEnvio(trabajo('escrito', TARDA_MS + 5_000), abierto, carteros, AHORA);
  assert.equal(r?.porQue, 'La PC lo toma en su próxima vuelta (la última, a las 15:21).');
  assert.doesNotMatch(String(r?.porQue), /segundos/);
  assert.doesNotMatch(leer('lib/centro-chats.ts'), /lo toma en segundos/);
});

test('3. la pregunta de la app dice ARRIBA por qué no se contesta desde acá, también en el teléfono', () => {
  const p: PreguntaChat = {
    id: '6b1f8a52-1111-4222-8333-944455556666', local: S1, pregunta: '¿Sacamos también «Analizar con MaKo» del menú?', contexto: null,
    opciones: [{ titulo: 'Sí', detalle: null }, { titulo: 'No', detalle: null }], recomendada: 0, varias: false, at: iso(60_000), respuesta: null, origen: 'ask',
  };
  const html = renderToStaticMarkup(createElement(BloqueDePreguntas, { chat: 'Cerebro', deLaApp: [p] }));
  const aviso = html.indexOf('co-preg__aviso-app');
  assert.ok(aviso > 0, 'el aviso está');
  assert.ok(aviso < html.indexOf('co-preg__texto'), 'arriba de la pregunta: es lo primero que se lee');
  assert.match(html, /Hasta entonces, el chat no lee lo que le escribas/, 'y lo que cuesta');
  assert.doesNotMatch(html, /class="co-preg__pie"/, 'nada en el pie, que la regla táctil esconde');
  assert.doesNotMatch(html, /role="button"|<input/, 'no se contesta desde acá');
  const css = sinComentarios(leer('app/admin/operaciones/centro.css'));
  const tactil = css.match(/@media \(hover: none\) and \(pointer: coarse\) \{ \.co-preg__ayuda[^\n]*/)?.[0] ?? '';
  assert.ok(tactil, 'la regla táctil del bloque');
  assert.doesNotMatch(tactil, /aviso-app/, 'la regla táctil no esconde el aviso');
  assert.match(css, /\.co-preg--app \.co-preg__op--leer \.co-preg__num \{ border-color: transparent; background: none; \}/, 'las opciones, sin la caja de un botón');
});

test('4. las dos pantallas le pasan al hilo que el chat está trabado', () => {
  for (const f of ['app/m/operaciones/ChatsMovil.tsx', 'app/admin/operaciones/Conversacion.tsx']) {
    const s = sinComentarios(leer(f));
    // Con TODAS las de la app, también las técnicas que no se le muestran a Martín (10/11/2026: `chatTrabadoEnLaApp`; ejecutado en
    // tests/pregunta-para-martin.test.ts, 6): el chat sigue trabado aunque su pregunta no suba al bloque.
    assert.match(s, /const trabado = chatTrabadoEnLaApp\(lineas\);/, `${f}: con una pregunta de la app abierta`);
    assert.match(s, /chat(?:: elegido)?, carteros, trabado(?:, indiceTabs)? \}/, `${f}: \`trabado\` en \`vivo\``);
  }
  assert.match(sinComentarios(leer('app/admin/operaciones/Hilo.tsx')), /estadoDelEnvio\(w, vivo\.chat, vivo\.carteros, ahora, !!vivo\.trabado\)/);
});

// =============================================================================
// Un cliente con UNA sola key no tiene cascada
// =============================================================================
// 2026-08-25, 02:45 UTC. Un cliente escribió y MaKo le contestó con un error. En
// `anthropic_usage` no hay NI UNA llamada de ese minuto, y 74 segundos después la
// misma consulta funcionó perfecto: Gemini había tenido un bache.
//
// El ws13 tiene cargada `GEMINI_API_KEY` y nada más. La cascada del doer prueba
// [gemini, groq, cerebras, mistral, openai] y las últimas cuatro devuelven null al
// instante por falta de key: **cinco casilleros, un solo intento real.** Y encima
// `chatCheapTools` —el camino del tool-use, o sea el de WhatsApp— pegaba UNA vez y
// tiraba, mientras la otra mitad del módulo (`chatCheapCascade`) ya reintentaba.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const NL = String.fromCharCode(10);
const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

test('El camino del tool-use no pega una sola vez: lo que decide qué hacer con un fallo es la rotación', () => {
  // ⚠️ Desde el 07/10/2026 la decisión vive en lib/ia-rotacion-modelo.ts, con su test que
  // la EJECUTA (tests/ia-rotacion-modelo.test.ts): una saturación se reintenta o rota de
  // modelo, y un 429 NO se le vuelve a pedir al mismo modelo — rota al otro, que tiene su
  // propio cupo, o espera lo que DIJO el proveedor si el que llama lo permite.
  const src = leer('../lib/ai-cheap.ts');
  const i = src.indexOf('export async function chatCheapTools');
  const cuerpo = src.slice(i, src.indexOf('export async function chatCheapToolsCascade'));
  assert.match(cuerpo, /rotacion\.trasFallo\(/,
    'chatCheapTools volvió a pegar una sola vez: un 503 de segundos mata el turno');
});

test('Reintentar un PEDIDO nunca repite una tool; re-arrancar el TURNO sí, y eso lo corta la cascada', () => {
  // ⚠️ Esta regla decía «nunca se reintenta después de que una tool tocó datos» y fijaba la
  // ventana `toolsUsados > 0 || intento >= 1`. Mezclaba dos cosas: repetir el pedido que
  // falló (las tools corren sólo con una respuesta buena, y lo que ya corrieron está en la
  // conversación: no se repite nada) y re-arrancar el turno con otro proveedor (eso SÍ las
  // vuelve a correr). Por la primera se tiró el turno de Brigitte con seis pasos hechos. La
  // invariante de verdad se fija en tests/ia-rotacion-modelo.test.ts; acá queda la otra mitad.
  const src = leer('../lib/ai-cheap.ts');
  const i = src.indexOf('export async function chatCheapToolsCascade');
  const cascada = src.slice(i, src.indexOf(NL + '}', i) + 2);
  assert.match(cascada, /if \(ejecutó\) throw e/,
    'la cascada volvió a re-arrancar el turno después de que una tool tocó datos: puede duplicarla');
});

// Probado rompiéndolo: devolviendo mistral a la lista, 4 pasan y 1 falla.
test('La red de plataforma es solo GRATIS y solo último recurso', () => {
  const src = leer('../lib/ai-cheap.ts');
  const i = src.indexOf('export async function provsGratisDePlataforma');
  // ⚠️ El cuerpo se corta en la llave de cierre de la función, NO a los 700
  // caracteres. La versión vieja contaba caracteres y se puso roja el 01/10/2026
  // con «la red perdió gemini» cuando lo único que había pasado era que el
  // comentario de por qué salió mistral empujó el `for` fuera de la ventana.
  const cuerpo = src.slice(i, src.indexOf(NL + '}', i) + 2);
  assert.ok(i > 0, 'desapareció la red de plataforma: un cliente con una key vuelve a quedar sin cascada');
  // ⚠️ `openai` y `anthropic` NO: ahí una llamada de más es una FACTURA de más, y
  // eso es una decisión de plata que no toma el código.
  assert.ok(!/'openai'|'anthropic'/.test(cuerpo),
    'entró un proveedor que COBRA a la red de plataforma: eso le factura a la agencia sin que nadie lo decida');
  for (const p of ['gemini', 'groq']) {
    assert.ok(cuerpo.includes(`'${p}'`), `la red perdió ${p}`);
  }
  // ⚠️ MISTRAL SALIÓ, por el mismo motivo que cerebras y con una medición propia.
  // Devuelve 429 SIEMPRE (`limit-req-minute: 0`), así que no es un escalón de la
  // cascada: es una línea de «rate limit» GARANTIZADA en la lista con la que
  // `causaDelFallo` elige el texto que lee el cliente. El 30/09 se lo sacó de la
  // cascada propia del doer y quedó vivo acá — que es la lista que corre cuando al
  // cliente no le contesta nadie, o sea el peor momento posible.
  //
  // Medido el 01/10/2026 en el ws13: las TRES keys de mistral DE LA AGENCIA
  // devolvieron 429 en el mismo turno, y esos tres fueron los únicos errores de cuota
  // de la lista. El cliente leyó «te quedaste sin cuota de IA» con su propia key
  // contestando HTTP 200.
  assert.ok(!cuerpo.includes(`'mistral'`),
    'volvió mistral a la red: su 429 crónico le FABRICA el veredicto «sin cuota» al cliente');
  // ⚠️ CEREBRAS SALIÓ, y tiene que quedar afuera. Medido el 16/08 contra las SIETE keys
  // cargadas en cinco workspaces distintos: las siete devuelven HTTP 402 «Payment
  // required». No es una cuenta sin saldo, es que ya no hay tier gratis. Dejarlo en la
  // red le suma a cada cascada un viaje de ida y vuelta para volver con un 402, y le
  // ofrece al usuario sacar una key que nunca va a funcionar.
  assert.ok(!cuerpo.includes(`'cerebras'`),
    'volvió cerebras a la red: no tiene tier gratis en ninguna cuenta (402 en las 7 medidas)');

  // Y solo se usa cuando lo del cliente ya falló.
  const doer = leer('../lib/mako-doer-in.ts');
  const j = doer.indexOf('provsGratisDePlataforma()');
  assert.ok(j > 0, 'el doer dejó de usar la red de plataforma');
  assert.ok(doer.slice(j - 200, j).includes('if (!respuesta)'),
    'la red de plataforma dejó de ser el ÚLTIMO recurso: le gastaría cuota a la agencia teniendo el cliente la suya');
});

test('La red tiene presupuesto de tiempo y no arranca por el que ya falló', () => {
  const doer = leer('../lib/mako-doer-in.ts');
  // Del otro lado hay alguien mirando el chat: 11 keys sin tope son un minuto.
  assert.match(doer, /const limite = Date\.now\(\) \+ 25_000/,
    'la red de plataforma perdió su presupuesto de tiempo');
  // Si el cliente corre en Gemini y Gemini está saturado, la Gemini de la agencia
  // lo está igual: es el mismo servicio. Medido — dos keys de Gemini se comieron
  // los 25 s enteros en la verificación de este arreglo.
  assert.match(doer, /distintoPrimero/,
    'la red volvió a arrancar por el proveedor que acaba de fallar');
});

test('El aviso de error no puede apoyarse en una clasificación DUDOSA', () => {
  // «soy mako obvio que puedo responderte» cayó en `capturar (dudosa)` —el default
  // de «sin señal clara»— y `esRutaPlan` da true para `→ capturar`, así que la
  // suposición elegía el texto del error y salía «No pude armar el borrador».
  const doer = leer('../lib/mako-doer-in.ts');
  // Lo que se afirma es la REGLA, no una línea literal: «era de plan» tiene que
  // exigir que la clasificación NO sea dudosa, esté escrito donde esté.
  assert.match(doer, /const eraDePlan = esCargaDePlan\(texto\) \|\| \(esRutaPlan\(ruta\.motivo\) && !intencion\.dudosa\)/,
    'el texto del error volvió a decidirse con la adivinanza del clasificador');
  assert.match(doer, /avisoNoPude\(eraDePlan\)/, 'se desconectó `eraDePlan` del aviso');
});

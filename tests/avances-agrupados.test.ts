// =============================================================================
// Los «Avance» seguidos, en UNA burbuja (25/10/2026)
// =============================================================================
// Martín, desde el Centro con captura del chat «Cerebro» en el teléfono: «me llegan una cantidad impresionante de mensajes de
// "avance", podrían agruparlos todos en 1 de ultima y que dentro tenga varios desplegables». Esto fija:
//   1. qué va junto (`agruparAvances`): dos o más avances seguidos del mismo día; lo que no es avance corta (lo que escribió
//      Martín, un «Ya está»), el cambio de día también, y uno solo queda como estaba. NINGUNO se pierde ni se agrega;
//   2. la burbuja (Hilo.tsx, la misma de la computadora y del teléfono): el último entero arriba y los anteriores como filas
//      que se abren, del más nuevo al más viejo, con «Ver los otros» después de cinco;
//   3. la API (`ver_mensajes_operaciones`): una lectura sólo de la plataforma y nunca por HTTP, con el mismo agrupado que la
//      pantalla y el texto entero de cada avance;
//   4. lo «sin ver» no mira los grupos: cuenta líneas;
//   5. la API trae las preguntas del chat y lo que contestó Martín, y cortan las tandas como en la pantalla (26/10/2026, la
//      revisión del tren-m: sin ellas, la respuesta no salía por ningún lado y dos tandas salían juntas).
//
// PROBADO ROMPIÉNDOLO (25/10/2026, base 4/0): sin cortar en lo que no es avance → 2 rojos (1 y 3); sin el corte de día → 1 rojo
// (1); agrupar de a uno → 2 rojos (1 y 2); los anteriores sin `.reverse()` → 1 rojo (2); la fila con `text-overflow: ellipsis`
// → 1 rojo (2); la lectura con 'http' → 1 rojo (3); el cuerpo sin `agruparAvances` → 2 rojos (3 y 4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { agruparAvances, lineasDeConversacion, lineasParaLaApi, piezaParaLaApi, type LineaChat, type PiezaDelHilo, type TrabajoP } from '../lib/centro-chats';
import type { PreguntaChat } from '../lib/centro-preguntas-chat';
import { DEFS } from '../lib/api-mako/areas/operaciones.def';
import { Hilo } from '../app/admin/operaciones/Hilo';
import type { TurnoChat } from '../lib/operaciones-reglas';

const LOCAL = 'local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8';
const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const turno = (uuid: string, rol: TurnoChat['rol'], at: string, texto: string): LineaChat =>
  ({ tipo: 'turno', instante: Date.parse(at), turno: { local: LOCAL, uuid, rol, de: rol === 'otro' ? 'CRM' : null, texto, at, trabajo: null } });
const uuids = (p: PiezaDelHilo) => (p.tipo === 'avances' ? p.avances.map((l) => (l.tipo === 'turno' ? l.turno.uuid : '?')) : [p.tipo === 'turno' ? p.turno.uuid : p.tipo]);

test('1. qué va junto: los avances seguidos del mismo día; lo demás corta, y ninguno se pierde', () => {
  const todas = [
    turno('o1', 'otro', '2026-10-25T12:00:00Z', 'CRM › lista la rama.'),
    turno('a1', 'el', '2026-10-25T12:01:00Z', 'CRM dejó lista su rama.'),
    turno('a2', 'el', '2026-10-25T12:02:00Z', 'La mezclo con el tren.'),
    turno('a3', 'el', '2026-10-25T12:03:00Z', 'Corren los tests del tren.'),
    turno('y1', 'el', '2026-10-25T12:04:00Z', 'Ya está: el filtro del CRM.'), // un «Ya está» es para Martín: corta
    turno('a4', 'el', '2026-10-25T12:05:00Z', 'Los tests dieron verde.'),
    turno('m1', 'yo', '2026-10-25T12:06:00Z', 'Ya esta el deploy?'), // Martín: corta, y lo que sigue ya es para él
    turno('r1', 'el', '2026-10-25T12:07:00Z', 'Todavía no: sube a las 00:00.'),
    turno('o2', 'otro', '2026-10-25T12:30:00Z', 'Landings › lista.'),
    turno('a5', 'el', '2026-10-25T12:31:00Z', 'Landings dejó su arreglo listo.'), // uno solo: queda como estaba
    turno('m2', 'yo', '2026-10-26T02:00:00Z', '¿Y Landings?'),
    turno('o3', 'otro', '2026-10-26T02:40:00Z', 'Voz › medido.'),
    turno('a6', 'el', '2026-10-26T02:50:00Z', 'Voz midió la voz.'), // 23:50 en Argentina…
    turno('a7', 'el', '2026-10-26T03:10:00Z', 'Queda anotada.'), // …y 00:10 del día siguiente: dos burbujas, uno en cada día
  ];
  const conv = lineasDeConversacion(todas);
  const piezas = agruparAvances(conv);
  assert.deepEqual(piezas.map(uuids), [['a1', 'a2', 'a3'], ['y1'], ['a4'], ['m1'], ['r1'], ['a5'], ['m2'], ['a6'], ['a7']]);
  assert.equal(piezas[0].tipo, 'avances');
  assert.equal(piezas[0].instante, Date.parse('2026-10-25T12:03:00Z'), 'la burbuja va a la hora del último');
  assert.deepEqual(piezas.map((p) => p.tipo), ['avances', 'turno', 'turno', 'turno', 'turno', 'turno', 'turno', 'turno', 'turno'],
    'uno solo (a4, a5, y uno a cada lado de la medianoche) queda como estaba, no es un grupo de uno');
  // NI SACA NI AGREGA: las mismas líneas, en el mismo orden, y las MISMAS (lo estable del refresco, lib/centro-estable.ts).
  const planas = piezas.flatMap((p) => (p.tipo === 'avances' ? [...p.avances] : [p]));
  assert.equal(planas.length, conv.length);
  planas.forEach((l, i) => assert.equal(l, conv[i], `la línea ${i} cambió`));
});

const hilo = (n: number) => {
  const lineas: LineaChat[] = [turno('o', 'otro', '2026-10-25T12:00:00Z', 'Automations › lista.')];
  for (let i = 1; i <= n; i++) lineas.push(turno(`av-${i}`, 'el', `2026-10-25T12:${String(i).padStart(2, '0')}:00Z`, `Avance número ${i}. Con su detalle.`));
  lineas.push(turno('yo', 'yo', '2026-10-25T13:00:00Z', 'Ya esta el deploy?'));
  return renderToStaticMarkup(createElement(Hilo, {
    lineas, pushes: [], ahora: Date.parse('2026-10-25T13:05:00Z'), vacio: '', quien: { titulo: 'Cerebro', animo: 'despierto' },
  }));
};

test('2. la burbuja: el último entero arriba, los anteriores del más nuevo al más viejo, y «Ver los otros» después de cinco', () => {
  const html = hilo(8);
  assert.equal(html.match(/class="co-avances"/g)?.length, 1, 'los ocho, en UNA burbuja');
  assert.match(html, /Avance · 8/);
  assert.match(html, /class="co-avances__ultimo co-el__md"[^>]*>[\s\S]*?Avance número 8\. Con su detalle\./, 'el último, entero');
  const filas = [...html.matchAll(/class="co-avances__item"[\s\S]*?class="co-avances__linea">([^<]*)</g)].map((m) => m[1]);
  assert.deepEqual(filas, ['Avance número 7.', 'Avance número 6.', 'Avance número 5.', 'Avance número 4.', 'Avance número 3.'],
    'cinco filas cerradas con su primera oración, del más nuevo al más viejo');
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, />Ver los otros 2</);
  assert.match(html, /Ya esta el deploy\?/, 'lo de Martín, afuera del grupo');
  // Uno solo no es un grupo: se dibuja como antes.
  assert.doesNotMatch(hilo(1), /co-avances/);
  assert.doesNotMatch(hilo(6), />Ver los otr/, 'con cinco anteriores, se ven todos');
  // La oración entera en la fila, en los renglones que hagan falta: nunca un corte por ancho (Martín, 25/10).
  const linea = /\.co-avances__linea \{([^}]*)\}/.exec(leer('app/admin/operaciones/centro.css'))?.[1] ?? '';
  assert.ok(linea, 'falta la regla de la fila');
  assert.doesNotMatch(linea, /ellipsis|nowrap/, 'la fila corta la oración con «…»');
  // El mismo Hilo en las dos pantallas: el teléfono lo importa, no tiene su propia burbuja.
  assert.match(leer('app/m/operaciones/ChatsMovil.tsx'), /from '@\/app\/admin\/operaciones\/Hilo'/);
});

test('3. la API: una lectura de la plataforma, nunca por HTTP, con el mismo agrupado y el texto entero', () => {
  const d = DEFS.find((x) => x.id === 'ver_mensajes_operaciones');
  assert.ok(d, 'falta la operación');
  assert.equal(d.tipo, 'lectura');
  assert.deepEqual(d.gating, { rolMinimo: 'admin', soloPlataforma: true }, 'sólo la plataforma');
  assert.ok(!d.canales.includes('http'), 'nunca por HTTP (como el resto del área)');
  assert.ok(d.parametros.some((p) => p.nombre === 'chat' && p.obligatorio), 'el chat es obligatorio');
  const run = sinComentarios(leer('lib/api-mako/areas/operaciones.run.ts'));
  assert.match(run, /agruparAvances\(lineasDeConversacion\(lineas\)\)/, 'lo mismo que dibuja la pantalla');
  assert.match(run, /chatsPorNombre\(carteros\)/, 'el chat juntado por su nombre, como la lista');
  assert.ok(!leer('tests/api-mako-http.snapshot.txt').includes('ver_mensajes_operaciones'), 'salió por HTTP');

  const [g, suelto] = agruparAvances(lineasDeConversacion([
    turno('o', 'otro', '2026-10-25T12:00:00Z', 'CRM › lista.'),
    turno('a1', 'el', '2026-10-25T12:01:00Z', 'Primero. Con detalle largo.'),
    turno('a2', 'el', '2026-10-25T12:02:00Z', 'Segundo.'),
    turno('a3', 'el', '2026-10-25T12:03:00Z', 'Tercero, entero.'),
    turno('m', 'yo', '2026-10-25T12:04:00Z', '¿Y?'),
  ]));
  assert.deepEqual(piezaParaLaApi(g, 'Cerebro'), {
    tipo: 'avances', cantidad: 3, at: '2026-10-25T12:03:00Z',
    ultimo: { at: '2026-10-25T12:03:00Z', texto: 'Tercero, entero.' },
    anteriores: [
      { at: '2026-10-25T12:02:00Z', resumen: 'Segundo.', texto: 'Segundo.' },
      { at: '2026-10-25T12:01:00Z', resumen: 'Primero.', texto: 'Primero. Con detalle largo.' },
    ],
  });
  assert.deepEqual(piezaParaLaApi(suelto, 'Cerebro'), { tipo: 'mensaje', de: 'Martín', at: '2026-10-25T12:04:00Z', texto: '¿Y?' });
});

test('4. lo «sin ver» y el «Completado» miran líneas, no grupos: el agrupado sólo lo usan la burbuja y la API', () => {
  const usan = ['app', 'lib']
    .flatMap((d) => (readdirSync(join(RAIZ, d), { recursive: true }) as string[]).map((f) => `${d}/${f.replace(/\\/g, '/')}`))
    .filter((f) => /\.tsx?$/.test(f) && /agruparAvances\(/.test(sinComentarios(leer(f)))) // una LLAMADA (la bitácora la nombra en un texto)
    .sort();
  assert.deepEqual(usan, ['app/admin/operaciones/Hilo.tsx', 'lib/api-mako/areas/operaciones.run.ts', 'lib/centro-chats.ts']);
});

test('5. la API trae las preguntas del chat y lo que contestó Martín, y cortan las tandas como en la pantalla', () => {
  const P = '5e9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
  const W = '6f9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';
  const t = (uuid: string, rol: TurnoChat['rol'], at: string, texto: string): TurnoChat =>
    ({ local: LOCAL, uuid, rol, de: rol === 'otro' ? 'CRM' : null, texto, at, trabajo: null });
  const pregunta: PreguntaChat = {
    id: P, local: LOCAL, pregunta: '¿Hago el commit?', contexto: null, opciones: [{ titulo: 'Commit', detalle: null }, { titulo: 'Ahora no', detalle: null }],
    recomendada: 0, varias: false, at: '2026-10-25T12:03:00Z', respuesta: { elegidas: [0], otra: null, at: '2026-10-25T12:03:30Z', trabajo: W },
  };
  const w = (id: string, at: string, texto: string): TrabajoP => ({ id, destino: LOCAL, destino_titulo: 'Cerebro', destino_cuenta: 'claude5', created_at: at, texto, estado: 'entregado', motivo: null, cierre: null });
  const huerfano = w('7a9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed', '2026-10-25T12:06:00Z', '[pregunta 8b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed] Ahora no');
  const lineas = lineasParaLaApi(
    [t('o', 'otro', '2026-10-25T12:00:00Z', 'CRM › lista.'), t('a1', 'el', '2026-10-25T12:01:00Z', 'Uno.'), t('a2', 'el', '2026-10-25T12:02:00Z', 'Dos.'),
      t('a3', 'el', '2026-10-25T12:04:00Z', 'Tres.'), t('a4', 'el', '2026-10-25T12:05:00Z', 'Cuatro.')],
    [w(W, '2026-10-25T12:03:30Z', `[pregunta ${P}] Commit`), huerfano],
    [pregunta],
  );
  const piezas = agruparAvances(lineasDeConversacion(lineas)).map((x) => piezaParaLaApi(x, 'Cerebro'));
  assert.deepEqual(piezas.map((x) => x.tipo), ['avances', 'pregunta', 'avances', 'mensaje'], 'la pregunta no corta la tanda, o se perdió');
  assert.deepEqual(piezas[1], {
    // Con su `id` desde el 5/11/2026: es lo que pide `ignorar_pregunta_operaciones`.
    tipo: 'pregunta', de: 'Cerebro', id: P, at: '2026-10-25T12:03:00Z', pregunta: '¿Hago el commit?', opciones: ['Commit', 'Ahora no'], respuesta: 'Commit', abierta: false,
  });
  // El trabajo que contesta va adentro de su pregunta; uno con la marca de una pregunta que no se conoce, no se pierde.
  assert.equal(piezas.filter((x) => x.tipo === 'mensaje').length, 1);
  assert.equal((piezas[3] as { texto?: string }).texto, huerfano.texto);
  const run = sinComentarios(leer('lib/api-mako/areas/operaciones.run.ts'));
  assert.match(run, /leerPreguntas\(c\.locales\)/, 'la API no lee las preguntas');
  assert.match(run, /lineasParaLaApi\(turnos, pedidos\.filter\(\(p\) => c\.locales\.includes\(p\.destino\)\), preguntas\)/);
  // Lo que deja afuera, dicho: la Ticketera y los pedidos del Plan.
  assert.match(DEFS.find((d) => d.id === 'ver_mensajes_operaciones')?.descripcion ?? '', /NO trae las decisiones de la Ticketera ni los pedidos del Plan/);
});

// PROBADO ROMPIÉNDOLO el 5 (26/10/2026, base 5/0): sin las líneas de pregunta → 1 rojo (5); sin sacar el trabajo que contesta → 1
// rojo (5); descartando el huérfano → 1 rojo (5); la API sin `leerPreguntas` → 1 rojo (5).

// =============================================================================
// Las respuestas de los chats, como una respuesta de Claude (26/10/2026)
// =============================================================================
// Martín, desde el Centro, con captura del cierre «Comprobado · 00:43» del chat «Cerebro» en el teléfono: «Mira que feo el
// formato de las respuestas, mejora eso... Que se parezca a Claude las respuestas». Esto fija, con ESE cierre (el que dejó
// el chat con `cartero cierre`, sacado de su transcripción):
//   1. un «1) … 2) …» corrido es una lista, un ítem por renglón, y lo que no es una lista queda igual;
//   2. el cierre: el texto en Markdown con listas, cada parte con su rótulo ARRIBA (nunca la tabla de dos columnas), la
//      prueba al pie, y el rótulo al lado sólo en la computadora y sólo si todo es corto;
//   3. las respuestas del hilo y del «Ya está» pasan por lo mismo, con el aire de Claude;
//   4. la API devuelve el MISMO texto que se dibuja.
//
// PROBADO ROMPIÉNDOLO (26/10/2026): ver el registro al final del archivo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cierreComoClaude, listasEnRenglones } from '../lib/respuesta-como-claude';
import { piezaParaLaApi, type TrabajoP } from '../lib/centro-chats';
import { Hilo } from '../app/admin/operaciones/Hilo';
import type { Cierre } from '../lib/operaciones-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// El cierre REAL de la captura (26/10/2026 00:43, chat «Cerebro», trabajo 46ab7fa6…).
const CIERRE: Cierre = {
  decidido: 'Lo mejor es mixto: el código que no toca producción va a la nube (ahí la RAM sobra); lo que lee la base, usa tu Chrome o tu PC, y subir el tren, se queda en tu computadora.',
  hecho: 'Desventajas de la nube para lo que hacemos hoy: 1) no ve la base de producción ni sus claves: no mide datos, no aplica migraciones, no prueba con datos reales. 2) No usa tu Chrome: nada de WhatsApp Web, la extensión, Facebook, Madgicx ni Meta. 3) No ve las memorias ni le escribe al Cerebro: deja su rama y un resumen, y lo junto yo. 4) MaKo Desktop y la voz se prueban en Windows, en tu PC. 5) Cada rama que sube dispara un build de Vercel, que se paga. 6) Gasta la misma cuota de la cuenta.',
  comprobado: 'Ya probado el 17/10: un chat en la nube (Web Generator) arrancó y trabajó desde GitHub; la regla quedó en la memoria «Chats en la nube».',
  sigue: 'Si quieres, los chats de pura pantalla (diseño, tests, textos) los abro en la nube desde mañana y acá quedan producción, Chrome, Desktop y el tren. La otra salida, sin cambiar nada, son 32 GB de RAM (unos US$ 290).',
  prueba: 'memoria chats-en-la-nube (17/10)',
};

test('1. un «1) … 2) …» corrido es una lista, un ítem por renglón; lo que no es una lista queda igual', () => {
  const r = listasEnRenglones(CIERRE.hecho).split('\n');
  assert.equal(r[0], 'Desventajas de la nube para lo que hacemos hoy:');
  assert.equal(r[1], '');
  assert.deepEqual(r.slice(2).map((x) => x.slice(0, 3)), ['1. ', '2. ', '3. ', '4. ', '5. ', '6. ']);
  assert.equal(r[2], '1. no ve la base de producción ni sus claves: no mide datos, no aplica migraciones, no prueba con datos reales.');
  assert.equal(r[7], '6. Gasta la misma cuota de la cuenta.');
  for (const igual of [
    CIERRE.comprobado, // sin números
    'Lo dejé en la opción (ver 2) de la lista.', // un «2)» suelto
    'Paso 1) y nada más.', // uno solo
    'Elegí la opción 3) y después la 5) del menú.', // dos que no van seguidos desde el 1
    '1. Ya viene en renglones\n2. Como corresponde',
    '```\nnpm run 1) build 2) test\n```', // adentro del código
  ]) assert.equal(listasEnRenglones(igual), igual, igual);
  assert.equal(listasEnRenglones(listasEnRenglones(CIERRE.hecho)), listasEnRenglones(CIERRE.hecho), 'pasarlo dos veces lo cambia');
});

const ID = '46ab7fa6-08aa-4486-89cf-cd7f27eb035c';
const LOCAL = 'local_3f1a66d3-690f-4ebc-bd98-7dcf1cf14bb8';
const conCierre = (cierre: Cierre): TrabajoP => ({
  id: ID, destino: LOCAL, destino_titulo: 'Cerebro', destino_cuenta: 'claude5', created_at: '2026-10-26T03:41:00.000Z',
  texto: 'Para todas las tareas…', estado: 'comprobado', motivo: null, cierre, cerrado_at: '2026-10-26T03:43:00.000Z',
});
const hilo = (w: TrabajoP) => renderToStaticMarkup(createElement(Hilo, {
  lineas: [{ tipo: 'trabajo', instante: Date.parse(w.created_at), trabajo: w }], pushes: [], ahora: Date.parse('2026-10-26T03:44:00.000Z'), vacio: '',
  quien: { titulo: 'Cerebro', animo: 'despierto' },
}));

test('2. el cierre: Markdown con listas, el rótulo ARRIBA de cada parte, la prueba al pie', () => {
  const html = hilo(conCierre(CIERRE));
  assert.doesNotMatch(html, /<dl|<dt|<dd/, 'volvió la tabla de dos columnas');
  assert.match(html, /<ol start="1"[^>]*>(?:<li[^>]*>[\s\S]*?<\/li>){6}<\/ol>/, 'el «1) … 6)» no es una lista de seis');
  const partes = [...html.matchAll(/class="co-cierre__parte"><p class="co-cierre__rotulo">([^<]+)<\/p><div class="co-cierre__texto co-el__md">/g)].map((m) => m[1]);
  assert.deepEqual(partes, ['Decidido', 'Comprobado', 'Sigue'], 'cada parte con su rótulo arriba de su texto');
  assert.match(html, /class="co-cierre"/, 'largas: no van en columna');
  assert.match(html, /<p class="co-cierre__prueba">memoria chats-en-la-nube \(17\/10\)<\/p>/, 'la prueba al pie');
  // Cortas: el rótulo al lado, pero sólo en la computadora (centro.css).
  assert.match(hilo(conCierre({ decidido: 'Mixto.', hecho: 'Listo.', comprobado: 'Probado el 17/10.', sigue: 'Nada.', prueba: null })), /class="co-cierre co-cierre--corto"/);
  const css = leer('app/admin/operaciones/centro.css');
  const media = /@media \(min-width: 641px\) \{\n(  \.co-cierre[^\n]*\n)+\}/.exec(css)?.[0] ?? '';
  assert.match(media, /\.co-cierre--corto \{ display: grid/, 'la columna no está en su media query de computadora');
  assert.doesNotMatch(css.replace(media, ''), /\.co-cierre--corto \{ display: grid/, 'la columna se ve en el teléfono');
});

test('3. las respuestas del hilo y del «Ya está» pasan por lo mismo, con el aire de Claude', () => {
  const hiloTsx = sinComentarios(leer('app/admin/operaciones/Hilo.tsx'));
  assert.match(hiloTsx, /<Markdown text=\{listasEnRenglones\(texto\)\} enlaces aire \/>/, 'MarkdownDeTurno');
  assert.doesNotMatch(hiloTsx, /conFormato\(c\.(hecho|decidido|comprobado|sigue)/, 'una parte del cierre sin Markdown');
  const avance = sinComentarios(leer('app/admin/operaciones/Avance.tsx'));
  assert.equal([...avance.matchAll(/<Markdown text=\{listasEnRenglones\([^)]+\)\} enlaces aire \/>/g)].length, 3, 'el «Ya está»');
  assert.doesNotMatch(avance, /<Markdown text=\{(?!listasEnRenglones)/, 'un Markdown del «Ya está» sin arreglar');
  // El aire no cambia nada afuera del Ops Center: sin `aire`, el Markdown de siempre.
  const md = sinComentarios(leer('app/_components/Markdown.tsx'));
  assert.match(md, /margin: aire \? '0 0 10px' : compacto \? '2px 0' : '3px 0'/);
});

test('4. la API devuelve el MISMO texto que se dibuja', () => {
  const c = cierreComoClaude(CIERRE);
  assert.equal(c.hecho, listasEnRenglones(CIERRE.hecho));
  assert.equal(c.prueba, CIERRE.prueba);
  const run = sinComentarios(leer('lib/api-mako/areas/operaciones.run.ts'));
  assert.match(run, /cierre: p\.cierre \? cierreComoClaude\(p\.cierre\) : null,/, 'ver_pedidos_operaciones');
  assert.match(run, /respuesta: t \? listasEnRenglones\(t\.texto\) : null,/, 'ver_completados_operaciones');
  const t = { local: LOCAL, uuid: 'u1', rol: 'el' as const, de: null, texto: CIERRE.hecho, at: '2026-10-26T03:43:00.000Z', trabajo: null };
  const p = piezaParaLaApi({ tipo: 'turno', instante: Date.parse(t.at), turno: t }, 'Cerebro');
  assert.equal('texto' in p ? p.texto : '', listasEnRenglones(CIERRE.hecho), 'ver_mensajes_operaciones');
});

// PROBADO ROMPIÉNDOLO (26/10/2026, base 4/0): sin armar listas → 2 rojos (1 y 2); sin mirar que los números sigan → 1 rojo
// (1); todo en columna → 1 rojo (2); la columna también en el teléfono → 1 rojo (2); el hilo sin `listasEnRenglones` ni aire
// → 2 rojos (2 y 3); el «Ya está» sin arreglar → 1 rojo (3); la API con el cierre crudo → 1 rojo (4); la API con lo del chat
// crudo → 1 rojo (4).

// El alta de un competidor: lo que está leyendo de verdad, sobre el fondo de la página (4/11/2026).
//
// Martín (por el Cerebro): «Cuando agrego un competidor, sigue estando el bloque blanco detrás de MaKo que no es del mismo color
// que el resto del bg… Y sería bueno que ahí vayan apareciendo como una animación especial de "Mirando su Instagram…
// Investigando su Web…"». El Cerebro: «Sólo lo que esté ocurriendo: nada inventado». Medido: el bloque era `CargandoMako cubre`
// (pinta --surface sobre el --bg de la página), y la lectura (`mirarCompetidor`) lee de a un canal, en orden, pero vuelve en UNA
// respuesta. Ahora anota su paso antes de cada canal y la pantalla lo pregunta por una ruta.
//   1. lo que se guarda y lo que se lee: sólo esa lectura (su marca), viva, en orden y sin repetir;
//   2. la lectura anota Instagram → YouTube → su web, cada uno DENTRO de su canal, y anotar nunca la tira;
//   3. la acción anota sólo con una marca; la ruta tiene la puerta de la pantalla; la pantalla pregunta por la ruta (no por una
//      action, que haría fila) y le pasa la marca a la lectura;
//   4. la película: sin la caja de --surface, la lista a la vista mientras carga, sólo los pasos que llegaron, y el último es el de ahora.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · `pasosDe` sin mirar la marca                                       → 1
//   · el paso de YouTube anotado antes del de Instagram                  → 2
//   · la acción que anota sin marca                                      → 3
//   · `CargandoMako cubre` sin el fondo transparente                     → 4
//   · la regla que esconde la escena sin excluir la lista                → 4
//
// Correr: node --import tsx --test tests/spy-lectura-pasos.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PASO_VENCE_MS, TEXTO_PASO, anotarPasos, claveLectura, marcaValida, pasosDe, sumarPasos } from '../lib/spy-lectura-pasos';
import { PeliculaDeOrden } from '../app/competitor-spy/OrdenSpy';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const T0 = Date.parse('2026-11-04T16:00:00Z');

test('1. lo que se guarda y lo que se lee: esa lectura, viva, en orden y sin repetir', () => {
  assert.equal(claveLectura(7), 'spy.lectura.7');
  assert.equal(marcaValida('lmh3k2abcd1234'), true);
  assert.equal(marcaValida('corta'), false);
  assert.equal(marcaValida('con espacios y más'), false);
  const crudo = anotarPasos('lmarca1', ['instagram', 'youtube'], T0);
  assert.deepEqual(pasosDe(crudo, 'lmarca1', T0 + 1000), ['instagram', 'youtube']);
  assert.deepEqual(pasosDe(crudo, 'lotra22', T0 + 1000), [], 'otra lectura (otra pestaña, una anterior) no se mezcla');
  assert.deepEqual(pasosDe(crudo, 'lmarca1', T0 + PASO_VENCE_MS + 1), [], 'una lectura vieja ya no está pasando');
  assert.deepEqual(pasosDe('{no es json', 'lmarca1', T0), []);
  assert.deepEqual(pasosDe(JSON.stringify({ marca: 'lmarca1', at: new Date(T0).toISOString(), pasos: ['instagram', 'instagram', 'tiktok', 'web'] }), 'lmarca1', T0), ['instagram', 'web'], 'sin inventar ni repetir');
  assert.deepEqual(sumarPasos(['instagram'], ['instagram', 'youtube']), ['instagram', 'youtube']);
  assert.deepEqual(sumarPasos(['instagram', 'youtube'], ['instagram']), ['instagram', 'youtube'], 'una respuesta vieja no borra lo que ya llegó');
  assert.equal(TEXTO_PASO.instagram, 'Mirando su Instagram…');
  assert.equal(TEXTO_PASO.web, 'Investigando su web…');
});

test('2. la lectura anota Instagram → YouTube → su web, cada uno dentro de su canal, y anotar no la tira', () => {
  const spy = sinComentarios(leer('lib/spy.ts'));
  const f = spy.slice(spy.indexOf('export async function mirarCompetidor'), spy.indexOf('export async function', spy.indexOf('export async function mirarCompetidor') + 10));
  assert.ok(f.length > 2000, `recorte de ${f.length}`);
  assert.match(f, /const paso = \(p: PasoLectura\) => \(alPaso \? alPaso\(p\)\.catch\(\(\) => undefined\) : Promise\.resolve\(\)\);/, 'anotar nunca tira la lectura');
  // Cada canal entra por su condición (con `lee`, la lectura de sólo lo nuevo: test 5) y anota su paso apenas entra.
  const ig = f.search(/if \(c\.instagram && lee\('instagram'\)\) \{\n    await paso\('instagram'\);/);
  const yt = f.search(/if \(c\.youtube_id && lee\('youtube'\)\) \{\n    await paso\('youtube'\);/);
  const web = f.search(/if \(landing && \(lee\('web'\) \|\| landingNueva\)\) \{\n    await paso\('web'\);/);
  assert.ok(ig > 0, 'Instagram anota su paso al entrar a su canal');
  assert.ok(yt > 0, 'YouTube anota su paso al entrar a su canal');
  assert.ok(web > 0, 'su web anota su paso al entrar');
  assert.ok(ig < yt && yt < web, 'en el orden en que se leen');
  assert.equal(f.split('await paso(').length - 1, 3, 'nada más se anota');
});

test('3. la acción anota con una marca; la ruta tiene la puerta; la pantalla pregunta por la ruta y pasa la marca', () => {
  const acc = sinComentarios(leer('app/competitor-spy/actions.ts'));
  assert.match(acc, /const alPaso = marcaValida\(marca\)\s*\?/, 'sin marca no anota nada');
  assert.match(acc, /mirarCompetidor\(id, motivo \?\? 'a-pedido', alPaso, /);
  const ruta = sinComentarios(leer('app/api/competitor-spy/lectura/route.ts'));
  assert.match(ruta, /soloAdminDeTab\('market-an'\)/);
  assert.match(ruta, /pasosDe\(await getSetting\(claveLectura\(id\)\), marca, Date\.now\(\)\)/);
  assert.doesNotMatch(ruta, /export async function POST/, 'sólo lee');
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /fetch\(`\/api\/competitor-spy\/lectura\?id=\$\{id\}&marca=\$\{marca\}`/);
  assert.match(app, /await revisarAction\(id, motivo, marca, solo\)/);
  assert.match(app, /pasos=\{pasosLectura\?\.id === c\.id \? pasosLectura\.pasos : \[\]\}/);
  assert.match(sinComentarios(leer('lib/spy.ts')), /borrarSetting\(claveLectura\(id\)\)/, '«Dejar de mirarlo» se lo lleva');
});

test('4. la película: sobre el fondo de la página, con la lista a la vista y sólo lo que llegó', () => {
  const src = leer('app/competitor-spy/OrdenSpy.tsx');
  assert.match(src, /<CargandoMako cubre que=\{`lo que publica \$\{nombre\}`\} size=\{88\} style=\{\{ backgroundColor: 'transparent' \}\} \/>/, 'sin la caja de --surface detrás de MaKo');
  assert.match(src, /\.spyo\[data-lista='false'\] > :not\(\.cm-carga\):not\(\.spyo-pasos\)\{visibility:hidden\}/, 'la lista no se esconde con la escena');
  const html = renderToStaticMarkup(createElement(PeliculaDeOrden, { nombre: 'Den Borg', piezas: null, onTerminar: () => {}, pasos: ['instagram', 'youtube'] }));
  assert.match(html, /data-estado="hecho"[^>]*>.*Mirando su Instagram</);
  assert.match(html, /data-estado="ahora"[^>]*>.*Leyendo su YouTube…/);
  assert.doesNotMatch(html, /Investigando su web/, 'lo que no pasó no se dibuja');
  // Antes del primer paso, una frase GENÉRICA de avance (el Cerebro, 4/11 tarde: «se permiten mensajes genéricos de avance… sin
  // afirmar resultados que no pasaron»; antes, sin pasos, sólo la criatura).
  const vacio = renderToStaticMarkup(createElement(PeliculaDeOrden, { nombre: 'Den Borg', piezas: null, onTerminar: () => {}, pasos: [] }));
  assert.match(vacio, /data-estado="ahora"[^>]*>.*Preparando su ficha…/);
  assert.doesNotMatch(vacio, /Mirando su Instagram/, 'no dice que mira lo que todavía no empezó');
});

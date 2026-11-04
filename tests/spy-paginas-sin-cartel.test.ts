// «Sus páginas» sin cartel técnico (4/11/2026).
//
// Martín, con una captura de la página de enlaces de un competidor: la vista previa decía «La página respondió 403: está bloqueando la
// lectura automática.» y él: «Y revisa esto, que no se bloquee, y que funcione todo». La ruta del iframe dibuja su error ADENTRO del
// iframe; ahora la pantalla pregunta antes si abre (/api/competitor-spy/pagina) y, si no, ofrece «Abrir» en el navegador de la
// persona. El bloqueo se RESPETA: no se intenta pasar con otro navegador ni otro proxy.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · SusPaginas que dibuja el iframe sin preguntar                          → 1
//   · la ruta que devuelve el porqué a la pantalla                            → 2
//   · la ruta sin mirar que la página sea suya                                → 2
//
// Correr: node --import tsx --test tests/spy-paginas-sin-cartel.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SusPaginas } from '../app/competitor-spy/SusPaginas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const props = { competidorId: 7, enlaces: ['https://beacons.page/marca'], titulos: new Map<string, string>(), elegida: null, onElegir: () => {} };

test('1. mientras pregunta, la carga de la casa; sin vista previa, «Abrir»; y nunca el iframe sin preguntar', () => {
  const preguntando = renderToStaticMarkup(createElement(SusPaginas, { ...props, conVistaPrevia: true }));
  assert.doesNotMatch(preguntando, /<iframe/, 'el iframe espera la respuesta: si no abre, adentro saldría el error');
  assert.doesNotMatch(preguntando, /respondió|bloqueando|403/i);
  const sin = renderToStaticMarkup(createElement(SusPaginas, { ...props, conVistaPrevia: false }));
  assert.match(sin, /class="spy-navegador__abrir"[^>]*>.*Abrir<\/a>/);
  assert.doesNotMatch(sin, /<p[ >]/, 'sin un texto al lado');
  const fuente = sinComentarios(leer('app/competitor-spy/SusPaginas.tsx'));
  assert.match(fuente, /fetch\('\/api\/competitor-spy\/pagina'/);
  // Y desde el mismo día, tampoco el marco que no avisó que pintó la página (tests/spy-paginas-verificadas.test.ts).
  assert.match(fuente, /const conAbrirGrande = !conVistaPrevia \|\| estado === 'no-pudo' \|\| veredicto === 'no';/);
});

test('2. la ruta: la puerta de la tab, sólo sus páginas, la lectura de siempre y sin el porqué', () => {
  const r = sinComentarios(leer('app/api/competitor-spy/pagina/route.ts'));
  assert.match(r, /soloAdminDeTab\('market-an'\)/);
  assert.match(r, /if \(!suyas\.some\(\(u\) => webComparable\(u\) === webComparable\(url\)\)\)/, 'no es un lector de cualquier dirección');
  // La lectura de siempre, siguiendo un acortador hasta su destino (lib/pagina-real.ts → paginaFinal).
  assert.match(r, /await paginaFinal\(url, paginaParaVer\);/);
  assert.match(r, /return Response\.json\(\{ ok: true, estado: 'abierta', \.\.\.\(final \? \{ final \} : \{\}\) \}\);/);
  assert.match(r, /return Response\.json\(\{ ok: true, estado: 'no-pudo' \}\);/);
  assert.doesNotMatch(r, /Response\.json\(\{[^}]*(?:motivo|e\.message)/, 'el porqué no viaja a la pantalla');
  assert.doesNotMatch(r, /apify|proxy|residential|playwright/i, 'el bloqueo se respeta: no se intenta pasar');
});

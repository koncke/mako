// Sus anuncios por Apify, prendidos y verificados (4/11/2026).
//
// Martín: «no estoy viendo todavía los anuncios. Eso es importante que se pueda ver». El Cerebro midió el actor desde la PC
// (ws 9): por «Alex Hormozi», 10 anuncios a US$0,0058 y el primero de OTRA Página («Skool»); por «Víctor Heras», 0 y US$0.
//   1. nada se guarda sin verificar de quién es: por palabra, anuncio por anuncio; entero, sólo si fue por SU Página de hoy;
//   2. su Página se aprende de los verificados (todos de la misma, con su id) y la próxima va por `view_all_page_id`;
//   3. sin anuncios suyos se prueba su otra búsqueda (su @, su web); probadas todas, no pauta, y eso es un dato;
//   4. el crédito manda: la corrida pide lo que deja `ajustarAlCredito`, no los 200 de siempre; y está prendido;
//   5. la pantalla dice «Sin anuncios activos en Meta» en su lugar, con la Biblioteca, sin cartel.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · `anunciosDeQuien` sin el id de la Página                                  → 1
//   · tomar entera una corrida por palabra (`porSuPagina` sin mirar `t.pagina`) → 1
//   · `paginaDeSusAnuncios` con dos Páginas                                     → 2
//   · `siguienteDeAnuncios` que no prueba la otra búsqueda                      → 3
//   · empezar con `ANUNCIOS_POR_CORRIDA` y no con lo que deja el crédito         → 4
//   · la pantalla sin el «Sin anuncios activos»                                 → 5
//
// Correr: node --import tsx --test tests/spy-anuncios-apify.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { anunciosDeQuien, type AnuncioLeido } from '../lib/spy-captura';
import { busquedasDeSusAnuncios, enlaceSusAnuncios } from '../lib/spy-funnel';
import { ANUNCIOS_POR_APIFY, paginaDeSusAnuncios, siguienteDeAnuncios } from '../lib/spy-todo-reglas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const f = src.indexOf(hasta, i + desde.length);
  assert.ok(f > i, `no está el cierre de «${desde}»`);
  return src.slice(i, f);
};

const anuncio = (id: string, pagina: string, paginaId: string | null): AnuncioLeido => ({
  id, desde: '2026-10-01T00:00:00.000Z', hasta: null, pagina: { nombre: pagina, handle: null }, paginaId, texto: 'x', titulo: null, destino: null, miniatura: null,
});
const HORMOZI = { nombre: 'Alex Hormozi', instagram: 'hormozi', landing_url: 'https://acquisition.com', pagina_anuncios: null };

test('1. nada se guarda sin verificar: por palabra, anuncio por anuncio; entero, sólo por SU Página', () => {
  const skool = anuncio('1000001', 'Skool', '555000555');
  const suyo = anuncio('1000002', 'Alex Hormozi', '123456789');
  assert.deepEqual(anunciosDeQuien([skool, suyo], HORMOZI, false).suyos.map((a) => a.id), ['1000002'], 'el de Skool lo menciona, no es suyo');
  // Con su Página ya aprendida, un anuncio con OTRO nombre pero su id es suyo (cambió el nombre de su Página).
  const renombrado = anuncio('1000003', 'Acquisition.com', '123456789');
  assert.deepEqual(anunciosDeQuien([skool, renombrado], { ...HORMOZI, landing_url: null, pagina_anuncios: '123456789' }, false).suyos.map((a) => a.id), ['1000003']);
  const todo = sinComentarios(leer('lib/spy-todo.ts'));
  const f = bloque(todo, 'async function pasoDeAnuncios(', '\n}\n');
  assert.match(f, /const porSuPagina = !!t\.pagina && t\.pagina === suPagina;/, 'entera sólo si la corrida fue por la Página que tiene HOY');
  assert.match(f, /anunciosDeQuien\(leidos, c, porSuPagina\)/);
  assert.match(f, /guardarVistas\(c\.id, suyos\.map\(piezaDeAnuncio\)\)/, 'se guardan los verificados, no lo que trajo');
  assert.doesNotMatch(todo, /items\.map\(anuncioDeApify\)[\s\S]{0,200}guardarVistas\(\w+, \w+\.map\(piezaDeAnuncio\)\)/, 'ningún camino guarda lo leído sin pasar por la verificación');
  assert.equal((todo.match(/piezaDeAnuncio\)/g) ?? []).length, 1, 'un solo lugar guarda anuncios de Apify');
});

test('2. su Página se aprende de los verificados, y la próxima va por su id', () => {
  assert.equal(paginaDeSusAnuncios([{ paginaId: '123456789' }, { paginaId: '123456789' }, { paginaId: null }]), '123456789');
  assert.equal(paginaDeSusAnuncios([{ paginaId: '123456789' }, { paginaId: '987654321' }]), null, 'con dos Páginas no se elige');
  assert.equal(paginaDeSusAnuncios([]), null);
  const enlace = enlaceSusAnuncios({ ...HORMOZI, pagina_anuncios: '123456789' }, 'hormozi');
  assert.match(enlace, /view_all_page_id=123456789/);
  assert.doesNotMatch(enlace, /[?&]q=/, 'por su Página no se busca una palabra');
  const f = bloque(sinComentarios(leer('lib/spy-todo.ts')), 'async function pasoDeAnuncios(', '\n}\n');
  assert.match(f, /const aprendida = suPagina \? null : paginaDeSusAnuncios\(suyos\);/);
  assert.match(f, /update\(\{ pagina_anuncios: aprendida/);
});

test('3. sin anuncios suyos se prueba su otra búsqueda; probadas todas, no pauta', () => {
  assert.deepEqual(busquedasDeSusAnuncios({ nombre: 'Víctor Heras', instagram: 'victorheras', landing_url: 'https://www.viralidad.com/curso' }), ['Víctor Heras', 'victorheras', 'viralidad.com']);
  assert.deepEqual(busquedasDeSusAnuncios({ nombre: 'den.borgg', instagram: 'den.borgg', landing_url: 'https://beacons.page/denborg' }), ['den.borgg'], 'sin repetir, y una página de enlaces no es su web');
  assert.match(enlaceSusAnuncios({ nombre: 'Víctor Heras' }, 'victorheras'), /q=%22victorheras%22/);
  assert.deepEqual(siguienteDeAnuncios({ suyos: 0, busqueda: 0, busquedas: 3, porPagina: false }), { que: 'probar', busqueda: 1 });
  assert.deepEqual(siguienteDeAnuncios({ suyos: 0, busqueda: 2, busquedas: 3, porPagina: false }), { que: 'no-pauta' });
  assert.deepEqual(siguienteDeAnuncios({ suyos: 0, busqueda: 0, busquedas: 3, porPagina: true }), { que: 'no-pauta' }, 'por su Página, vacío es que no pauta');
  assert.deepEqual(siguienteDeAnuncios({ suyos: 4, busqueda: 1, busquedas: 3, porPagina: false }), { que: 'guardar' });
});

test('4. el crédito manda y está prendido', () => {
  assert.equal(ANUNCIOS_POR_APIFY, true);
  const f = bloque(sinComentarios(leer('lib/spy-todo.ts')), 'async function pasoDeAnuncios(', '\n}\n');
  assert.match(f, /entradaDeAnuncios\(enlace, pedido\.cuantas\), pedido\.cuantas, pedido\.techoUsd\)/, 'lo que deja el crédito, no los 200 de siempre');
  assert.match(f, /if \(!\(await reservarCorrida\(\)\)\)/, 'cuenta en el tope del día');
});

test('5. la pantalla dice que no pauta en su lugar, con la Biblioteca, sin cartel', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /\{!anuncios\.length && sinAnuncios\[c\.id\] && \(\s*<p className="spy-aviso spy-aviso--suave spy-sin-anuncios">/);
  // Desde el 6/11/2026 la frase va en una plantilla: con un país que la Biblioteca no cubre se dice OTRA cosa, porque ahí
  // nunca se pudo mirar (tests/spy-pais.test.ts, caso 5). Lo que no cambia es que con cobertura —o sin saber su país— se
  // sigue diciendo esto, en el lugar de sus anuncios y sin cartel.
  assert.match(app, /Sin anuncios activos en Meta · lo miré el \$\{fechaCorta\(sinAnuncios\[c\.id\]\)\}/);
  assert.doesNotMatch(app, /spy-error[^>]*>[^<]*anuncios/i, 'no pautar no es un error');
});

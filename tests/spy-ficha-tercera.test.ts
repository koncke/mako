// La ficha de un competidor, tercera vuelta (Martín revisó producción con Den Borg, 4/11/2026). Cada test cuida un pedido suyo:
//   · «Le di a "Agregar YouTube" y el modal que me sale es uno feo... Debe ser el mismo de siempre para buscar su YouTube» → 1, 2
//   · «no queda claro como volver para atrás a todos los competidores, rediseña esa parte»                                 → 3
//   · «En el bloque del perfil, los 3 puntos están abajo, no tiene sentido... En todo caso arriba a la derecha»              → 3
//   · «No me gusta para nada esa parte con scroll infinito, y sin ocupar todo el ancho»                                     → 4, 5
//   · «al lado de "¿Qué formatos le funcionan?" debería ir otro bloque con algo más hasta cubrir el final»                   → 6
//   · «los anuncios deberían estar en "Contenido", igual que el resto»                                                       → 7
//   · «Y trata de que todo sea más fluido, que cargue más rápido»                                                           → 8
// Correr: node --import tsx --test tests/spy-ficha-tercera.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gruposPermitidos, nombreParaBuscar } from '../lib/spy-buscar-reglas';
import { botonesDePaginas, columnasQueEntran, filtrarPiezas, opcionesDeContenido, paginaEnRango, tipoEnLaGrilla, FILAS_POR_PAGINA } from '../lib/spy-vista';
import { mejoresPiezas } from '../lib/spy-detalle';
import { TOPE_PRECARGA_MS } from '../app/competitor-spy/precarga';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. el buscador para sumarle un canal ofrece sólo sus redes (o sólo la pedida), arrancado con su nombre', () => {
  assert.deepEqual([...gruposPermitidos({ nombre: 'Den Borg', red: 'youtube' })], ['youtube']);
  const todas = gruposPermitidos({ nombre: 'Den Borg' });
  assert.ok(todas.has('instagram') && todas.has('youtube') && todas.has('sitio'));
  assert.ok(!todas.has('mirados') && !todas.has('nombre'), 'ni «Ya los miras» ni «Sin redes»: es para sumarle una red');
  assert.ok(gruposPermitidos(null).has('mirados'), 'el alta de siempre no cambia');
  assert.equal(nombreParaBuscar('Den Borg - Estrategia de Marca Personal'), 'Den Borg');
  assert.equal(nombreParaBuscar('Víctor Heras | Media'), 'Víctor Heras');
  assert.equal(nombreParaBuscar('Al - Algo'), 'Al - Algo', 'un nombre muy corto no se recorta');
});

test('2. «Agregar su YouTube» abre el MISMO buscador, no un campo con un botón', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const canal = app.slice(app.indexOf("{modal === 'canal' && c && ("), app.indexOf("{modal === 'anuncio'"));
  assert.match(canal, /<BuscadorAlta/);
  assert.match(canal, /para=\{\{ nombre: c\.nombre, red: redCanal \}\}/);
  assert.doesNotMatch(canal, /ModalCampo/);
  // Los tres lugares que agregan una red la piden por su nombre: el gráfico, el desplegable de la grilla y el menú.
  assert.match(app, /onAgregarRed=\{\(red\) => abrirCanal\(red\)\}/);
  assert.match(app, /abrirCanal\(v === 'agregar-youtube' \? 'youtube' : 'instagram'\)/);
  const g = leer('app/competitor-spy/GraficoSpy.tsx');
  assert.match(g, /onAgregarRed\(v === 'agregar-youtube' \? 'youtube' : 'instagram'\)/);
  const b = sinComentarios(leer('app/competitor-spy/BuscadorAlta.tsx'));
  assert.match(b, /\]\.filter\(\(f\) => permitidos\.has\(f\.grupo\)\)/, 'las filas pasan por los grupos permitidos');
  assert.match(b, /GRUPOS\.filter\(\(g\) => permitidos\.has\(g\.id\)\)/, 'y los grupos también');
});

test('3. volver a todos es un botón de verdad, y el ⋯ del perfil va arriba a la derecha', () => {
  const app = leer('app/competitor-spy/SpyApp.tsx');
  assert.doesNotMatch(app, /className="spy-migas"/, 'la miga de 18 px se fue');
  assert.match(app, /<button type="button" className="spy-volver__atras" onClick=\{\(\) => irA\(null\)\}>/);
  assert.match(app, /\.spy-ficha\{position:relative;/);
  assert.match(app, /\.spy-ficha__acciones\{position:absolute;top:12px;right:12px;/);
  // El botón del ⋯ mide 40: con el ancho del menú (210) el botón quedaba encima del texto.
  const menu = app.slice(app.indexOf('ariaLabel="Más acciones"'), app.indexOf('ariaLabel="Más acciones"') + 200);
  assert.match(menu, /width=\{40\}\s+menuMinAncho=\{210\}/);
});

test('4. la grilla va por páginas de FILAS ENTERAS y el paginador no esconde una sola página detrás de «…»', () => {
  assert.equal(columnasQueEntran(1236, 210, 16), 5);
  assert.equal(columnasQueEntran(358, 150, 12), 2);
  assert.equal(columnasQueEntran(50, 210, 16), 1);
  assert.equal(FILAS_POR_PAGINA, 3);
  assert.equal(paginaEnRango(99, 50, 15), 4);
  assert.equal(paginaEnRango(0, 0, 15), 1);
  assert.deepEqual(botonesDePaginas(1, 3), [1, 2, 3]);
  assert.deepEqual(botonesDePaginas(5, 10), [1, null, 4, 5, 6, null, 10]);
  assert.deepEqual(botonesDePaginas(4, 10), [1, 2, 3, 4, 5, null, 10], 'un «…» que tapa una sola página es peor que la página');
  assert.deepEqual(botonesDePaginas(10, 10), [1, null, 6, 7, 8, 9, 10]);
});

test('5. todas sus piezas a todo el ancho, debajo de las dos columnas, y sin «Ver más»', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.doesNotMatch(app, /Ver más ·/, 'el «Ver más» de a 60 se fue');
  const iCols = app.indexOf('<div className="spy-cols">');
  const iRiel = app.indexOf('{riel}', iCols);
  const iGrilla = app.indexOf('<GrillaPiezas', iCols);
  assert.ok(iCols > 0 && iRiel > iCols && iGrilla > iRiel, 'la grilla va DESPUÉS de cerrar las dos columnas');
  const g = leer('app/competitor-spy/GrillaPiezas.tsx');
  assert.match(g, /const porPagina = columnas \* FILAS_POR_PAGINA;/);
  assert.match(g, /piezas\.slice\(desde, desde \+ porPagina\)/, 'dibuja una página, no todo');
});

test('6. «Lo que mejor le fue»: por veces la mediana de SU grupo, sin anuncios, y estirado hasta el final de los formatos', () => {
  const ahora = Date.UTC(2026, 10, 4);
  const p = (id: number, tipo: 'reel' | 'video', vistas: number, canal: 'instagram' | 'youtube' | 'anuncios' = tipo === 'reel' ? 'instagram' : 'youtube') => ({
    id, competidor_id: 1, canal, tipo, ref: `r${id}`, fuente: 'pagina', url: null, titulo: null, texto: null, etiquetas: null, analisis: null,
    vistas, megusta: null, comentarios: null, duracion: tipo === 'video' ? 'PT12M' : null, gasto_tramo: null, impresiones_tramo: null, plataformas: null,
    dominio_destino: null, publicada_en: '2026-10-01T00:00:00Z', miniatura: null, visto_primera_vez: '2026-10-01T00:00:00Z', visto_ultima_vez: '2026-10-01T00:00:00Z',
    dejo_de_verse_en: null, texto_leido_en: null, metricas_leidas_en: null, etapa: null,
  }) as unknown as Parameters<typeof mejoresPiezas>[0][number];
  // Reels: mediana 1.000; el de 5.000 es 5x. Videos: mediana 100.000; el de 300.000 es 3x aunque tenga más vistas crudas.
  const piezas = [p(1, 'reel', 1000), p(2, 'reel', 1000), p(3, 'reel', 5000), p(4, 'video', 100_000), p(5, 'video', 100_000), p(6, 'video', 300_000)];
  const m = mejoresPiezas(piezas, 3, ahora);
  // A igual veces (1x), gana el de más vistas: el video de 100 mil antes que el reel de mil.
  assert.deepEqual(m.map((x) => [x.id, x.veces]), [[3, 5], [6, 3], [4, 1]]);
  assert.equal(mejoresPiezas([p(1, 'reel', 10), p(2, 'reel', 20)], 5, ahora).length, 0, 'con menos de 3, la mediana no dice nada');
  // Los anuncios no entran (sus días al aire no son un rendimiento), aunque traigan un número.
  const conAnuncios = [...piezas, ...[7, 8, 9].map((id) => ({ ...p(id, 'reel', 9_000_000), canal: 'anuncios', tipo: 'anuncio' }) as typeof piezas[number])];
  assert.ok(!mejoresPiezas(conAnuncios, 10, ahora).some((x) => x.id >= 7));
  const css = leer('app/competitor-spy/SpyApp.tsx');
  assert.match(css, /\.spy-mejores\{position:relative;flex:1 1 auto;/, 'la caja estira la columna');
  assert.match(css, /\.spy-mejores__tarjeta\{position:absolute;inset:0;/, 'y la tarjeta no le suma alto: si no, nunca «llega» al final');
  assert.match(css, /\.spy-cols\{[^}]*align-items:stretch\}/);
  assert.match(css, /\.spy-cols__izq > \.spyg > \.spyg-caja:last-child\{flex:1 1 auto\}/, 'y al revés: si el riel es más alto, se estiran los formatos');
});

test('7. los anuncios son un formato más de la grilla, no una sección aparte', () => {
  const ad = { canal: 'anuncios' as const, tipo: 'anuncio' as const, duracion: null, titulo: null, texto: 'Te espero en el evento' };
  const reel = { canal: 'instagram' as const, tipo: 'reel' as const, duracion: null, titulo: null, texto: 'hola' };
  assert.equal(tipoEnLaGrilla(ad), 'anuncios');
  assert.deepEqual(filtrarPiezas([ad, reel], '', 'anuncios'), [ad]);
  const op = opcionesDeContenido([ad, reel], { instagram: 'x', youtube_id: 'y' });
  assert.deepEqual(op.map((o) => o.value), ['todo', 'reels', 'anuncios']);
  assert.equal(op[0].label, 'Todo lo que publica · 2');
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.doesNotMatch(app, /className="spy-anuncios"/, 'la sección «Anuncios» de abajo de todo se fue');
  assert.match(app, /const contenido = useMemo\(\(\) => \[\.\.\.flujo, \.\.\.anuncios\]/);
});

test('8. más rápido: todo en paralelo en el server, las piezas del que se abre llegan con la página, y no se esperan 8 s de miniaturas', () => {
  const page = sinComentarios(leer('app/competitor-spy/page.tsx'));
  assert.match(page, /await Promise\.all\(\[/);
  assert.match(page, /abierto \? piezasAction\(abierto\)/);
  assert.match(page, /piezasIniciales=\{/);
  assert.ok(page.indexOf("await requireRolWs([], { nav: 'market-an' })") < page.indexOf('Promise.all'), 'la puerta primero');
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /const p = ini \? ini\.piezas : await traerPiezas\(id\);/);
  assert.ok(TOPE_PRECARGA_MS <= 3000);
});

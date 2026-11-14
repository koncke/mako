// =============================================================================
// La pestaña «Anuncios» de la ficha, como Spyder de Foreplay (14/11/2026)
// =============================================================================
// Martín (por el chat de Landings, 14/11): «darle mucha prioridad al tema de anuncios, que nosotros no le estamos dando casi
// nada». Lo que muestra Spyder de una marca, con lo que Spy ya guardó de cada anuncio (lib/spy-anuncios-ficha.ts):
//   1. los días al aire son los de la tarjeta: uno terminado cuenta hasta que terminó, uno activo hasta hoy;
//   2. el media mix es de los ACTIVOS, y su % es sobre los que tienen formato (el formato es nuevo: los viejos no lo traen);
//   3. «A dónde mandan» junta la misma página aunque cambien los utm, y su % es sobre todos sus anuncios;
//   4. «Tests creativos»: los del mismo día, y «Ganador» sólo cuando de la tanda queda UNO activo;
//   5. la línea de tiempo: la ventana que termina hoy, lo que terminó antes no entra, los activos primero y más días al aire primero;
//   6. la pestaña dibujada: sus partes, y sin anuncios no dibuja nada;
//   7. la ficha de la computadora la ofrece sólo con anuncios, y el teléfono también la tiene.
//
// PROBADO ROMPIÉNDOLO (14/11/2026), una rotura por vez y restaurada, con el archivo en verde (qué tests caen):
//   · `diasAlAire` que cuenta hasta hoy también a los terminados                     → 1, 4
//   · el % del media mix sobre todos los activos, con o sin formato                  → 2
//   · el destino sin sacarle la consulta (cada utm, una página distinta)             → 3, 6
//   · «Ganador» con cualquier tanda que tenga alguno activo                          → 4
//   · la línea de tiempo con los que terminaron antes de la ventana                  → 5
//   · la pestaña sin «Ganador»                                                        → 6
// Correr: node --import tsx --test tests/spy-anuncios-ficha.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MINIMO_TANDA, diasAlAire, frescuraDeAnuncios, landingsDeAnuncios, lineaDeTiempo, mezclaDeFormatos, rotuloDeDestino, tandasDeAnuncios,
} from '../lib/spy-anuncios-ficha';
import { tiempoDePieza } from '../lib/spy-vista';
import { AnunciosSpy, type AnuncioVista } from '../app/competitor-spy/AnunciosSpy';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');

const HOY = new Date('2026-11-14T12:00:00Z');
const dia = (d: string) => `${d}T07:00:00.000Z`;
let n = 0;
/** Un anuncio como lo guarda Spy: la fecha de inicio a la medianoche del Pacífico, como la deja la Biblioteca. */
const anuncio = (o: Partial<AnuncioVista> = {}): AnuncioVista => ({
  id: ++n, canal: 'anuncios', ref: `A${n}`, miniatura: null, titulo: null, texto: `Anuncio ${n}`,
  publicada_en: dia('2026-10-28'), visto_primera_vez: '2026-11-04T19:23:43.026Z', visto_ultima_vez: '2026-11-04T19:23:58.011Z',
  dejo_de_verse_en: null, dominio_destino: null, medio: null, ...o,
});

test('1. los días al aire son los de la tarjeta', () => {
  const activo = anuncio({ publicada_en: dia('2026-10-28') });
  const terminado = anuncio({ publicada_en: dia('2026-06-30'), dejo_de_verse_en: dia('2026-08-11') });
  assert.equal(diasAlAire(activo, HOY), 17, 'activo: hasta hoy');
  assert.equal(diasAlAire(terminado, HOY), 42, 'terminado: del 30/6 al 11/8, no hasta hoy');
  assert.equal(diasAlAire(anuncio({ publicada_en: null }), HOY), null, 'sin fecha no es 0');
  for (const a of [activo, terminado]) assert.equal(diasAlAire(a, HOY), tiempoDePieza(a, HOY).dias, 'el mismo número que la tarjeta');
  const f = frescuraDeAnuncios([activo, anuncio({ visto_ultima_vez: '2026-11-11T19:24:01.230Z', visto_primera_vez: '2026-11-04T18:13:58.526Z' })]);
  assert.deepEqual(f, { actualizado: '2026-11-11T19:24:01.230Z', desde: '2026-11-04T18:13:58.526Z' });
});

test('2. el media mix es de los activos, y su % sobre los que tienen formato', () => {
  const lista = [
    anuncio({ medio: 'video' }), anuncio({ medio: 'video' }), anuncio({ medio: 'imagen' }), anuncio({ medio: null }),
    anuncio({ medio: 'carrusel', dejo_de_verse_en: dia('2026-11-01') }),
  ];
  const m = mezclaDeFormatos(lista);
  assert.equal(m.activos, 4);
  assert.equal(m.total, 5);
  assert.equal(m.base, 'activos');
  assert.equal(m.conFormato, 3, 'el que no tiene formato no cuenta como ninguno');
  assert.deepEqual(m.filas.map((f) => [f.rotulo, f.n, f.pct]), [['Video', 2, 67], ['Imagen', 1, 33]], 'el carrusel terminó: no es de los activos');
  // Ninguno activo: se reparte sobre todos, y se dice.
  const apagados = mezclaDeFormatos([anuncio({ medio: 'video', dejo_de_verse_en: dia('2026-11-01') })]);
  assert.equal(apagados.base, 'todos');
  assert.equal(apagados.activos, 0);
  assert.deepEqual(apagados.filas.map((f) => f.rotulo), ['Video']);
});

test('3. «A dónde mandan» junta la misma página aunque cambien los utm', () => {
  assert.equal(rotuloDeDestino('https://www.Acquisition.com/training/?utm_source=fb&fbclid=1'), 'acquisition.com/training');
  assert.equal(rotuloDeDestino('acquisition.com'), 'acquisition.com');
  assert.equal(rotuloDeDestino('  '), null);
  const lista = [
    anuncio({ dominio_destino: 'https://acquisition.com/training?utm_source=a' }),
    anuncio({ dominio_destino: 'https://www.acquisition.com/training/?utm_source=b', dejo_de_verse_en: dia('2026-11-01') }),
    anuncio({ dominio_destino: 'https://skool.com/x' }),
    anuncio({ dominio_destino: null }),
  ];
  const l = landingsDeAnuncios(lista);
  assert.deepEqual(l[0], { rotulo: 'acquisition.com/training', n: 2, pct: 50, activos: 1 }, 'el % es sobre TODOS sus anuncios (4)');
  assert.equal(l.length, 2);
  assert.equal(landingsDeAnuncios(lista, 1).length, 1, 'con su tope');
});

test('4. «Tests creativos»: los del mismo día, y «Ganador» sólo cuando queda UNO activo', () => {
  assert.equal(MINIMO_TANDA, 2, 'uno solo no es un test');
  const ganador = anuncio({ publicada_en: dia('2026-09-01') });
  const lista = [
    // 1/9: tres lanzados juntos, queda uno → ganador.
    anuncio({ publicada_en: dia('2026-09-01'), dejo_de_verse_en: dia('2026-09-05') }), ganador,
    anuncio({ publicada_en: dia('2026-09-01'), dejo_de_verse_en: dia('2026-09-20') }),
    // 28/10: dos, los dos activos → el test sigue, sin ganador.
    anuncio({ publicada_en: dia('2026-10-28') }), anuncio({ publicada_en: dia('2026-10-28') }),
    // 1/8: dos, ninguno activo → no se sabe cuál ganó.
    anuncio({ publicada_en: dia('2026-08-01'), dejo_de_verse_en: dia('2026-08-03') }), anuncio({ publicada_en: dia('2026-08-01'), dejo_de_verse_en: dia('2026-08-30') }),
    // 5/10: uno solo, no es una tanda.
    anuncio({ publicada_en: dia('2026-10-05') }),
  ];
  const t = tandasDeAnuncios(lista, HOY);
  assert.deepEqual(t.map((x) => x.dia), ['2026-10-28', '2026-09-01', '2026-08-01'], 'la más nueva primero, sin la de uno solo');
  assert.equal(t[0].ganador, null, 'dos activos: el test sigue');
  assert.equal(t[1].ganador, ganador);
  assert.equal(t[1].vivos, 1);
  assert.equal(t[1].anuncios[0], ganador, 'el activo primero');
  assert.equal(diasAlAire(t[1].anuncios[1], HOY), 19, 'después, el que más corrió');
  assert.equal(t[2].ganador, null, 'todos apagados: no hay ganador');
});

test('5. la línea de tiempo: la ventana que termina hoy, los activos primero', () => {
  const viejo = anuncio({ publicada_en: dia('2026-03-01'), dejo_de_verse_en: dia('2026-04-01') });
  const largo = anuncio({ publicada_en: dia('2026-07-01') });
  const corto = anuncio({ publicada_en: dia('2026-11-10') });
  const terminado = anuncio({ publicada_en: dia('2026-10-01'), dejo_de_verse_en: dia('2026-10-15') });
  const sinFecha = anuncio({ publicada_en: null });
  const l = lineaDeTiempo([corto, viejo, terminado, largo, sinFecha], 90, HOY);
  assert.deepEqual(l.filas.map((f) => f.a), [largo, corto, terminado], 'lo que corre hoy arriba; el que terminó antes de la ventana y el que no tiene fecha no entran');
  const [fl, fc, ft] = l.filas;
  assert.equal(fl.x0, 0, 'empezó antes de la ventana: arranca en el borde');
  assert.equal(fl.x1, 1, 'sigue activo: llega a hoy');
  assert.equal(fl.sigue, true);
  assert.ok(ft.x0 > 0 && ft.x1 < 1 && ft.x1 > ft.x0, 'terminado: una barra adentro');
  assert.equal(ft.sigue, false);
  assert.ok(fc.x1 - fc.x0 > 0, 'el de pocos días también se ve');
  assert.equal(lineaDeTiempo([viejo], 365, HOY).filas.length, 1, 'con el año entra');
});

test('6. la pestaña dibujada: sus partes, y sin anuncios nada', () => {
  const props = { onAbrir: () => {}, ahora: HOY };
  assert.equal(renderToStaticMarkup(createElement(AnunciosSpy, { ...props, anuncios: [] })), '');
  const lista = [
    anuncio({ publicada_en: dia('2026-09-01'), dejo_de_verse_en: dia('2026-09-05'), medio: 'video', dominio_destino: 'https://acquisition.com/?utm=1' }),
    anuncio({ publicada_en: dia('2026-09-01'), medio: 'video', dominio_destino: 'acquisition.com' }),
    anuncio({ publicada_en: dia('2026-10-28'), medio: 'imagen' }),
  ];
  const html = renderToStaticMarkup(createElement(AnunciosSpy, { ...props, anuncios: lista }));
  assert.match(html, /Actualizado hace \d+ d/);
  assert.match(html, /<strong>2<\/strong> <span>activos de 3<\/span>/);
  assert.match(html, />Video<\/b><span>1 · 50%<\/span>/);
  assert.match(html, />A dónde mandan</);
  assert.match(html, /acquisition\.com<\/b><span>2 · 67%/);
  assert.match(html, />Tests creativos</);
  assert.match(html, /2 anuncios · 1 sigue activo<\/span><span class="spya-ganador">Ganador</);
  assert.match(html, /data-ganador="true"/, 'la tanda abierta marca a su ganador');
  assert.match(html, />Línea de tiempo</);
  assert.equal(html.split('<li><button type="button" class="spya-cara"').length - 1, 3, 'una fila por anuncio');
  assert.doesNotMatch(html, /undefined|NaN/);
  // Sin destinos, la caja no existe (no se anuncia su ausencia).
  assert.doesNotMatch(renderToStaticMarkup(createElement(AnunciosSpy, { ...props, anuncios: [anuncio(), anuncio()] })), /A dónde mandan/);
});

test('7. la computadora la ofrece sólo con anuncios, y el teléfono también la tiene', () => {
  const app = leer('app/competitor-spy/SpyApp.tsx');
  assert.match(app, /\.\.\.\(anuncios\.length \? \[\{ key: 'anuncios' as const, rotulo: 'Anuncios', n: anuncios\.length \}\] : \[\]\)/);
  assert.match(app, /\{activa === 'anuncios' && <AnunciosSpy anuncios=\{anuncios\} onAbrir=\{\(p\) => setAbierta\(\{ p, todas: anuncios \}\)\} \/>\}/);
  const m = leer('app/m/competitor-spy/SpyM.tsx');
  assert.match(m, /\{anuncios\.length > 0 && \(\s*<Bloque titulo="Sus anuncios">\s*<AnunciosSpy anuncios=\{anuncios\} onAbrir=\{abrirPieza\} \/>/);
});

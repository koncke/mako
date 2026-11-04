// Las tarjetas de «Todas sus piezas» y los números de arriba (4/11/2026).
//
// Martín, con Leila Hormozi en producción: «mira la captura como se bugea las tarjetas» (una tarjeta estirada con un bloque
// crema enorme debajo), «el chip "Analizando…" tapa el nombre», «"Hace 2 d" tapa el texto de la pieza», «"No lo publica" y
// "Publicación · 110…" cortado se ven mal». Y con Den Borg: «hay 2 bloques de "Piezas", no necesitamos 2... Quita el que está
// abajo del perfil», con 181 arriba y 255 abajo.
//   1. la píldora lleva el número que hay: sus vistas; si no, sus me gusta con un corazón; si no hay ninguno, no hay píldora
//      (nunca «No lo publica» en una píldora llena);
//   2. la línea del pie es su tipo, y sus me gusta con un corazón sólo si la píldora lleva las vistas; en el teléfono, sólo el tipo;
//   3. cada tarjeta mide lo suyo: la fila no estira a la más alta;
//   4. el texto de una publicación sin foto arranca debajo de los chips de arriba y se desvanece antes de los de abajo;
//   5. abajo del perfil no hay «Piezas · N publicadas», y una cantidad impar de números no deja un hueco;
//   6. el número de arriba dice qué cuenta: el nombre del formato elegido.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · la píldora vuelve a dibujar «No lo publica» sin número                → 1
//   · la píldora sin el caso de los me gusta                                → 1
//   · la línea con «me gusta» en palabras, o con el corazón sin vistas      → 2
//   · sin `.spy-pcard__mg{display:none}` en el teléfono                     → 2
//   · `.spy-pgrid--ancha` sin align-items:start                             → 3
//   · el texto creativo con su padding de antes (18px arriba) o sin máscara → 4
//   · vuelve la celda 'vivas' del riel                                      → 5
//   · el rótulo de arriba vuelve a «Piezas»                                 → 6
//
// Correr: node --import tsx --test tests/spy-tarjetas-sin-relleno.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TarjetaPieza } from '../app/competitor-spy/TarjetaPieza';
import type { PiezaVista } from '../app/competitor-spy/actions';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const AYER = new Date(Date.now() - 86_400_000).toISOString();

function pieza(o: Partial<PiezaVista> = {}): PiezaVista {
  const p: PiezaVista = {
    id: 1, competidor_id: 7, canal: 'instagram', tipo: 'reel', ref: 'C1', fuente: 'api', url: 'https://www.instagram.com/p/C1/',
    titulo: 'Tres errores al vender tu primer servicio', texto: null, etiquetas: null, analisis: null,
    vistas: null, megusta: null, comentarios: null, duracion: null, gasto_tramo: null, impresiones_tramo: null, plataformas: null,
    dominio_destino: null, publicada_en: AYER, miniatura: null, visto_primera_vez: AYER, visto_ultima_vez: AYER,
    dejo_de_verse_en: null, texto_leido_en: AYER, metricas_leidas_en: AYER, etapa: null,
  };
  return { ...p, ...o };
}

const dibujar = (p: PiezaVista) => renderToStaticMarkup(createElement(TarjetaPieza, { p }));
const pildora = (html: string) => html.match(/<span class="spy-pcard__num"[^>]*>[\s\S]*?<\/span>/)?.[0] ?? null;
const linea = (html: string) => html.match(/<div class="spy-pcard__texto"><small>([\s\S]*?)<\/small>/)?.[1] ?? null;

test('1. la píldora lleva sus vistas, si no sus me gusta, y si no hay ninguno no hay píldora', () => {
  const conVistas = pildora(dibujar(pieza({ vistas: 52_000, megusta: 11_000 })));
  assert.ok(conVistas, 'con vistas hay píldora');
  assert.match(conVistas!, /title="52 mil vistas"/, 'la píldora dice sus vistas');

  const soloMg = pildora(dibujar(pieza({ tipo: 'publicacion', megusta: 110 })));
  assert.ok(soloMg, 'sin vistas y con me gusta hay píldora');
  assert.match(soloMg!, /title="110 me gusta"/, 'sin vistas, la píldora dice sus me gusta');
  assert.match(soloMg!, /<b>110<\/b>/, 'el número va en la píldora');

  const sinNada = dibujar(pieza({ tipo: 'publicacion' }));
  assert.equal(pildora(sinNada), null, 'sin ningún número no hay píldora');
  assert.doesNotMatch(sinNada, /No lo publica/, 'nunca «No lo publica» en la tarjeta');
});

test('2. la línea del pie es su tipo y sus me gusta con un corazón, sólo si la píldora lleva las vistas', () => {
  const conAmbos = linea(dibujar(pieza({ vistas: 52_000, megusta: 11_000 })));
  assert.equal(conAmbos, 'Reel<span class="spy-pcard__mg"> · ♥ 11 mil</span>');

  const soloMg = linea(dibujar(pieza({ tipo: 'publicacion', megusta: 110 })));
  assert.equal(soloMg, 'Publicación', 'si los me gusta van en la píldora, la línea no los repite');

  assert.equal(linea(dibujar(pieza({ tipo: 'video', canal: 'youtube' }))), 'Video');

  const css = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const telefono = css.slice(css.indexOf('@media (max-width:760px){'));
  assert.ok(telefono.length > 0, 'existe la media del teléfono');
  assert.match(telefono.slice(0, telefono.indexOf('\n}\n') + 1 || undefined), /\.spy-pcard__mg\{display:none\}/,
    'en el teléfono la línea es sólo su tipo');
});

test('3. cada tarjeta mide lo suyo: la fila no estira a la más alta', () => {
  const css = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(css, /\.spy-pgrid--ancha\{[^}]*align-items:start/, 'la grilla ancha alinea arriba');
  assert.match(css, /\.spy-pgrid__celda\{[^}]*align-self:start/, 'cada celda va arriba con su altura');
});

test('4. el texto sin foto arranca debajo de los chips de arriba y se desvanece antes de los de abajo', () => {
  const css = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const regla = css.match(/\.spy-pcard__texto-creativo\{([^}]*)\}/)?.[1] ?? '';
  assert.ok(regla, 'existe la regla del texto creativo');
  const arriba = Number(regla.match(/padding:(\d+)px/)?.[1] ?? 0);
  // Los chips de arriba: el punto del canal en top:16 + 18 de alto, y «Analizando…» a su lado. Debajo, con aire: 40 o más.
  assert.ok(arriba >= 40, `el texto arranca debajo de los chips (padding de arriba ${arriba})`);
  assert.match(regla, /mask-image:linear-gradient\(/, 'se desvanece antes de las píldoras de abajo');
});

test('5. abajo del perfil no hay «Piezas · N publicadas», y una cantidad impar no deja hueco', () => {
  const src = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const ini = src.indexOf('const celdas = c ? [');
  assert.ok(ini > 0, 'existe el riel de números');
  const riel = src.slice(ini, src.indexOf('] : [];', ini));
  assert.ok(riel.length < 2_000, 'el recorte es el riel');
  assert.doesNotMatch(riel, /k: 'vivas'/, 'sin la celda de sus piezas publicadas');
  assert.match(riel, /k: 'ig', rot: 'Seguidores'/, 'Seguidores sigue');
  assert.match(src, /\.spy-kpi:last-child:nth-child\(odd\)\{grid-column:1\/-1\}/, 'la última de una cantidad impar ocupa la fila');
});

test('6. el número de arriba dice qué cuenta: el nombre del formato elegido', () => {
  const src = sinComentarios(leer('app/competitor-spy/GraficoSpy.tsx'));
  assert.match(src, /k: 'piezas', rot: GRUPOS\.find\(\(g\) => g\.value === grupo\)\?\.label/, 'el rótulo sale de GRUPOS');
  assert.doesNotMatch(src, /rot: grupo === 'anuncios' \? 'Anuncios' : 'Piezas'/, 'no vuelve el «Piezas» genérico');
});

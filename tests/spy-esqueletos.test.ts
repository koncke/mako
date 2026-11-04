// Cada sección de un competidor que carga se dibuja con su forma, no con la criatura (4/11/2026).
//
// Martín, con Leila Hormozi: «el bloque de arriba de "Analizando sus formatos…" debería aparecer el bloque con el placeholder
// típico, con los bloques cargando, no me refiero a mako, sino los placeholder típicos». El Cerebro: «nada de un renglón solo en
// un hueco… Vale para cada sección que todavía esté cargando».
//   1. el gráfico: sus líneas y sus miniaturas en gris, en lugares FIJOS (lo mismo en el server y en el navegador), la mitad en el
//      teléfono, y con la MISMA medida que el gráfico de verdad (si no, la pantalla salta al cargar);
//   2. «¿Qué formatos le funcionan?»: la tarjeta con su título, «Analizando…» y cinco filas con su gancho y su pista;
//   3. su oferta: sin nada leído, la tarjeta entera en gris; con lo que ya se sabe, eso a la vista y el puntaje en gris;
//      sin IA, su aviso y ningún gris;
//   4. su página: la forma de una página (barra, titular, tres columnas) mientras abre;
//   5. adentro de la ficha ya no queda la criatura: queda sólo para entrar a un competidor (OrdenSpy).
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · los puntos del gráfico al azar                                       → 1
//   · el esqueleto del gráfico más bajo que el gráfico (300 en vez de 380)  → 1
//   · los formatos con el renglón solo de antes                            → 2, 5
//   · la oferta que vuelve a la criatura                                   → 3, 5
//   · sin el puntaje en gris con la tesis ya leída                          → 3
//   · sin el tono más oscuro adentro de una tarjeta                         → 6
//   · su página sin las tres columnas                                      → 4
//
// Correr: node --import tsx --test tests/spy-esqueletos.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EsqueletoFormatos, EsqueletoGrafico, EsqueletoOferta, EsqueletoPagina } from '../app/competitor-spy/Esqueletos';
import { SuOferta } from '../app/competitor-spy/SuOferta';
import { vistaDeOferta } from '../lib/spy-oferta';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const cuantos = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const sinEstilo = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '');

test('1. el gráfico: sus líneas y sus miniaturas en gris, fijas, y con la medida del gráfico de verdad', () => {
  const html = renderToStaticMarkup(createElement(EsqueletoGrafico, { nombre: 'Leila Hormozi' }));
  const cuerpo = sinEstilo(html);
  assert.equal(cuantos(cuerpo, /class="spyesq-graf__pt"/g), 12, 'doce miniaturas en la computadora');
  assert.equal(cuantos(cuerpo, /class="spyesq-graf__marca"/g), 3, 'sus tres líneas de referencia');
  assert.match(cuerpo, /role="status"[^>]*>Cargando lo que publica Leila Hormozi</, 'el lector de pantalla oye qué carga');
  assert.match(cuerpo, /<div aria-hidden="true">/, 'lo gris no se lee');
  assert.equal(renderToStaticMarkup(createElement(EsqueletoGrafico, { nombre: 'Leila Hormozi' })), html, 'el mismo dibujo en cada render');
  // Fijos en el FUENTE: un azar al importar daría el mismo dibujo dos veces en un proceso, y otro en el server que en el navegador.
  const puntos = sinComentarios(leer('app/competitor-spy/Esqueletos.tsx')).match(/const PUNTOS[^=]*= \[([\s\S]*?)\];/)?.[1] ?? '';
  assert.ok(puntos.length > 100, 'existen los puntos del gráfico');
  assert.match(puntos.replace(/\b(?:true|false|x|y|v)\b/g, ''), /^[\s{}:,.\d]*$/, 'sólo números y verdaderos o falsos, escritos a mano');

  const tel = sinEstilo(renderToStaticMarkup(createElement(EsqueletoGrafico, { nombre: 'X', telefono: true })));
  assert.equal(cuantos(tel, /class="spyesq-graf__pt"/g), 6, 'la mitad en el teléfono, como el gráfico');

  // La misma medida: la caja del esqueleto mide lo que mide el gráfico, en la computadora y en el teléfono.
  const esq = leer('app/competitor-spy/Esqueletos.tsx');
  const graf = leer('app/competitor-spy/GraficoSpy.tsx');
  const medida = (css: string, clase: string) => css.match(new RegExp(`\\.${clase}\\{[^}]*?height:(\\d+)px;margin-left:(\\d+)px`, 'g'));
  assert.equal(medida(graf, 'spyg-plot')?.length, 2, 'el gráfico tiene su medida de computadora y de teléfono');
  assert.deepEqual(
    medida(esq, 'spyesq-graf')?.map((m) => m.replace(/^\.spyesq-graf/, '')),
    medida(graf, 'spyg-plot')?.map((m) => m.replace(/^\.spyg-plot/, '')),
    'el esqueleto mide lo que el gráfico (si no, la pantalla salta al cargar)',
  );
});

test('2. «¿Qué formatos le funcionan?»: la tarjeta con su título, «Analizando…» y sus filas', () => {
  const html = sinEstilo(renderToStaticMarkup(createElement(EsqueletoFormatos)));
  assert.match(html, /^<section class="spyg-caja" aria-busy="true"/, 'la tarjeta de la sección, no un renglón suelto');
  assert.match(html, /<h3>¿Qué formatos le funcionan\?<\/h3>/);
  assert.match(html, /role="status">Analizando…</);
  assert.equal(cuantos(html, /class="spyesq-fila"/g), 5, 'sus filas, con su pista');
  assert.ok(cuantos(html, /class="mk-skel"/g) >= 12, 'los bloques grises de la casa');

  const g = sinComentarios(leer('app/competitor-spy/GraficoSpy.tsx'));
  assert.match(g, /\{!filas\.length && analizando && <EsqueletoFormatos \/>\}/);
});

test('3. su oferta: toda en gris sin nada leído; con la tesis, el puntaje en gris; sin IA, su aviso', () => {
  const base = { nombre: 'Leila Hormozi', onConectado: () => {}, parte: 'cabeza' as const };

  const nada = sinEstilo(renderToStaticMarkup(createElement(SuOferta, { ...base, vista: undefined, datos: null })));
  assert.match(nada, /data-esqueleto="oferta"/, 'sin nada leído, la tarjeta en gris');
  assert.match(nada, /role="status"[^>]*>Leyendo la oferta de Leila Hormozi</);
  assert.doesNotMatch(nada, /spy-oferta-tesis/, 'no se dibuja su nombre como si fuera la tesis');
  assert.doesNotMatch(nada, /cm-carga/, 'sin la criatura');

  const datos = { promete: 'Escalar tu agencia a 100 mil al mes', aQuien: 'Dueños de agencias', precio: null, objecion: 'No tengo tiempo', huecos: [] };
  const conTesis = sinEstilo(renderToStaticMarkup(createElement(SuOferta, { ...base, vista: vistaDeOferta(null, ['https://leila.example.com']), datos })));
  assert.match(conTesis, /<p class="spy-oferta-tesis">Escalar tu agencia a 100 mil al mes<\/p>/, 'lo que ya se sabe, a la vista');
  assert.match(conTesis, /aria-busy="true"/);
  assert.match(conTesis, /class="mk-skel" style="display:block;width:88px;height:88px;border-radius:50%/, 'el puntaje que falta, en gris');

  const sinIa = sinEstilo(renderToStaticMarkup(createElement(SuOferta, { ...base, vista: { estado: 'sin-ia' }, datos: null })));
  assert.match(sinIa, /Conecta tu IA para leer su oferta/);
  assert.doesNotMatch(sinIa, /mk-skel/, 'sin IA no hay nada cargando');
});

test('4. su página: la forma de una página mientras abre', () => {
  const html = sinEstilo(renderToStaticMarkup(createElement(EsqueletoPagina)));
  assert.match(html, /class="spyesq-pagina__nav"/, 'su barra');
  assert.match(html, /class="spyesq-pagina__hero"/, 'su titular');
  assert.match(html, /class="spyesq-pagina__cols"[^>]*>(?:<span class="mk-skel"[^>]*><\/span>){3}<\/div>/, 'sus tres columnas');
  assert.match(html, /role="status"[^>]*>Abriendo su página</);
  const p = sinComentarios(leer('app/competitor-spy/SusPaginas.tsx'));
  assert.equal(cuantos(p, /<EsqueletoPagina \/>/g), 2, 'antes de saber si abre, y mientras carga');
});

test('5. adentro de la ficha no queda la criatura; sigue para entrar a un competidor', () => {
  for (const f of ['GraficoSpy.tsx', 'SuOferta.tsx', 'SusPaginas.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(`app/competitor-spy/${f}`)), /CargandoMako|Analizando sus formatos/, f);
  }
  assert.match(sinComentarios(leer('app/competitor-spy/OrdenSpy.tsx')), /<CargandoMako cubre /, 'entrar a un competidor sigue con la criatura');
});

test('6. el gris de los esqueletos se ve adentro de una tarjeta blanca, en claro y en oscuro', () => {
  const esq = leer('app/competitor-spy/Esqueletos.tsx');
  assert.match(esq, /\[data-esqueleto\] \.mk-skel\{background:linear-gradient\(90deg,var\(--border\) 25%/, 'el tono del borde, no --surface-2');
  for (const html of [
    renderToStaticMarkup(createElement(EsqueletoGrafico, { nombre: 'X' })), renderToStaticMarkup(createElement(EsqueletoFormatos)),
    renderToStaticMarkup(createElement(EsqueletoOferta, { nombre: 'X' })), renderToStaticMarkup(createElement(EsqueletoPagina)),
  ]) assert.match(html, /^(?:<[a-z]+ [^>]*)?data-esqueleto="/, 'cada esqueleto lleva su marca en la raíz (de ahí cuelga el tono)');
});

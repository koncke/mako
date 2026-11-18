// =============================================================================
// «Subir creativos» con los videos que MaKo ya generó: la PANTALLA (18/11/2026, F100 punto 1, lo prometido a Thiago).
// El servidor lo fija tests/media-buyer-subir-generado.test.ts (6/11); acá, lo que le faltaba a la pantalla.
// =============================================================================
// El servidor ya publicaba un video de MaKo por su `ref` y lo probaba contra un `original` (lib/media-buyer/subir.ts); la
// pantalla sólo aceptaba archivos del disco. Lo que se mira, EJECUTANDO:
//   1. la lista «Mis creativos» agrupa como la de antes: montados primero, tomas por anuncio;
//   2. sumar un video: no entra dos veces ni pasa el tope, y devuelve la MISMA lista;
//   3. lo listo y lo que todavía sube: un video de MaKo está listo sin path;
//   4. el cuerpo que arma la pantalla, leído por el lector REAL del servidor (leerPedidoDeSubida): sale con su ref, con
//      el path del disco y con el original sólo si se pidió;
//   5. el componente dibujado: los dos grupos, la tarjeta apagada si ya se eligió, el vacío y el aviso.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CreativoMako } from '../lib/creativo-mako';
import { leerPedidoDeSubida, type TextosCreativo } from '../lib/media-buyer/creativos';
import {
  TOPE_SUBIDA, agruparGenerados, archivoListo, nombreDeGenerado, pedidoDeSubida, subiendoAlgo, sumarGenerado, type ArchivoEnSubida,
} from '../app/ads-manager/subir-generados';
import { MisCreativos } from '../app/ads-manager/MisCreativos';

const video = (x: Partial<CreativoMako> & Pick<CreativoMako, 'ref' | 'origen' | 'plan_id' | 'titulo'>): CreativoMako => ({
  toma: null, url: `https://archivos.test/${x.ref}.mp4`, media_type: 'video', fecha: null, ...x,
} as CreativoMako);

const MONTADO = video({ ref: 'montaje:41', origen: 'montaje', plan_id: 'plan-a', titulo: 'Oferta de verano' });
const T1 = video({ ref: 'toma:plan-a:1:op1', origen: 'toma', plan_id: 'plan-a', titulo: 'Oferta de verano', toma: 1 });
const T2 = video({ ref: 'toma:plan-a:2:op2', origen: 'toma', plan_id: 'plan-a', titulo: 'Oferta de verano', toma: 2 });
const T3 = video({ ref: 'toma:plan-b:1:op3', origen: 'toma', plan_id: 'plan-b', titulo: 'El caso de Ana', toma: 1 });

const TEXTOS: TextosCreativo = { textoPrincipal: 'Un texto', titulo: 'Un título', cta: 'LEARN_MORE', link: 'https://ejemplo.test', formularioId: null };
const DEL_DISCO: ArchivoEnSubida = { clave: 'a', nombre: 'foto.jpg', tipo: 'image', progreso: 100, path: 'staging/3/abc.jpg', ref: null, error: null };

test('1. «Mis creativos» agrupa como la de antes: montados primero, y las tomas por el anuncio del que salen', () => {
  const g = agruparGenerados([MONTADO, T1, T2, T3]);
  assert.deepEqual(g.montados.map((c) => c.ref), ['montaje:41']);
  assert.deepEqual(g.anuncios.map((a) => [a.titulo, a.tomas.map((t) => t.toma)]), [['Oferta de verano', [1, 2]], ['El caso de Ana', [1]]]);
  assert.equal(nombreDeGenerado(T2), 'Oferta de verano · toma 2');
  assert.equal(nombreDeGenerado(MONTADO), 'Oferta de verano');
});

test('2. sumar un video de MaKo: entra listo, no entra dos veces y no pasa el tope', () => {
  const uno = sumarGenerado([], T1);
  assert.equal(uno.length, 1);
  assert.deepEqual({ ...uno[0], clave: '' }, { clave: '', nombre: 'Oferta de verano · toma 1', tipo: 'video', progreso: 100, path: null, ref: 'toma:plan-a:1:op1', error: null });
  assert.equal(sumarGenerado(uno, T1), uno, 'el mismo video dos veces cambió la lista');
  const lleno = Array.from({ length: TOPE_SUBIDA }, (_, i) => ({ ...DEL_DISCO, clave: String(i) }));
  assert.equal(sumarGenerado(lleno, T3), lleno, 'pasó el tope de la subida');
});

test('3. un video de MaKo está listo sin path; uno del disco, recién cuando subió', () => {
  const subiendo: ArchivoEnSubida = { ...DEL_DISCO, path: null, progreso: 40 };
  const deMako = sumarGenerado([], MONTADO)[0];
  assert.equal(archivoListo(deMako), true);
  assert.equal(archivoListo(subiendo), false);
  assert.equal(archivoListo({ ...deMako, error: 'falló' }), false);
  assert.equal(subiendoAlgo([deMako]), false, 'un video de MaKo no sube nada');
  assert.equal(subiendoAlgo([deMako, subiendo]), true);
});

test('4. el cuerpo de la pantalla, leído por el servidor: la ref, el path y el original sólo si se pidió', () => {
  const archivos = [DEL_DISCO, ...sumarGenerado([], T3), { ...DEL_DISCO, clave: 'b', path: null }];
  const sin = leerPedidoDeSubida(pedidoDeSubida({ adSetId: '12345', textos: TEXTOS, pausa: true, archivos, original: null }));
  assert.equal(sin.adSetId, '12345');
  assert.equal(sin.activo, false);
  assert.equal(sin.original, null);
  assert.deepEqual(sin.archivos, [
    { path: 'staging/3/abc.jpg', tipo: 'image', nombre: 'foto.jpg' },
    { path: '', tipo: 'video', nombre: 'El caso de Ana · toma 1', ref: 'toma:plan-b:1:op3' },
  ], 'lo que todavía sube no viaja, y el video de MaKo llega con su ref');
  const con = leerPedidoDeSubida(pedidoDeSubida({ adSetId: '12345', textos: TEXTOS, pausa: false, archivos, original: '987654' }));
  assert.equal(con.original, '987654', 'el original no llegó al servidor');
  assert.equal(con.activo, true);
});

test('5. el componente: los dos grupos, la tarjeta ya elegida apagada, el vacío y el aviso', () => {
  const html = renderToStaticMarkup(createElement(MisCreativos, { generados: [MONTADO, T1, T3], aviso: null, elegidos: [T1.ref], onElegir: () => {} }));
  assert.match(html, /Anuncios montados/);
  assert.match(html, /Tomas sueltas/);
  const botones = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  const apagado = botones.find((b) => b.includes('aria-label="Oferta de verano · toma 1"'));
  assert.ok(apagado && /disabled/.test(apagado), 'la toma ya elegida se puede volver a elegir');
  const libre = botones.find((b) => b.includes('aria-label="El caso de Ana · toma 1"'));
  assert.ok(libre && !/disabled/.test(libre), 'una toma sin elegir quedó apagada');
  assert.match(renderToStaticMarkup(createElement(MisCreativos, { generados: [], aviso: null, elegidos: [], onElegir: () => {} })), /Todavía no hay videos de MaKo/);
  assert.match(renderToStaticMarkup(createElement(MisCreativos, { generados: null, aviso: 'No pude leer tus videos de MaKo: x', elegidos: [], onElegir: () => {} })), /No pude leer tus videos de MaKo/);
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (18/11/2026). Base: 5 pasan / 0 fallan. Cada pieza, rota a propósito:
//   - agruparGenerados sin los montados ........................................ 3 / 2
//   - sumarGenerado deja entrar el mismo video dos veces ......................... 4 / 1
//   - archivoListo sin la ref (un video de MaKo nunca está listo) ................ 3 / 2
//   - pedidoDeSubida manda el path en vez de la ref ............................. 4 / 1
//   - pedidoDeSubida sin el original ........................................... 4 / 1
//   - MisCreativos no apaga lo ya elegido ....................................... 4 / 1
//   - un cambio sin efecto (un espacio en nombreDeGenerado) ..................... 5 / 0
// =============================================================================

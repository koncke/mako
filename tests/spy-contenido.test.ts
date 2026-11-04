// =============================================================================
// «Contenido» y «Funnel»: dos pestañas, el selector adentro del gráfico y cada miniatura con su proporción (4/11/2026)
// =============================================================================
// Pedido de Martín (por el Cerebro, 4/11): sólo dos pestañas; el selector y los filtros adentro de la tarjeta del
// gráfico; cada miniatura con su proporción real (reel vertical, imagen cuadrada, YouTube apaisado), en el gráfico y en
// las tarjetas; sin «Revisar ahora»; sin textos que narran lo que ya se ve; y la criatura sin la tarjeta blanca detrás.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada, base en verde (qué tests caen):
//   · `proporcionDe` con todo cuadrado                         → 1
//   · `medidaEnElGrafico` que no respeta el lado más largo     → 1
//   · vuelve una tercera pestaña                               → 2
//   · vuelve el botón «Revisar ahora»                          → 2
//   · el selector afuera de la tarjeta del gráfico             → 3
//   · la tarjeta del gráfico sin `data-cargando`               → 3
//   · las tarjetas de piezas sin su proporción                 → 3
// Correr: node --import tsx --test tests/spy-contenido.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { medidaEnElGrafico, proporcionDe } from '../lib/spy-detalle';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. cada miniatura con su proporción: reel y short verticales, publicación cuadrada, video largo y web apaisados', () => {
  assert.deepEqual(proporcionDe({ canal: 'instagram', tipo: 'reel', duracion: null }), { ancho: 9, alto: 16 });
  assert.deepEqual(proporcionDe({ canal: 'youtube', tipo: 'video', duracion: 'PT40S' }), { ancho: 9, alto: 16 });
  assert.deepEqual(proporcionDe({ canal: 'instagram', tipo: 'publicacion', duracion: null }), { ancho: 1, alto: 1 });
  assert.deepEqual(proporcionDe({ canal: 'youtube', tipo: 'video', duracion: 'PT12M' }), { ancho: 16, alto: 9 });
  assert.deepEqual(proporcionDe({ canal: 'landing', tipo: 'landing', duracion: null }), { ancho: 16, alto: 9 });
  assert.deepEqual(proporcionDe({ canal: 'anuncios', tipo: 'anuncio', duracion: null }), { ancho: 1, alto: 1 });
  // El lado más largo es el `lado`: ninguna miniatura se agranda por ser apaisada.
  assert.deepEqual(medidaEnElGrafico({ canal: 'instagram', tipo: 'reel', duracion: null }, 42), { ancho: 24, alto: 42 });
  assert.deepEqual(medidaEnElGrafico({ canal: 'youtube', tipo: 'video', duracion: 'PT12M' }, 42), { ancho: 42, alto: 24 });
  assert.deepEqual(medidaEnElGrafico({ canal: 'instagram', tipo: 'publicacion', duracion: null }, 42), { ancho: 42, alto: 42 });
});

test('2. dos pestañas, «Contenido» y «Funnel», y sin «Revisar ahora»', () => {
  const app = leer('app/competitor-spy/SpyApp.tsx');
  assert.match(app, /^type Pestana = 'contenido' \| 'funnel';$/m);
  const codigo = sinComentarios(app);
  assert.doesNotMatch(codigo, /Revisar ahora/, 'se revisa una vez, sola, y lo nuevo entra en segundo plano');
  assert.match(codigo, /rotulo: 'Contenido'/);
  assert.match(codigo, /rotulo: 'Funnel'/);
  assert.doesNotMatch(codigo, /activa === '(grafico|publica|miniaturas|oferta|sitio|anuncios)'/);
});

test('3. el selector y los filtros adentro de la tarjeta del gráfico; sin tarjeta mientras carga; las tarjetas con su proporción', () => {
  const g = sinComentarios(leer('app/competitor-spy/GraficoSpy.tsx'));
  const caja = g.indexOf('<section className="spyg-caja" data-cargando={g.puntos.length > 0 && !bajadas}');
  assert.ok(caja > 0, 'la tarjeta del gráfico dice si está cargando');
  const herr = g.indexOf('<div className="spyg-herr">');
  assert.ok(herr > caja && herr < g.indexOf('</section>', caja), 'el selector va adentro de la tarjeta');
  assert.match(g, /\.spyg-caja\[data-cargando=true\]\{border-color:transparent;background:transparent;box-shadow:none\}/);
  assert.doesNotMatch(g, /Cada miniatura es/);
  assert.match(g, /const m = medidaEnElGrafico\(p, telefono \? 30 : 42\);/);
  const t = sinComentarios(leer('app/competitor-spy/TarjetaPieza.tsx'));
  assert.match(t, /className="spy-pcard__media" style=\{\{ aspectRatio: `\$\{proporcionDe\(p\)\.ancho\} \/ \$\{proporcionDe\(p\)\.alto\}` \}\}/);
});

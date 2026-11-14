// =============================================================================
// «Contenido» y «Funnel»: dos pestañas, el selector adentro del gráfico y cada miniatura con su proporción (4/11/2026)
// =============================================================================
// Pedido de Martín (por el Cerebro, 4/11): sólo dos pestañas; el selector y los filtros adentro de la tarjeta del
// gráfico; cada miniatura con su proporción real (reel vertical, imagen cuadrada, YouTube apaisado), en el gráfico y en
// las tarjetas; sin «Revisar ahora»; sin textos que narran lo que ya se ve. Mientras carga, la tarjeta con su esqueleto (Martín,
// 4/11 tarde: «el placeholder típico, con los bloques cargando, no me refiero a mako»; reemplaza la criatura sin tarjeta).
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada, base en verde (qué tests caen):
//   · `proporcionDe` con todo cuadrado                         → 1
//   · `medidaEnElGrafico` que no respeta el lado más largo     → 1
//   · vuelve una tercera pestaña                               → 2   (14/11: la de «Anuncios» volvió, pedida; ver el test)
//   · vuelve el botón «Revisar ahora»                          → 2
//   · el selector afuera de la tarjeta del gráfico             → 3
//   · el gráfico que vuelve a la criatura mientras carga       → 3
//   · las tarjetas de piezas sin su proporción                 → 3
//   · la ficha con la caricatura en vez de su foto             → 4
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

test('2. «Contenido», «Anuncios» y «Funnel», y sin «Revisar ahora»', () => {
  // Eran dos desde el 4/11 («partían lo mismo en seis lugares»). El 14/11 Martín pidió los anuncios como Spyder de Foreplay
  // (tests/spy-anuncios-ficha.test.ts): «Anuncios» volvió, pero NO con otra grilla. La grilla de anuncios sigue en «Contenido».
  const app = leer('app/competitor-spy/SpyApp.tsx');
  assert.match(app, /^type Pestana = 'contenido' \| 'anuncios' \| 'funnel';$/m);
  const codigo = sinComentarios(app);
  assert.doesNotMatch(codigo, /Revisar ahora/, 'se revisa una vez, sola, y lo nuevo entra en segundo plano');
  assert.match(codigo, /rotulo: 'Contenido'/);
  assert.match(codigo, /rotulo: 'Anuncios'/);
  assert.match(codigo, /rotulo: 'Funnel'/);
  assert.doesNotMatch(codigo, /activa === '(grafico|publica|miniaturas|oferta|sitio)'/);
  assert.match(codigo, /\{activa === 'anuncios' && <AnunciosSpy /, 'la pestaña de anuncios es el análisis, no otra GrillaPiezas');
});

test('3. el selector y los filtros adentro de la tarjeta del gráfico; su esqueleto mientras carga; las tarjetas con su proporción', () => {
  const g = sinComentarios(leer('app/competitor-spy/GraficoSpy.tsx'));
  const caja = g.indexOf('<section className="spyg-caja" aria-busy={g.puntos.length > 0 && !bajadas}');
  assert.ok(caja > 0, 'la tarjeta del gráfico dice si está cargando');
  const herr = g.indexOf('<div className="spyg-herr">');
  assert.ok(herr > caja && herr < g.indexOf('</section>', caja), 'el selector va adentro de la tarjeta');
  assert.match(g, /\{g\.puntos\.length > 0 && !bajadas && <EsqueletoGrafico telefono=\{telefono\} nombre=\{c\.nombre\} \/>\}/, 'su esqueleto adentro de la tarjeta');
  assert.doesNotMatch(g, /CargandoMako/, 'la criatura queda para entrar a un competidor');
  assert.doesNotMatch(g, /Cada miniatura es/);
  assert.match(g, /const m = medidaEnElGrafico\(p, telefono \? 30 : 42\);/);
  const t = sinComentarios(leer('app/competitor-spy/TarjetaPieza.tsx'));
  assert.match(t, /const \{ ancho, alto \} = proporcionDe\(p\);/);
  assert.match(t, /<div className=\{s\.mini\} style=\{\{ aspectRatio: `\$\{ancho\} \/ \$\{alto\}` \}\}>/, 'el marco de Create con SU proporción');
});

test('4. la ficha abierta muestra su foto REAL de perfil; la lista, su caricatura', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const ficha = app.slice(app.indexOf('<section className="spy-ficha">'), app.indexOf('</section>', app.indexOf('<section className="spy-ficha">')));
  assert.match(ficha, /<img className="spy-ficha__foto" src=\{c\.avatar\}/, 'la foto de su perfil, no `caraDeTarjeta`');
  assert.doesNotMatch(ficha, /caraDeTarjeta|caricatura/);
  assert.match(app, /const cara = caraDeTarjeta\(c, caricaturaDeCompetidor\(c\)\);/, 'en la lista sigue la caricatura');
});

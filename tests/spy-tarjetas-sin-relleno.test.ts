// Las tarjetas de «Todas sus piezas» y los números de arriba (4/11/2026).
//
// Martín, con Leila Hormozi en producción: «mira la captura como se bugea las tarjetas» (una tarjeta estirada con un bloque
// crema enorme debajo), «el chip "Analizando…" tapa el nombre», «"Hace 2 d" tapa el texto de la pieza», «"No lo publica" y
// "Publicación · 110…" cortado se ven mal». Y con Den Borg: «hay 2 bloques de "Piezas", no necesitamos 2... Quita el que está
// abajo del perfil», con 181 arriba y 255 abajo.
// Desde el 12/11/2026 la tarjeta es la de los outliers de Create (TarjetaPieza.tsx); las reglas de Martín siguen:
//   1. sólo los números que hay (▶ vistas, ♥ me gusta, 💬 comentarios): nunca «No lo publica» ni un cero inventado;
//   2. arriba, la marca de su red con su tipo; el nombre, en el pie y no tapado por nada;
//   3. cada tarjeta mide lo suyo: la fila no estira a la más alta;
//   4. el texto de una publicación sin foto arranca debajo de los chips de arriba y se desvanece antes de los de abajo;
//   5. abajo del perfil no hay «Piezas · N publicadas», y una cantidad impar de números no deja un hueco;
//   6. el número de arriba dice qué cuenta: el nombre del formato elegido.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · `numerosDeTarjeta` sin filtrar los que no son número                  → 1
//   · un anuncio con números                                                → 1
//   · la marca de arriba sin su tipo                                        → 2
//   · el nombre fuera del pie                                               → 2
//   · la pantalla del teléfono sin <BrandDefs /> (el logo de la red, vacío)   → 2
//   · `.spy-pgrid--ancha` sin align-items:start                             → 3
//   · el texto creativo pegado a las marcas (padding de arriba < 40) o sin máscara → 4
//   · la foto en lugar del texto (el texto como `else` de la foto)           → 4
//   · vuelve la celda 'vivas' del riel                                      → 5
//   · el rótulo de arriba vuelve a «Piezas»                                 → 6
//
// Correr: node --import tsx --test tests/spy-tarjetas-sin-relleno.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as modulo from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PiezaVista } from '../app/competitor-spy/actions';

// Node no carga CSS: la tarjeta usa las clases de los outliers de Create (un `.module.css`), así que se reemplazan por nada ANTES
// de importarla (como tests/carruseles-pantalla.test.ts). Se mira el contenido, no las clases.
type Hook = (url: string, ctx: { parentURL?: string }, next: (url: string, ctx: unknown) => unknown) => unknown;
const { registerHooks } = modulo as unknown as { registerHooks: (h: { resolve?: Hook; load?: Hook }) => void };
registerHooks({ load: (url, ctx, next) => (/\.css($|\?)/.test(url) ? { format: 'commonjs', source: '', shortCircuit: true } : next(url, ctx)) });

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

async function dibujar(p: PiezaVista): Promise<string> {
  const { TarjetaPieza } = await import('../app/competitor-spy/TarjetaPieza');
  return renderToStaticMarkup(createElement(TarjetaPieza, { p }));
}

test('1. sólo los números que hay: nunca «No lo publica» ni un cero inventado', async () => {
  const conAmbos = await dibujar(pieza({ vistas: 52_000, megusta: 11_000 }));
  assert.match(conAmbos, /<span title="52 mil vistas">▶ 52 mil<\/span>/, 'sus vistas');
  assert.match(conAmbos, /<span title="11 mil me gusta">♥ 11 mil<\/span>/, 'sus me gusta');
  assert.doesNotMatch(conAmbos, /💬/, 'sin el dato de comentarios, no hay comentarios');

  const soloMg = await dibujar(pieza({ tipo: 'publicacion', megusta: 110 }));
  assert.match(soloMg, /<span title="110 me gusta">♥ 110<\/span>/);
  assert.doesNotMatch(soloMg, /▶/, 'sin vistas, no hay vistas');

  const sinNada = await dibujar(pieza({ tipo: 'publicacion' }));
  assert.doesNotMatch(sinNada, /▶|♥|💬/, 'sin ningún número no hay números');
  assert.doesNotMatch(sinNada, /No lo publica|Sin leer/, 'nunca una frase en el lugar de un número');

  const anuncio = await dibujar(pieza({ canal: 'anuncios', tipo: 'anuncio', vistas: 9, megusta: 9 }));
  assert.doesNotMatch(anuncio, /▶|♥|💬/, 'un anuncio no publica sus números');
});

test('2. arriba, la marca de su red con su tipo; el nombre, en el pie y entero', async () => {
  const reel = await dibujar(pieza({ vistas: 52_000 }));
  assert.match(reel, /Reel<\/span>/, 'la marca dice su tipo');
  assert.match(reel, /<span title="Tres errores al vender tu primer servicio">Tres errores al vender tu primer servicio<\/span>/, 'el nombre, entero');
  assert.ok(reel.indexOf('Reel</span>') < reel.indexOf('title="Tres errores'), 'la marca va en la imagen, el nombre en el pie');
  assert.match(await dibujar(pieza({ tipo: 'video', canal: 'youtube' })), /Video<\/span>/);
  // El logo de la red (LogoRed) se dibuja con los <symbol> de <BrandDefs>: sin él sale vacío. Cada pantalla con tarjetas lo monta.
  for (const f of ['app/competitor-spy/SpyApp.tsx', 'app/m/competitor-spy/SpyM.tsx']) {
    assert.match(sinComentarios(leer(f)), /<BrandDefs \/>/, `${f} monta los logos de las redes`);
  }
});

test('3. cada tarjeta mide lo suyo: la fila no estira a la más alta', () => {
  const css = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(css, /\.spy-pgrid--ancha\{[^}]*align-items:start/, 'la grilla ancha alinea arriba');
  assert.match(css, /\.spy-pgrid__celda\{[^}]*align-self:start/, 'cada celda va arriba con su altura');
});

test('4. el texto sin foto arranca debajo de las marcas de arriba y se desvanece abajo', async () => {
  const css = leer('app/competitor-spy/tarjeta-pieza.module.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const regla = css.match(/\.texto \{([^}]*)\}/)?.[1] ?? '';
  assert.ok(regla, 'existe la regla del texto creativo');
  const arriba = Number(regla.match(/padding: (\d+)px/)?.[1] ?? 0);
  // Las marcas de arriba (explorar.module.css): a 8 px y de 24 de alto. Debajo, con aire: 40 o más.
  assert.ok(arriba >= 40, `el texto arranca debajo de las marcas (padding de arriba ${arriba})`);
  assert.match(regla, /mask-image: linear-gradient\(/, 'se desvanece antes del borde');
  // Y la foto va ENCIMA del texto, no en su lugar: si no carga, se borra y queda el texto.
  const html = await dibujar(pieza({ texto: 'Lo que nadie te dice de vender', miniatura: 'https://x.supabase.co/a.jpg' }));
  assert.ok(html.indexOf('Lo que nadie te dice') > 0 && html.indexOf('Lo que nadie te dice') < html.indexOf('<img'), 'el texto debajo de la foto');
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

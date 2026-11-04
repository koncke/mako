// Den Borg en producción (4/11/2026, el Cerebro): «Casi todas las tarjetitas del gráfico son el degradado rosa de Instagram, sin
// miniatura», «el gráfico tarda más de 6 s», «el primer cuadro del recorrido salió con el texto vacío» y «al hacer scroll, el
// recorrido sigue pero el foco se pierde».
//
// Medido en el código: `guardarMiniaturas` corta a los 9 s, y la traída larga guarda cientos de piezas de una vez; sólo las
// primeras ~50-80 bajaban su foto y el resto quedaba con la URL del CDN de Meta, que vence en días (su `oe`) y nadie volvía a bajar.
// El gráfico, además, esperaba hasta 3 s a esas imágenes muertas. Y el recorrido podía abrirse con la ficha todavía armándose.
//   1. una URL vencida no se pide: la tarjeta sale con su texto sin esperar;
//   2. cada vuelta de la traída larga (el cron de cada hora y al abrir la ficha) baja las que faltan, mientras su URL sirve;
//   3. el recorrido se abre con la ficha quieta, y mientras está abierto la página no se scrollea a mano.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · `miniaturaDePieza` sin mirar si venció                               → 1
//   · el relleno después de pedir la clave de Spy                         → 2
//   · el relleno sin saltear las vencidas                                  → 2
//   · el recorrido abierto sin esperar a la ficha                          → 3
//   · sin trabar el scroll                                                 → 3
//
// Correr: node --import tsx --test tests/spy-miniaturas-recorrido.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { miniaturaDePieza, urlVencida } from '../lib/spy-vista';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const AHORA = Date.parse('2026-11-04T16:00:00Z');
const oe = (ms: number) => Math.floor(ms / 1000).toString(16);
const CDN = (vence: number) => `https://scontent.cdninstagram.com/v/t51/abc.jpg?stp=x&oe=${oe(vence)}&_nc_sid=1`;

test('1. una URL del CDN vencida no se pide: la tarjeta sale con su texto', () => {
  assert.equal(urlVencida(CDN(AHORA - 60_000), AHORA), true);
  assert.equal(urlVencida(CDN(AHORA + 86_400_000), AHORA), false);
  assert.equal(urlVencida('https://example.com/x.jpg', AHORA), false, 'sin oe no se sabe: se intenta');
  assert.equal(urlVencida('https://x.com/a.jpg?oe=zz', AHORA), false);
  assert.equal(urlVencida('no es una url', AHORA), false);
  assert.equal(miniaturaDePieza({ canal: 'instagram', ref: 'a', miniatura: CDN(AHORA - 1000) }, AHORA), null);
  assert.equal(miniaturaDePieza({ canal: 'instagram', ref: 'a', miniatura: CDN(AHORA + 86_400_000) }, AHORA), CDN(AHORA + 86_400_000));
  const nuestra = 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/spy/instagram/a.jpg';
  assert.equal(miniaturaDePieza({ canal: 'instagram', ref: 'a', miniatura: nuestra }, AHORA), nuestra);
  assert.equal(miniaturaDePieza({ canal: 'youtube', ref: 'AbCdEfGhIj0', miniatura: null }, AHORA), 'https://i.ytimg.com/vi/AbCdEfGhIj0/mqdefault.jpg');
});

test('2. cada vuelta de la traída larga baja las miniaturas que faltan, mientras su URL sirve', () => {
  const todo = sinComentarios(leer('lib/spy-todo.ts'));
  const av = todo.slice(todo.indexOf('export async function avanzarTodo'));
  const relleno = av.indexOf('await rellenarMiniaturas(id);');
  const clave = av.indexOf('credDelCliente(APIFY_CLAVE_DE_SPY');
  assert.ok(relleno > 0, 'avanzarTodo no rellena');
  assert.ok(clave > 0 && relleno < clave, 'el relleno no necesita la clave de Spy: va antes');
  const mini = sinComentarios(leer('lib/spy-miniaturas-relleno.ts'));
  const f = mini.slice(mini.indexOf('export async function rellenarMiniaturas'));
  assert.match(f, /\.like\('miniatura', 'https:\/\/%'\)\.not\('miniatura', 'like', `%\/\$\{BUCKET_MINIATURAS\}\/%`\)/, 'sólo las que no son nuestras');
  assert.match(f, /const vigentes = filas\.filter\(\(f\) => !urlVencida\(f\.miniatura, ahora\)\)\.slice\(0, RELLENO_POR_VUELTA\)/, 'saltea las vencidas, con su tope');
  assert.match(f, /\.update\(\{ miniatura: f\.miniatura \}\)\.eq\('id', f\.id\)\.eq\('competidor_id', competidorId\)/);
  assert.match(f, /await getTenantDb\(\)/, 'por el negocio');
});

test('3. el recorrido se abre con la ficha quieta, y abierto la página no se scrollea a mano', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /const recorridoListo = !!c && !trayendo && ordenando == null;/);
  assert.match(app, /const recorridoAbierto = recorrido\.abierto && recorridoListo;/);
  assert.match(app, /<Recorrido id=\{RECORRIDO_SPY\} pasos=\{PASOS_SPY\} abierto=\{recorridoAbierto\} /);
  assert.match(app, /if \(!recorridoAbierto\) return;\s*const raiz = document\.documentElement;\s*const antes = raiz\.style\.overflow;\s*raiz\.style\.overflow = 'hidden';\s*return \(\) => \{ raiz\.style\.overflow = antes; \};/);
});

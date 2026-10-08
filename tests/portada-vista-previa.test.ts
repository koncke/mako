// La tarjeta que se ve al pegar o pautar https://hola-mako.com/ es la de la LANDING, no la de
// material compartido.
//
// Hasta el 08/10/2026 la portada no declaraba la suya y caía en la del layout (/og-mako.jpg),
// que dice «Material compartido» escrito en la imagen: se vio en el Depurador de contenido
// compartido de Meta mientras se revisaba la verificación del negocio.
//
// Verificado rompiéndolo: volver la imagen a /og-mako.jpg → 1 fallo; sacar `type` del
// openGraph (el de la página REEMPLAZA al del layout, no se mezcla) → 1 fallo; borrar
// public/og-landing.jpg → 1 fallo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';
import { metadata } from '../app/page';

type Og = { type?: string; siteName?: string; url?: string; title?: string; images?: Array<{ url: string }> };

test('la portada declara su propia imagen, no la de material compartido', () => {
  const og = metadata.openGraph as Og;
  const img = og.images?.[0]?.url;
  assert.equal(img, '/og-landing.jpg');
  const tw = metadata.twitter as { images?: string[] };
  assert.deepEqual(tw.images, ['/og-landing.jpg']);
});

test('el openGraph de la portada va completo, porque reemplaza al del layout', () => {
  const og = metadata.openGraph as Og;
  assert.equal(og.type, 'website');
  assert.equal(og.siteName, 'MaKo');
  assert.equal(og.url, '/');
  assert.equal(og.title, metadata.title);
});

test('la imagen existe y es liviana (WhatsApp descarta las previews pesadas)', () => {
  const ruta = new URL('../public/og-landing.jpg', import.meta.url);
  assert.ok(existsSync(ruta), 'falta public/og-landing.jpg');
  assert.ok(statSync(ruta).size < 300_000, 'la imagen pesa más de 300 KB');
});

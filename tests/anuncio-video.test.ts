// =============================================================================
// Los anuncios ganadores: póster vertical y el video se reproduce en la hoja (#860)
// =============================================================================
// Martín, revisión del 16/10/2026 (1:14:00): «en los anuncios que más te traen, se corta la cara de la persona porque los
// anuncios normalmente son en vertical… Y número dos, debería poder reproducirse ahí mismo». Lo que se puede romper sin que
// se vea: un reproductor de OTRO origen metido en un iframe de la app (sale de una respuesta de Meta: se valida el host),
// el ▶ en un link compartido (la ruta pide sesión: daría error), y la miniatura de vuelta en 4:3.
//
// Correr: node --import tsx --test tests/anuncio-video.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026, base 4/0): `srcDelReproductor` sin mirar el host → 3 / 1; la miniatura de la portada
// otra vez en 4:3 → 3 / 1; el ▶ también en un link compartido → 3 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esTarjetaDeAnuncio, srcDelReproductor, videoDelCreativo } from '../lib/anuncio-video';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

test('el reproductor sale de embed_html y SÓLO si es el plugin de video de facebook.com', () => {
  const bueno = '<iframe allow="autoplay" src="https://www.facebook.com/plugins/video.php?height=1920&amp;href=https%3A%2F%2Fwww.facebook.com%2Fx%2Fvideos%2F1%2F&amp;width=1080" width="1080"></iframe>';
  assert.equal(srcDelReproductor(bueno), 'https://www.facebook.com/plugins/video.php?height=1920&href=https%3A%2F%2Fwww.facebook.com%2Fx%2Fvideos%2F1%2F&width=1080');
  for (const malo of [
    '<iframe src="https://evil.example/plugins/video.php?x=1"></iframe>',
    '<iframe src="http://www.facebook.com/plugins/video.php?x=1"></iframe>',
    '<iframe src="https://www.facebook.com/login.php"></iframe>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<div></div>', null, 42,
  ]) assert.equal(srcDelReproductor(malo), null, String(malo));
  assert.equal(videoDelCreativo({ video_id: '1066305813011996' }), '1066305813011996');
  assert.equal(videoDelCreativo({ object_story_spec: { video_data: { video_id: '77' } } }), '77');
  assert.equal(videoDelCreativo({ image_hash: 'x' }), null, 'un anuncio de imagen no tiene video');
});

test('el ▶ va en las tarjetas que son UN anuncio, con sesión y mirando', () => {
  assert.equal(esTarjetaDeAnuncio({ fuente: 'meta', dimension: 'anuncio' }), true);
  assert.equal(esTarjetaDeAnuncio({ fuente: 'guiones', dimension: 'guion' }), true);
  assert.equal(esTarjetaDeAnuncio({ fuente: 'meta', dimension: 'campana' }), false, 'una campaña son varios anuncios: no hay UN video');
  const graf = sinComentarios(leer('app/dashboard/Grafico.tsx'));
  assert.match(graf, /const alReproducir = conReproductor && esTarjetaDeAnuncio\(g\) \? /);
  assert.match(graf, /\{video && <ReproductorAnuncio adId=\{video\.adId\} nombre=\{video\.nombre\} onCerrar=\{\(\) => setVideo\(null\)\} \/>\}/);
  assert.match(sinComentarios(leer('app/dashboard/EditorInforme.tsx')), /const conReproductor = !compartido && !editando;/, 'el ▶ aparece en un link compartido (la ruta del video pide sesión)');
});

test('la ruta del video: la puerta de Ads, el token del workspace, y el src validado', () => {
  const ruta = sinComentarios(leer('app/api/anuncios/video/route.ts'));
  const get = ruta.slice(ruta.indexOf('export async function GET'));
  assert.match(get, /^export async function GET\(req: NextRequest\) \{\s*const no = await guardAdsWs\(\);\s*if \(no\) return no;/);
  assert.match(ruta, /await credWs\('META_ACCESS_TOKEN'\)/);
  assert.match(ruta, /reproductor: srcDelReproductor\(v\.embed_html\)/);
});

test('la miniatura de un anuncio en la portada es un póster vertical, no una franja 4:3', () => {
  const css = leer('app/dashboard/editor-css.ts');
  const regla = /\.lk-comp--portada \.gr-tarjeta-mini \{[^}]*\}/.exec(css)?.[0] ?? '';
  assert.match(regla, /aspect-ratio: 9 \/ 16/, 'la miniatura de la portada volvió a otra proporción');
  assert.match(regla, /object-fit: cover/);
  assert.match(leer('app/dashboard/graficos/estilos-html.ts'), /\.gr-tarjeta-play \{/);
});

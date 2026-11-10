// =============================================================================
// La miniatura se baja y se guarda: lo que tiene que ser cierto para que se vea
// =============================================================================
// Martín, 2/11/2026, mirando la tab ya desplegada: «las miniaturas de IG no se ven, sólo cajas
// vacías... si tenemos que descargar la imagen y guardarla, lo hacemos».
//
// ⚠️ ERAN DOS COSAS A LA VEZ, y por eso guardar sólo la URL no alcanzaba:
//   1. la URL del CDN de Meta VENCE (eso ya se sabía, y era el motivo de 0359 para no guardarla);
//   2. el CDN de Meta devuelve 403 a todo pedido de otro dominio, venza o no (eso NO se sabía).
// Bajar los bytes arregla las dos.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUCKET_MINIATURAS, achicarImagen, esNuestra, rutaDeMiniatura, tipoDeImagen } from '../lib/spy-miniaturas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const bytes = (...n: number[]) => new Uint8Array([...n, ...Array(16).fill(0)]);

test('el tipo sale de los BYTES, nunca de lo que declara un servidor ajeno', () => {
  assert.deepEqual(tipoDeImagen(bytes(0xff, 0xd8, 0xff, 0xe0)), { mime: 'image/jpeg', ext: 'jpg' });
  assert.deepEqual(tipoDeImagen(bytes(0x89, 0x50, 0x4e, 0x47)), { mime: 'image/png', ext: 'png' });
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0, 0]);
  assert.deepEqual(tipoDeImagen(webp), { mime: 'image/webp', ext: 'webp' });
});

test('lo que NO es una imagen no entra al bucket', () => {
  // Un CDN puede contestar 200 con una página de error, y eso no se guarda como si fuera la foto.
  assert.equal(tipoDeImagen(new TextEncoder().encode('<!doctype html><html>403</html>')), null);
  assert.equal(tipoDeImagen(new Uint8Array(0)), null, 'una respuesta vacía no es una imagen');
  assert.equal(tipoDeImagen(bytes(0x00, 0x01, 0x02, 0x03)), null);
  // ⚠️ Un SVG es un documento ACTIVO y el bucket se sirve bajo el dominio de Supabase: no entra.
  assert.equal(tipoDeImagen(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">')), null);
});

test('la ruta no lleva el negocio: la misma pieza cae siempre en el mismo lugar', () => {
  // La miniatura de @leilahormozi es la misma para todos los que la miren: se baja UNA vez.
  const a = rutaDeMiniatura('instagram', 'ABC123', 'jpg');
  assert.equal(a, 'spy/instagram/ABC123.jpg');
  assert.equal(rutaDeMiniatura('instagram', 'ABC123', 'jpg'), a, 'la ruta tiene que ser determinista');
  assert.doesNotMatch(a, /\d{1,6}\//, 'la ruta no puede llevar un workspace_id');
});

test('un `ref` raro no se escapa de su carpeta', () => {
  const r = rutaDeMiniatura('youtube', '../../otra/cosa?x=1', 'png');
  assert.doesNotMatch(r, /\.\./, 'un ref con `..` saldría de la carpeta del bucket');
  assert.match(r, /^spy\/youtube\/[A-Za-z0-9_-]+\.png$/);
});

test('lo que ya es nuestro no se vuelve a bajar', () => {
  assert.equal(esNuestra(`https://x.supabase.co/storage/v1/object/public/${BUCKET_MINIATURAS}/spy/instagram/a.jpg`), true);
  assert.equal(esNuestra('https://scontent.cdninstagram.com/v/t51/123.jpg'), false);
  assert.equal(esNuestra(null), false);
  assert.equal(esNuestra(undefined), false);
});

test('bajar una miniatura NUNCA puede romper la lectura del competidor', () => {
  // Se mira el código: lo que no puede pasar es que un fallo de red se propague. Perder el
  // competidor entero por una imagen sería cambiar un problema chico por uno grande.
  const src = readFileSync(join(RAIZ, 'lib/spy-miniaturas.ts'), 'utf8');
  assert.match(src, /catch\s*\{/, 'el bajador perdió su catch: un CDN caído rompería la lectura');
  assert.match(src, /AbortSignal\.timeout/, 'sin timeout, un CDN que no contesta cuelga la lectura entera');
  assert.match(src, /referrerPolicy: 'no-referrer'/, 'sin esto el CDN de Meta devuelve 403');

  // ⚠️ EL PRESUPUESTO TOTAL, que es lo que evita romper «Revisar ahora». Esto corre ADENTRO de la
  // acción que dispara el usuario, y Spy no declara `maxDuration`, así que vale el tope por
  // defecto de Vercel: sin tope total, 50 piezas de a 6 con 4 s cada una son ~36 s sólo de
  // imágenes, y se cae la lectura entera — la que trae los datos.
  const pres = /const PRESUPUESTO_MS = ([\d_]+);/.exec(src);
  assert.ok(pres, 'se perdió el presupuesto total: una lectura con muchas piezas se pasa del tope de la función');
  const ms = Number(pres[1].replace(/_/g, ''));
  assert.ok(ms > 0 && ms <= 15_000, `el presupuesto quedó en ${ms} ms: tiene que entrar en el tope de la función`);
  // Y que se MIRE antes de cada tanda, no que esté declarado nomás: un guard que busca el nombre
  // de una constante encuentra la declaración, no el uso (ya pasó dos veces esta noche).
  assert.match(src, /Date\.now\(\)\s*>=\s*hasta/, 'el presupuesto está declarado pero no se respeta en el bucle');

  // Y que el guardado quede enganchado: sin esto se guarda la URL ajena y volvemos al problema.
  const spy = readFileSync(join(RAIZ, 'lib/spy.ts'), 'utf8');
  assert.match(spy, /guardarMiniaturas\(/, 'spy.ts dejó de bajar las miniaturas antes de guardar');

  // ⚠️ Y que REUSE la que ya bajó. Lo que llega de la API es siempre la URL fresca del CDN, así
  // que sin esto `esNuestra` da false y se volvería a bajar TODO en cada lectura: el presupuesto
  // de 9 s se gastaría siempre en las mismas imágenes y nunca llegaría a las que faltan, o sea
  // que no convergería nunca.
  assert.match(spy, /yaBajada/, 'spy.ts dejó de reusar la miniatura ya bajada: la vuelve a bajar en cada lectura');
  assert.match(spy, /select\('ref, canal, miniatura'\)/, 'sin traer `miniatura` no se puede saber cuál ya está bajada');
});

// LA QUE PASA EL TOPE SE ACHICA (10/11/2026). Instagram sirve láminas de hasta 3277×4096 y 3,7 MB; con el tope del bucket como tope
// de bajada se tiraban en silencio, y 37 carruseles del lote pago quedaron sin láminas. Verificado rompiéndolo: `achicarImagen`
// devolviendo la imagen tal cual → cae este test.
test('una imagen de más de 2 MB se sube achicada: JPEG, menos de 2 MB, 1440 de ancho y la misma proporción', async () => {
  const { default: sharp } = await import('sharp');
  const ancho = 2600, alto = 3250;
  const ruido = Buffer.alloc(ancho * alto * 3);
  for (let i = 0; i < ruido.length; i++) ruido[i] = (i * 2654435761) >>> 24;
  const grande = new Uint8Array(await sharp(ruido, { raw: { width: ancho, height: alto, channels: 3 } }).jpeg({ quality: 97 }).toBuffer());
  assert.ok(grande.length > 2 * 1024 * 1024, `la de prueba tiene que pasar el tope (pesa ${grande.length})`);
  const chica = await achicarImagen(grande);
  assert.ok(chica, 'no la achicó');
  assert.ok(chica.length <= 2 * 1024 * 1024, `achicada pesa ${chica.length}`);
  assert.equal(tipoDeImagen(chica)?.mime, 'image/jpeg');
  const m = await sharp(Buffer.from(chica)).metadata();
  assert.equal(m.width, 1440);
  assert.equal(m.height, Math.round(1440 * alto / ancho), 'la misma proporción');
  assert.equal(await achicarImagen(new TextEncoder().encode('<html>no es una imagen</html>')), null, 'lo que no es imagen no se achica: null');
});

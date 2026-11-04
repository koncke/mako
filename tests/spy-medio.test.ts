// Si una publicación de Instagram es un carrusel, una imagen o un video, y cuántas láminas trae (lib/spy-medio.ts, mig 0391).
// Lo pide el explorador de carruseles del Image Editor: sin esto, un carrusel de 7 láminas y una foto suelta eran lo mismo.
//
// Probado rompiéndolo (4/11/2026), base 6/0:
//   · `medioDeInstagram` sin la rama de 'sidecar' → 2 rojos (el de Apify y el de `piezasDeApify`);
//   · `laminasDe` con `n >= 1` → 1 rojo (una sola lámina no es un carrusel);
//   · `medio` y `laminas` metidos en `comun` (el upsert de siempre) → 1 rojo (el guard del archivo).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { faltaLaColumnaDeMedio, gruposDeMedio, laminasDe, medioDeInstagram } from '../lib/spy-medio';
import { piezasDeApify } from '../lib/instagram-perfil';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el medio sale de lo que dijo la fuente, Meta o Apify; lo que no se reconoce no se adivina', () => {
  assert.equal(medioDeInstagram('CAROUSEL_ALBUM'), 'carrusel');
  assert.equal(medioDeInstagram('Sidecar'), 'carrusel');
  assert.equal(medioDeInstagram('IMAGE'), 'imagen');
  assert.equal(medioDeInstagram('Image'), 'imagen');
  assert.equal(medioDeInstagram('VIDEO'), 'video');
  assert.equal(medioDeInstagram('Video'), 'video');
  assert.equal(medioDeInstagram(''), null);
  assert.equal(medioDeInstagram('algo-nuevo'), null);
  assert.equal(medioDeInstagram(null), null);
});

test('las láminas: el más largo de los dos; una sola o más de 20 no son un dato creíble', () => {
  assert.equal(laminasDe(['a', 'b', 'c'], ['a', 'b']), 3);
  assert.equal(laminasDe(undefined, ['a', 'b', 'c', 'd']), 4);
  assert.equal(laminasDe(['a']), null);
  assert.equal(laminasDe([]), null);
  assert.equal(laminasDe(Array.from({ length: 21 }, () => 'x')), null);
  assert.equal(laminasDe('no es una lista'), null);
});

test('piezasDeApify guarda las láminas de un Sidecar y ninguna para una imagen', () => {
  const [carrusel, imagen] = piezasDeApify([
    { shortCode: 'AAA', type: 'Sidecar', url: 'https://www.instagram.com/p/AAA/', childPosts: [{}, {}, {}, {}, {}], images: ['1', '2'], likesCount: 900 },
    { shortCode: 'BBB', type: 'Image', url: 'https://www.instagram.com/p/BBB/', images: ['1', '2', '3'], likesCount: 100 },
  ]);
  assert.equal(carrusel.laminas, 5);
  assert.equal(imagen.laminas, null, 'una imagen no lleva láminas aunque el actor mande `images`');
});

test('se escribe un update por grupo, sólo de Instagram y sólo lo que se sabe', () => {
  const grupos = gruposDeMedio([
    { canal: 'instagram', ref: 'a', medio: 'carrusel', laminas: 7 },
    { canal: 'instagram', ref: 'b', medio: 'carrusel', laminas: 7 },
    { canal: 'instagram', ref: 'c', medio: 'carrusel', laminas: null },
    { canal: 'instagram', ref: 'd', medio: 'imagen', laminas: 5 },
    { canal: 'instagram', ref: 'e', medio: null },
    { canal: 'youtube', ref: 'f', medio: 'video' },
  ]);
  const por = (m: string, l: number | null) => grupos.find((g) => g.medio === m && g.laminas === l)?.refs;
  assert.deepEqual(por('carrusel', 7), ['a', 'b']);
  assert.deepEqual(por('carrusel', null), ['c']);
  assert.deepEqual(por('imagen', null), ['d'], 'una imagen no lleva láminas');
  assert.equal(grupos.length, 3, 'lo que no se sabe y lo que no es Instagram no se escribe');
});

test('«la columna no existe» se reconoce por su código y su nombre, nada más', () => {
  assert.equal(faltaLaColumnaDeMedio({ code: 'PGRST204', message: "Could not find the 'medio' column of 'spy_piezas' in the schema cache" }), true);
  assert.equal(faltaLaColumnaDeMedio({ code: '42703', message: 'column "laminas" of relation "spy_piezas" does not exist' }), true);
  assert.equal(faltaLaColumnaDeMedio({ code: '42703', message: 'column "otra" does not exist' }), false);
  assert.equal(faltaLaColumnaDeMedio({ code: '23514', message: 'violates check constraint spy_piezas_medio_check' }), false);
  assert.equal(faltaLaColumnaDeMedio(null), false);
});

test('el upsert de siempre NO lleva medio ni láminas: una columna sin aplicar no puede tirar la lectura entera', () => {
  const src = sinComentarios(leer('lib/spy.ts'));
  const ini = src.indexOf('const comun = (v: PiezaVista) => ({');
  assert.ok(ini > 0, 'no encontré `comun` en guardarVistas');
  const fin = src.indexOf('});', ini);
  const comun = src.slice(ini, fin);
  assert.ok(comun.length > 200 && comun.length < 4000, `el recorte de \`comun\` mide ${comun.length}: está mirando otra cosa`);
  assert.doesNotMatch(comun, /\bmedio\b|\blaminas\b/, '`medio` y `laminas` van aparte (guardarMedios), nunca en el upsert');
  assert.match(src, /if \(!err\) await guardarMedios\(competidorId, conFoto\);/, 'guardarVistas escribe el medio después de guardar bien');
});

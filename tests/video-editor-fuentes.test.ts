// =============================================================================
// Las bibliotecas no cargan todas sus fuentes al abrirse, y el selector las muestra
// =============================================================================
// Medido en producción el 15/10/2026 con Long Animation Frames: abrir Subtítulos ›
// Plantillas agregaba 5 hojas de Google Fonts y 38 caras de golpe (~2,6 s de bloqueo)
// y, con video y Whisper en memoria, colgó la pestaña. Ahora cada miniatura pide SÓLO
// las letras de su muestra al entrar en pantalla (fonts/muestras.ts), y la fuente
// entera llega al elegir. Y la lista del selector de fuentes salía VACÍA: sus máscaras
// apuntaban a /fonts/, que no existe (las imágenes viven en public/ve/fonts).
//
// Lo de la URL y la respuesta es puro; lo demás se fija leyendo el fuente. Que la
// pestaña ya no se cuelgue se mide en producción (docs/hallazgos-video-editor.md).
//
// Probado rompiéndolo (15/10/2026): el resultado de cada rotura está al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { familiaMuestra, letrasDe, urlDeCssMuestra, urlMuestra } from '../app/video-editor/_opencut/fonts/muestras';
import { FONT_CHUNK_PATH_PREFIX } from '../app/video-editor/_opencut/fonts/google-fonts';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1: la muestra pide SÓLO sus letras, sin repetir, y el peso sólo si no es el normal', () => {
  assert.equal(letrasDe('Tu voz'), 'Touvz');
  assert.equal(
    urlMuestra({ familia: 'Anton', peso: 400, texto: 'SUBTÍTULOS' }),
    `https://fonts.googleapis.com/css2?family=Anton&text=${encodeURIComponent('BLOSTUÍ')}`,
  );
  assert.equal(urlMuestra({ familia: 'Bebas Neue', peso: 700, texto: 'Aa' }), 'https://fonts.googleapis.com/css2?family=Bebas+Neue:wght@700&text=Aa');
  assert.equal(familiaMuestra('Anton', 400), 'Anton · muestra 400');
});

test('2: de la respuesta de Google sale el archivo de la cara (y de un HTML, nada)', () => {
  // Respuesta real de fonts.googleapis.com/css2?family=Anton&text=… (15/10/2026), recortada.
  const css = `@font-face {\n  font-family: 'Anton';\n  font-style: normal;\n  font-weight: 400;\n  src: url(https://fonts.gstatic.com/l/font?kit=1Ptgg87L&skey=3e16&v=v27) format('woff2');\n  unicode-range: U+53-54;\n}`;
  assert.equal(urlDeCssMuestra(css), 'https://fonts.gstatic.com/l/font?kit=1Ptgg87L&skey=3e16&v=v27');
  assert.equal(urlDeCssMuestra('<!doctype html><title>Iniciar sesión</title>'), null);
});

test('3: Subtítulos › Plantillas no carga las familias al abrirse: cada miniatura pide su muestra', () => {
  const f = sinComentarios(leer('app/video-editor/_opencut/subtitles/components/assets-view.tsx'));
  assert.ok(!f.includes('loadFonts('), 'la vista no carga fuentes enteras al montarse');
  assert.ok(f.includes('useFuenteMuestra({'), 'la miniatura pide su muestra');
  assert.ok(f.includes('fontFamily: cssFamilia(muestra)'), 'y la usa (no el nombre de la fuente entera)');
});

test('4: Texto › Efectos y Plantillas tampoco: la fuente entera sólo al agregar o con el mouse encima', () => {
  const f = sinComentarios(leer('app/video-editor/_opencut/text/components/biblioteca-estilos.tsx'));
  assert.ok(!f.includes('FUENTES_PLANTILLAS'), 'no se cargan todas las familias de las plantillas');
  assert.ok(!/useEffect\(/.test(f), 'ningún efecto al montar');
  assert.equal((f.match(/loadFonts\(\{ families: \[/g) ?? []).length, 2, 'sólo al agregar y al pasar el mouse');
  const m = sinComentarios(leer('app/video-editor/_opencut/text/components/miniatura-estilo.tsx'));
  assert.ok(m.includes('useFuenteMuestra({') && m.includes('fontFamily: cssFamilia(muestra)'));
});

test('5: la muestra se pide al ENTRAR EN PANTALLA, no al montar', () => {
  const f = sinComentarios(leer('app/video-editor/_opencut/fonts/muestras.ts'));
  assert.ok(f.includes('new IntersectionObserver('));
  // `cargarMuestra` se llama sólo adentro de `pedir`, que corre desde el observador (o sin él, en un navegador viejo).
  assert.equal((f.match(/cargarMuestra\(\{ familia, peso, texto \}\)/g) ?? []).length, 1);
  assert.ok(!/document\.head\.appendChild/.test(f), 'sin hojas de estilo: una FontFace con nombre propio');
});

test('6: el selector de fuentes usa las imágenes del atlas donde están (public/ve/fonts)', () => {
  const f = leer('app/video-editor/_opencut/components/ui/font-picker.tsx');
  assert.ok(!f.includes('url(/fonts/'), 'nada de /fonts/ (no existe: la lista salía vacía)');
  assert.ok(f.includes('${FONT_CHUNK_PATH_PREFIX}${entry.ch}.avif'));
  assert.ok(FONT_CHUNK_PATH_PREFIX.startsWith('/ve/fonts/'));
  assert.ok(existsSync(new URL(`../public${FONT_CHUNK_PATH_PREFIX}0.avif`, import.meta.url)), 'la imagen existe');
});

// Roturas (15/10/2026), base 6 de 6; cada una restaurada:
// · la miniatura de subtítulos usa la fuente entera → 5/1 (3)
// · sin la fuente entera al pasar el mouse por una tarjeta de texto → 5/1 (4)
// · la muestra se pide al montar (además del observador) → 5/1 (5)
// · letras sin ordenar → 5/1 (1) · siempre con peso → 5/1 (1)
// · no lee la url de la hoja → 5/1 (2) · el selector vuelve a /fonts/ → 5/1 (6)

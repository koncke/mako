// =============================================================================
// «Animaciones de subtítulos» (el karaoke de CapCut): qué palabra se resalta y cuándo
// =============================================================================
// Pedido de Martín (15/10/2026): «Resaltar palabras» en los subtítulos, como las
// «Animaciones de subtítulos» de CapCut («Palabra pronunciada» / «Frase pronunciada» y
// la «Opacidad» de lo no pronunciado). Lo que falla SIN error, y por eso se prueba acá:
//
//   1. LA PALABRA A CADA TIEMPO: antes de la primera, ninguna; en una pausa sigue la
//      última que se dijo (si se apagara, parpadearía); después de la última, la última.
//   2. LAS MULETILLAS no cuentan: están en los tiempos pero NO en el texto; contarlas
//      corre el resaltado una palabra.
//   3. EL ORIGEN DEL RECORTE: la mitad derecha de un «Dividir» de la línea de tiempo
//      corre su `trimStart`; sin sumarlo, resalta lo que se dijo al principio del todo.
//   4. TEXTO REESCRITO = SIN RESALTADO: tiempos de otro texto resaltarían cualquier cosa.
//   5. CUANTIZADO: el resultado sólo cambia cuando cambia la palabra (la textura del
//      texto se re-dibuja con cualquier cambio de lo medido).
//   6. LAS PLANTILLAS escriben SIEMPRE el resaltado: «Clásico» después de «Karaoke» lo
//      apaga. Y «Aplicar en todos los subtítulos» no copia los TIEMPOS del elegido.
//
// Correr: node --import tsx --test tests/video-editor-subtitulos-resaltado.test.ts
// Probado rompiéndolo: el resultado de cada rotura está al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  iniciosDePalabras, palabraDeCadaLetra, palabrasDeRenglon, primerasPalabras, resaltadoDe, tieneTiemposPorPalabra, vaResaltada,
} from '../app/video-editor/_opencut/text/resaltado';
import { codificarPalabras, PARAM_PALABRAS, type PalabraSubtitulo } from '../app/video-editor/_opencut/subtitles/palabras';
import {
  PARAM_NO_DICHAS_OPACIDAD, PARAM_RESALTAR, PARAM_RESALTAR_COLOR,
} from '../app/video-editor/_opencut/params/extra/subtitulos';
import { paramsDePlantilla, plantillaPorId, PLANTILLAS_SUBTITULO } from '../app/video-editor/_opencut/subtitles/estilos';
import { TEXTO } from '../app/video-editor/_opencut/params/extra/texto';

const palabra = (texto: string, inicio: number, fin: number, muletilla = false): PalabraSubtitulo =>
  muletilla ? { texto, inicio, fin, muletilla: true } : { texto, inicio, fin };

/** «hola mundo cruel» dicho de 10,2 a 11,5 s, en un subtítulo que arranca a los 10 s. */
const tres = () => [palabra('hola', 10.2, 10.6), palabra('mundo', 10.7, 11), palabra('cruel', 11.1, 11.5)];

const subtitulo = ({
  contenido = 'hola mundo\ncruel',
  palabras = tres(),
  origen = 10,
  modo = 'palabra',
  extra = {},
}: { contenido?: string; palabras?: PalabraSubtitulo[]; origen?: number; modo?: string; extra?: Record<string, unknown> } = {}) => ({
  content: contenido,
  [PARAM_RESALTAR]: modo,
  [PARAM_PALABRAS]: codificarPalabras({ palabras, origen, precision: 'palabra' }),
  ...extra,
});

/** [actual, dichas] a cada tiempo local (s). */
const enTiempos = (params: Record<string, unknown>, tiempos: number[], recorteInicio = 0) =>
  tiempos.map((tiempo) => {
    const r = resaltadoDe({ params, tiempo, recorteInicio });
    return r ? [r.actual, r.dichas] : null;
  });

test('1: la palabra que se dice a cada tiempo: antes de la primera, en una pausa y después de la última', () => {
  const params = subtitulo();
  // 0,1 antes de «hola» · 0,2 empieza «hola» · 0,65 pausa (sigue «hola») · 0,7 «mundo» ·
  // 1,05 pausa · 1,1 «cruel» · 1,8 después de la última (sigue «cruel»).
  assert.deepEqual(enTiempos(params, [0.1, 0.2, 0.65, 0.7, 1.05, 1.1, 1.8]), [
    [-1, 0], [0, 1], [0, 1], [1, 2], [1, 2], [2, 3], [2, 3],
  ]);
});

test('2: «Ninguno», sin tiempos o con tiempos que no se leen: null (sin resaltado)', () => {
  assert.equal(resaltadoDe({ params: subtitulo({ modo: 'ninguno' }), tiempo: 0.5, recorteInicio: 0 }), null);
  assert.equal(resaltadoDe({ params: { content: 'hola', [PARAM_RESALTAR]: 'palabra' }, tiempo: 0.5, recorteInicio: 0 }), null);
  assert.equal(resaltadoDe({ params: { content: 'hola', [PARAM_RESALTAR]: 'palabra', [PARAM_PALABRAS]: 'no es json' }, tiempo: 0, recorteInicio: 0 }), null);
  assert.equal(resaltadoDe({ params: { ...subtitulo(), [PARAM_RESALTAR]: 'otra cosa' }, tiempo: 0.5, recorteInicio: 0 }), null);
});

test('3: con una muletilla en el medio (guardada pero NO en el texto) no se corre una palabra', () => {
  const params = subtitulo({
    contenido: 'Hola mundo.',
    palabras: [palabra('Hola', 0, 0.3), palabra('eh,', 0.32, 0.38, true), palabra('mundo.', 0.4, 0.8)],
    origen: 0,
  });
  // 0,35: se está diciendo la muletilla → sigue «Hola»; 0,4: «mundo.» es la palabra 1 del texto.
  assert.deepEqual(enTiempos(params, [0.1, 0.35, 0.4, 0.9]), [[0, 1], [0, 1], [1, 2], [1, 2]]);
});

test('4: si el texto se reescribió, los tiempos ya no valen: null, no tiempos de otro texto', () => {
  assert.equal(resaltadoDe({ params: subtitulo({ contenido: 'otra cosa' }), tiempo: 0.5, recorteInicio: 0 }), null);
  // Una palabra de más tampoco.
  assert.equal(resaltadoDe({ params: subtitulo({ contenido: 'hola mundo cruel y más' }), tiempo: 0.5, recorteInicio: 0 }), null);
  assert.equal(tieneTiemposPorPalabra(subtitulo({ contenido: 'otra cosa' })), false);
  assert.equal(tieneTiemposPorPalabra(subtitulo()), true);
});

test('5: la mitad derecha de un «Dividir» (trimStart ≠ 0) resalta donde se dijo cada palabra', () => {
  // Corte en 10,65 (en la pausa después de «hola»): la mitad derecha empieza ahí y su
  // recorte corre lo mismo (SplitElementsCommand). El parámetro es el MISMO (origen 10).
  const params = subtitulo();
  const recorteInicio = 0.65;
  // local 0 (10,65): «hola» ya se dijo · local 0,05 (10,7): «mundo» · local 0,45 (11,1): «cruel».
  assert.deepEqual(enTiempos(params, [0, 0.05, 0.45], recorteInicio), [[0, 1], [1, 2], [2, 3]]);
});

test('6: color y opacidad: los por defecto, y la opacidad en 0–1 acotada', () => {
  const r = resaltadoDe({ params: subtitulo(), tiempo: 0.5, recorteInicio: 0 });
  assert.equal(r?.color, '#ffe14d');
  assert.equal(r?.noDichas, 1);
  const otro = resaltadoDe({
    params: subtitulo({ extra: { [PARAM_RESALTAR_COLOR]: '#00ff00', [PARAM_NO_DICHAS_OPACIDAD]: 35 } }),
    tiempo: 0.5,
    recorteInicio: 0,
  });
  assert.equal(otro?.color, '#00ff00');
  assert.equal(otro?.noDichas, 0.35);
  assert.equal(resaltadoDe({ params: subtitulo({ extra: { [PARAM_NO_DICHAS_OPACIDAD]: 150 } }), tiempo: 0, recorteInicio: 0 })?.noDichas, 1);
});

test('7: «Palabra pronunciada» pinta sólo la que se dice; «Frase pronunciada», todo lo dicho', () => {
  const palabraR = resaltadoDe({ params: subtitulo({ modo: 'palabra' }), tiempo: 0.8, recorteInicio: 0 })!;
  const fraseR = resaltadoDe({ params: subtitulo({ modo: 'frase' }), tiempo: 0.8, recorteInicio: 0 })!;
  assert.deepEqual([0, 1, 2].map((k) => vaResaltada(palabraR, k)), [false, true, false]);
  assert.deepEqual([0, 1, 2].map((k) => vaResaltada(fraseR, k)), [true, true, false]);
});

test('8: cuantizado: a 30 cuadros por segundo cambia sólo cuando cambia la palabra', () => {
  const params = subtitulo();
  const distintos = new Set<string>();
  let cambios = 0;
  let anterior = '';
  for (let f = 0; f <= 60; f++) {
    const s = JSON.stringify(resaltadoDe({ params, tiempo: f / 30, recorteInicio: 0 }));
    distintos.add(s);
    if (s !== anterior) cambios++;
    anterior = s;
  }
  // Antes de la primera + una por palabra; y cada estado aparece en un solo tramo.
  assert.equal(distintos.size, 4);
  assert.equal(cambios, 4);
});

test('9: el JSON de las palabras se lee una vez (se llama en cada cuadro)', () => {
  const params = subtitulo();
  const a = iniciosDePalabras(String(params.content), params[PARAM_PALABRAS]);
  const b = iniciosDePalabras(String(params.content), params[PARAM_PALABRAS]);
  assert.ok(a);
  assert.equal(a, b, 'la misma lista, no otra leída de nuevo');
  assert.deepEqual(a, [0.2, 0.7, 1.1]);
});

test('10: las palabras se cuentan en orden a lo largo de los renglones (rectos, a medio escribir y curvos)', () => {
  assert.deepEqual(primerasPalabras(['HOLA MUNDO', 'CRUEL', '']), [0, 2, 3]);
  assert.deepEqual(palabrasDeRenglon('HOLA  MUNDO', 0), [
    { texto: 'HOLA', desde: 0, palabra: 0 },
    { texto: 'MUNDO', desde: 6, palabra: 1 },
  ]);
  // A medio escribir: la palabra cortada sigue siendo la suya.
  assert.deepEqual(palabrasDeRenglon('CRUEL Y M', 2).map((p) => [p.texto, p.palabra]), [['CRUEL', 2], ['Y', 3], ['M', 4]]);
  // Curvado, letra por letra; los espacios no son de ninguna.
  assert.deepEqual(palabraDeCadaLetra(['C', 'R', ' ', ' ', 'Y', '!'], 2), [2, 2, -1, -1, 3, 3]);
});

test('11: las plantillas escriben SIEMPRE el resaltado (otra plantilla lo apaga)', () => {
  const lienzo = { width: 1080, height: 1920 };
  const karaoke = paramsDePlantilla(plantillaPorId('karaoke'), lienzo);
  assert.equal(karaoke[PARAM_RESALTAR], 'frase');
  assert.match(String(karaoke[PARAM_RESALTAR_COLOR]), /^#[0-9a-f]{6}$/i);
  for (const p of PLANTILLAS_SUBTITULO) {
    const params = paramsDePlantilla(p, lienzo);
    assert.ok(params[PARAM_RESALTAR], `${p.id} escribe el resaltado`);
    assert.ok(params[PARAM_NO_DICHAS_OPACIDAD] !== undefined, `${p.id} escribe la opacidad`);
    assert.ok(params[TEXTO.mayusculas], `${p.id} escribe May./min.`);
  }
  const clasico = paramsDePlantilla(plantillaPorId('clasico'), lienzo);
  assert.equal(clasico[PARAM_RESALTAR], 'ninguno');
  assert.equal(clasico[PARAM_NO_DICHAS_OPACIDAD], 100);
  assert.equal(clasico[TEXTO.mayusculas], 'ninguno');
  // Con resaltado hay al menos dos (karaoke y palabra resaltada).
  assert.ok(PLANTILLAS_SUBTITULO.filter((p) => p.resaltado).length >= 2);
});

// Lo que no se puede importar en node (la medida, el dibujo y el panel cargan el wasm del
// motor): se fija leyendo el fuente.
const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('12: la medida suma el recorte, y sin resaltado el dibujo va por el camino de siempre', () => {
  const medida = sinComentarios(leer('app/video-editor/_opencut/text/measure-element.ts'));
  assert.match(medida, /resaltado: resaltadoDe\(\{\s*params: element\.params,\s*tiempo: localTime \/ TICKS_PER_SECOND,\s*recorteInicio: element\.trimStart \/ TICKS_PER_SECOND/);
  const dibujo = sinComentarios(leer('app/video-editor/_opencut/text/dibujar.ts'));
  assert.match(dibujo, /if \(res\) dibujarResaltado\(ctx, [^)]*\);\s*else dibujarLetras\(ctx, medido, lineas, textColor, textBaseline, false\);/);
  assert.match(dibujo, /if \(res\) dibujarResaltado\(c, [^)]*\);\s*else dibujarLetras\(c, medido, lineas, textColor, textBaseline, true\);/);
  // Sin resaltado, el relleno y el trazo recorren los renglones enteros, como antes.
  assert.match(dibujo, /else recorrer\(c, medido, lineas, \(t, x, y\) => c\.strokeText\(t, x, y\)\);/);
  assert.match(dibujo, /else \{\s*recorrer\(c, medido, lineas, \(t, x, y\) => c\.fillText\(t, x, y\)\);/);
});

test('13: «Aplicar en todos los subtítulos» no copia los tiempos por palabra del elegido', () => {
  const insert = sinComentarios(leer('app/video-editor/_opencut/subtitles/insert.ts'));
  assert.match(insert, /const NO_ESTILO = new Set\(\[[^\]]*PARAM_PALABRAS[^\]]*\]\)/);
});

test('14: los subtítulos en mayúsculas se parten midiendo en mayúsculas', () => {
  const armado = sinComentarios(leer('app/video-editor/_opencut/subtitles/build-subtitle-text-element.ts'));
  assert.match(armado, /ancho: \(s\) => ctx\.measureText\(aplicarMayusculas\(s, mayusculas\)\)\.width/);
  const repartir = sinComentarios(leer('app/video-editor/_opencut/subtitles/repartir.ts'));
  assert.match(repartir, /CLAVES_QUE_PARTEN = \[[^\]]*TEXTO\.mayusculas[^\]]*\]/);
});

// Roturas (15/10/2026), de a una y restauradas desde una copia en memoria (scratchpad
// romper-resaltado.mjs); base 14 / 0, y cada rotura -> pasan / fallan (cuál):
// · sin sumar el recorte (trimStart)                       -> 13 / 1 (5)
// · las muletillas cuentan como palabras                    -> 13 / 1 (3)
// · sin cotejar los tiempos contra el texto                 -> 13 / 1 (4)
// · antes de la primera ya se resalta la primera            -> 13 / 1 (1)
// · el tiempo crudo en el resultado (sin cuantizar)         -> 13 / 1 (8)
// · sin cache del JSON                                      -> 13 / 1 (9)
// · «Palabra» y «Frase» al revés                            -> 13 / 1 (7)
// · la primera palabra de cada renglón corrida              -> 13 / 1 (10)
// · la plantilla escribe el resaltado sólo si lo usa        -> 13 / 1 (11)
// · la medida sin el recorte                                -> 13 / 1 (12)
// · sin resaltado, el dibujo va por las piezas              -> 13 / 1 (12)
// · «Aplicar en todos» copia los tiempos del elegido        -> 13 / 1 (13)
// · partir los renglones midiendo en minúsculas             -> 13 / 1 (14)
// Restaurado: 14 / 0. Lo que NO cubre: cómo se VE (la posición de cada palabra con
// interletrado, el grupo con opacidad, la curva). Eso se mira en el navegador.

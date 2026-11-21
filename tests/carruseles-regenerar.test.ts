// Cada lámina se REGENERA con IA desde su referencia (21/11/2026). Martín, 20/11: «no salieron idénticos y tenían que salir
// realmente idénticos… eso lo tienes que hacer con inteligencia artificial, le tienes que pasar la referencia y pedirle a la IA que
// cambie al personaje o a los textos». Medido el 21/11 con Nano Banana Pro por ApiMart: la portada de «9 YOUTUBE COURSES» salió con
// el mismo Hormozi y «9 AGENTES DE IA», tildes incluidas, en 37 s.
//
// Esto fija (lib/carruseles/regenerar.ts):
//   1. el prompt de texto conserva TODO lo demás y pide cada «original» por su «nuevo», letra por letra; un texto que se saca lo dice;
//      uno igual a su original no se pide;
//   2. el segundo intento va con la lista de los textos en orden (sin originales: la IA principal a veces escribe el nuevo en «original»);
//   3. el prompt de la persona: la misma pose y acción, su cara y su ropa de la segunda imagen, el texto igual;
//   4. la revisión: un texto que falta o está mal escrito (una tilde también) se detecta; mayúsculas y signos no cuentan;
//   5. lo que devuelve la lectura se entiende (y lo que no, es vacío);
//   6. el documento: una página por lámina con su imagen de fondo y el origen en las notas de la primera;
//   7. el aviso de lo que no quedó bien escrito nombra la lámina y el texto; sin errores, no hay aviso;
//   8. «no pude leer» no es «bien escrita»: sin pares se escribe igual y la lámina sin leer se avisa (Hormozi 5 y 6, 21/11).
//
// Correr: node --import tsx --test tests/carruseles-regenerar.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PROMPT_DE_PERSONA, avisoDeLaminasSinLeer, avisoDeTextoQueFalta, cambiosReales, escribirSinPares, documentoRegenerado, leidoDe, promptDeTextos, textoQueFalta, textosEsperados } from '../lib/carruseles/regenerar';

const CAMBIOS = [
  { antes: '9 YOUTUBE', despues: '9 AGENTES' },
  { antes: 'COURSES', despues: 'DE IA' },
  { antes: 'WILL TEACH YOU MORE THAN 4 YEAR DEGREE FOR FREE', despues: 'QUE TE ENSEÑAN MÁS QUE 4 AÑOS DE FACULTAD' },
  { antes: '01 of 11', despues: '01 of 11' },
  { antes: '@awakpenn', despues: '' },
];

test('1 · el prompt de texto conserva todo y cambia cada texto por el suyo', () => {
  const p = promptDeTextos(CAMBIOS);
  assert.match(p, /^Keep this exact image/);
  assert.match(p, /«9 YOUTUBE» becomes «9 AGENTES»/);
  assert.match(p, /«WILL TEACH YOU MORE THAN 4 YEAR DEGREE FOR FREE» becomes «QUE TE ENSEÑAN MÁS QUE 4 AÑOS DE FACULTAD»/);
  assert.match(p, /Remove the text «@awakpenn»/);
  assert.doesNotMatch(p, /01 of 11/, 'lo que no cambia no se pide');
  assert.deepEqual(cambiosReales(CAMBIOS).map((c) => c.antes), ['9 YOUTUBE', 'COURSES', 'WILL TEACH YOU MORE THAN 4 YEAR DEGREE FOR FREE', '@awakpenn']);
});

test('2 · el segundo intento va con los textos en orden, sin los originales', () => {
  const p = promptDeTextos(CAMBIOS, { enOrden: textosEsperados(CAMBIOS) });
  assert.match(p, /From top to bottom, the text must read exactly, letter by letter: «9 AGENTES», «DE IA», «QUE TE ENSEÑAN MÁS QUE 4 AÑOS DE FACULTAD», «01 of 11»/);
  assert.doesNotMatch(p, /YOUTUBE/);
});

test('3 · el prompt de la persona: misma pose y acción, su cara y su ropa, el texto igual', () => {
  assert.match(PROMPT_DE_PERSONA, /same pose and action/);
  assert.match(PROMPT_DE_PERSONA, /face, hair and clothes are exactly as in the second image/);
  assert.match(PROMPT_DE_PERSONA, /Keep all the text/);
});

test('4 · la revisión detecta lo que falta o está mal escrito; mayúsculas y signos no cuentan, las tildes sí', () => {
  const esperados = textosEsperados(CAMBIOS);
  assert.deepEqual(textoQueFalta('01 of 11\n9 AGENTES\nDE IA\nQue te enseñan más que 4 años de facultad →', esperados), []);
  assert.deepEqual(textoQueFalta('9 AGENTES DE IA QUE TE ENSENAN MAS QUE 4 AÑOS DE FACULTAD 01 of 11', esperados), ['QUE TE ENSEÑAN MÁS QUE 4 AÑOS DE FACULTAD'], 'sin la ñ y la tilde no está bien escrito');
  assert.deepEqual(textoQueFalta('9 AGENTS\nDE IA\nQUE TE ENSEÑAN MÁS QUE 4 AÑOS DE FACULTAD 01 of 11', esperados), ['9 AGENTES']);
  // El renglón cortado donde quiso la IA no es un error.
  assert.deepEqual(textoQueFalta('QUE TE ENSEÑAN MÁS\nQUE 4 AÑOS DE FACULTAD 9 AGENTES DE IA 01 of 11', esperados), []);
});

test('5 · lo que devuelve la lectura', () => {
  assert.equal(leidoDe('```json\n{"lineas":["9 AGENTES","DE IA"]}\n```'), '9 AGENTES\nDE IA');
  assert.equal(leidoDe('no sé'), '');
  assert.equal(leidoDe('{"lineas": "x"}'), '');
});

test('6 · el documento: una página por lámina, su imagen de fondo y el origen en las notas de la primera', () => {
  let n = 0;
  const doc = documentoRegenerado({ srcs: ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg'], ancho: 1080, alto: 1350, notas: 'Diseño tomado de un ejemplo de @awakpenn (link).', nuevoId: () => `p${++n}` });
  const pages = doc.pages as Array<{ name: string; background: { type: string; src: string; fit: string }; objects: unknown[]; notes?: string }>;
  assert.deepEqual(pages.map((p) => p.name), ['Portada', 'Lámina 2', 'Cierre']);
  assert.deepEqual(pages[1].background, { type: 'image', src: 'https://x/2.jpg', fit: 'cover' });
  assert.match(pages[0].notes ?? '', /@awakpenn/);
  assert.equal(pages[1].notes, undefined);
  assert.deepEqual([doc.width, doc.height], [1080, 1350]);
});

test('7 · el aviso de lo que no quedó bien escrito', () => {
  assert.equal(avisoDeTextoQueFalta([{ lamina: 1, faltan: [] }]), null);
  const a = avisoDeTextoQueFalta([{ lamina: 1, faltan: [] }, { lamina: 3, faltan: ['QUE TE ENSEÑAN MÁS'] }])!;
  assert.match(a, /lámina 3, «QUE TE ENSEÑAN MÁS»/);
  assert.match(a, /vuelve a generar esa lámina/);
});

test('8 · «no pude leer» no es «bien escrita»: sin pares se escribe igual, y la lámina sin leer se avisa', () => {
  // Hormozi 5 y 6 (21/11/2026): sin pares que cambiaran algo y sin lectura, la referencia salió tal cual, en inglés, sin aviso.
  assert.equal(escribirSinPares(null), true, 'sin poder leer la original, se salteaba');
  assert.equal(escribirSinPares(['El resultado']), true);
  assert.equal(escribirSinPares([]), false, 'leída y con todo escrito: no se gasta otra imagen');
  assert.equal(avisoDeLaminasSinLeer([]), null);
  assert.match(avisoDeLaminasSinLeer([5])!, /No pude leer la lámina 5 .*mírala antes de publicar/);
  assert.match(avisoDeLaminasSinLeer([5, 6])!, /las láminas 5 y 6 .*míralas/);
});

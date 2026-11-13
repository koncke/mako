// =============================================================================
// La palabra clave GIGANTE: el renglón le reserva ancho y alto (13/11/2026)
// =============================================================================
// «La palabra clave gigante» (lib/video-recetas.ts) pide la palabra fuerte 3 o 4 veces más grande. El editor topaba en 160 %:
// el subtítulo se partía en renglones midiendo la letra normal (la clave grande se salía del cuadro) y cada renglón iba a una
// altura fija (la clave, que crece desde su centro, tapaba al otro renglón). Ahora el partido suma la reserva de la clave
// (subtitles/partir.ts → `extra`) y el dibujo separa los renglones (text/resaltado.ts → centrosDeRenglones); el tope es 300 %.
//
// Correr: node --import tsx --test tests/video-editor-clave-gigante.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { partirEnLineas } from '../app/video-editor/_opencut/subtitles/partir';
import { centrosDeRenglones, escalaDeRenglones, UMBRAL_ALTO_CLAVE, type ResaltadoTexto } from '../app/video-editor/_opencut/text/resaltado';
import { TOPES_CLAVES_TAMANO } from '../app/video-editor/_opencut/params/extra/subtitulos';
import { recetaDe } from '../lib/video-recetas';
import { plantillaPorId } from '../app/video-editor/_opencut/subtitles/estilos';
import { catalogoParaPrompt, validarOperacion } from '../lib/editor-video/chat-catalogo';
import { operacionApiPorId, operacionDesdeInput } from '../lib/editor-video/chat-api';
import { despuesDe } from '../lib/editor-video/propuesta-bloque';
import { PARAM_CLAVES } from '../lib/editor-video/claves';
import { PARAM_CLAVES_TAMANO } from '../app/video-editor/_opencut/params/extra/subtitulos';
import { revisarOperaciones, vistaDeLinea, type OperacionResuelta } from '../app/video-editor/_opencut/chat/linea';
import { disponiblesDelMotor } from '../app/video-editor/_opencut/chat/disponibles';
import type { SceneTracks } from '../app/video-editor/_opencut/timeline/types';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** 10 px por letra (un espacio también). */
const ancho = (s: string) => s.length * 10;

test('G1: el renglón cuenta lo que ocupa la clave agrandada; sin claves, lo de siempre', () => {
  const texto = 'que te exige mucho';
  // Sin reserva entra en 180 px: un renglón.
  assert.equal(partirEnLineas({ ancho, texto, anchoPx: 180 }), 'que te exige mucho');
  // «exige» (la palabra 2) al 300 % suma 2 × 50 px: ya no entra todo en un renglón.
  const extra = (i: number, p: string) => (i === 2 ? 2 * ancho(p) : 0);
  const partido = partirEnLineas({ ancho, texto, anchoPx: 180, extra });
  assert.notEqual(partido, 'que te exige mucho');
  for (const renglon of partido.split('\n')) {
    const palabras = renglon.split(' ');
    const desde = texto.split(' ').indexOf(palabras[0]);
    const suma = palabras.reduce((n, p, k) => n + extra(desde + k, p), 0);
    assert.ok(ancho(renglon) + suma <= 180 || palabras.length === 1, `«${renglon}» se sale`);
  }
  // La cuenta de palabras sigue a través de los saltos que ya había (las claves se guardan contra el texto entero).
  const vistos: number[] = [];
  partirEnLineas({ ancho, texto: 'uno dos\ntres cuatro', anchoPx: 1000, extra: (i) => (vistos.push(i), 0) });
  assert.deepEqual([...new Set(vistos)].sort(), [0, 1, 2, 3]);
});

const resaltado = (claves: number[], clavesEscala: number) => ({ claves, clavesEscala }) as unknown as ResaltadoTexto;

test('G2: cada renglón sabe la clave más grande que tiene', () => {
  assert.deepEqual(escalaDeRenglones(resaltado([1], 3), ['te exige', 'mucho']), [3, 1]);
  assert.deepEqual(escalaDeRenglones(resaltado([2], 3), ['te exige', 'mucho']), [1, 3]);
  assert.deepEqual(escalaDeRenglones(resaltado([], 3), ['te exige']), [1]);
});

test('G3: con una clave gigante el renglón reserva su alto; hasta 160 %, todo como siempre', () => {
  assert.equal(UMBRAL_ALTO_CLAVE, 1.6);
  assert.equal(centrosDeRenglones([1, 1], 60, 50), null);
  assert.equal(centrosDeRenglones([1.6, 1], 60, 50), null, 'lo que ya estaba (Hormozi al 120 %) no se mueve');
  // 3× en el primero: mide 60 + 2 × 50 = 160; el segundo, 60. Alto 220, centrado.
  const c = centrosDeRenglones([3, 1], 60, 50)!;
  assert.equal(c.alto, 220);
  assert.deepEqual(c.ys, [-30, 80]);
  // Sin crecer (fontPx 0) la cuenta da lo de siempre, i × 60 − (n − 1) × 60 / 2: la misma fórmula, sin saltos.
  assert.deepEqual(centrosDeRenglones([1.61, 1], 60, 0)!.ys, [-30, 30]);
});

test('G4: el tope es 300 % en el editor, el chat y los presets; la receta y su estilo lo usan', () => {
  assert.equal(TOPES_CLAVES_TAMANO.max, 300);
  assert.ok(validarOperacion({ op: 'palabras_clave', modo: 'auto', tamano: 300 }).ok);
  assert.equal(validarOperacion({ op: 'palabras_clave', modo: 'auto', tamano: 301 }).ok, false);
  assert.equal(recetaDe('palabra-gigante')!.editor!.claves!.tamano, 300);
  assert.equal(plantillaPorId('palabra-gigante').clavesTamano, 300);
});

test('G5: el cableado: el partido mide con la reserva, la medida guarda los centros y el dibujo los usa', () => {
  const armado = sinComentarios(leer('app/video-editor/_opencut/subtitles/build-subtitle-text-element.ts'));
  assert.match(armado, /extra: \(indice: number, palabra: string\) => \(claves\.indices\.includes\(indice\) \? \(claves\.escala - 1\) \* medir\(palabra\) : 0\)/);
  const medida = sinComentarios(leer('app/video-editor/_opencut/text/measure-element.ts'));
  assert.match(medida, /centrosDeRenglones\(escalaDeRenglones\(resaltado, measuredLayout\.lines\), measuredLayout\.lineHeightPx, measuredLayout\.scaledFontSize\)/);
  assert.match(medida, /height: centros\.alto, visualCenterOffset: -\(centros\.ys\[0\] \?\? 0\)/, 'el recuadro y el fondo crecen con el bloque');
  assert.match(medida, /ysDeRenglon: centros\?\.ys \?\? null,/);
  assert.match(sinComentarios(leer('app/video-editor/_opencut/text/dibujar.ts')), /y: medido\.ysDeRenglon\?\.\[i\] \?\? i \* medido\.lineHeightPx - medido\.block\.visualCenterOffset,/);
});

// ── «Las palabras clave 3 veces más grandes» por el chat (13/11/2026, mirado en producción) ───────────────────────────
// MaKo contestó «Cambio las palabras clave al 300 %» y mandó `estilo_texto` con `tamano: 7` en 30 subtítulos: eso agranda el
// subtítulo ENTERO. `palabras_clave` no tenía cómo cambiar sólo el tamaño («auto» las vuelve a elegir, «sumar» pide
// palabras). Ahora «mantener» deja las que hay y cambia su tamaño o su color, y el catálogo lo dice en los dos lados.

const TPS = 120_000;
const tk = (s: number) => Math.round(s * TPS);
function escena(): SceneTracks {
  const el = (id: string, ini: number, params: Record<string, unknown>) =>
    ({ id, type: 'text', name: id, startTime: tk(ini), duration: tk(2), trimStart: 0, trimEnd: 0, params });
  return {
    overlay: [
      { id: 'ps', type: 'text', name: 'Subs', hidden: false, elements: [
        el('sub1', 0, { content: 'A ver, en una empresa', subtitulo: true, [PARAM_CLAVES]: 'empresa' }),
        el('sub2', 2, { content: 'y la regla era muy sencilla', subtitulo: true, [PARAM_CLAVES]: 'sencilla' }),
        el('sub3', 4, { content: 'nada más', subtitulo: true }),
      ] },
    ],
    main: { id: 'pm', type: 'video', name: 'Principal', muted: false, hidden: false, elements: [] },
    audio: [],
  } as unknown as SceneTracks;
}
const revisar = (operaciones: unknown[]) => revisarOperaciones({
  operaciones: operaciones as never,
  vista: vistaDeLinea({ tracks: escena(), tps: TPS, cabezal: 0, elegidos: [], disponibles: disponiblesDelMotor(), lienzo: { ancho: 1080, alto: 1920 } }),
  alcance: 'video',
});
type Params = Extract<OperacionResuelta, { op: 'params' }>;

test('G6: «mantener» cambia sólo el tamaño: las mismas claves, y sólo en los subtítulos que tienen', () => {
  const r = revisar([{ op: 'palabras_clave', modo: 'mantener', tamano: 300 }]);
  assert.deepEqual(r.descartes, []);
  const ps = r.resueltas as Params[];
  assert.deepEqual(
    ps.map((p) => [p.el.elementId, p.params[PARAM_CLAVES], p.params[PARAM_CLAVES_TAMANO]]),
    [['sub1', 'empresa', 300], ['sub2', 'sencilla', 300]],
    'las de ahora no se vuelven a elegir, y «nada más» (sin claves) no se toca',
  );
  assert.match(r.cambios[0].despues, /al 300 %/);
  // Al tamaño que ya tienen (el predeterminado, 100 %): no hay nada que cambiar, y se dice.
  const igual = revisar([{ op: 'palabras_clave', modo: 'mantener', tamano: 100 }]);
  assert.deepEqual(igual.resueltas, []);
  assert.deepEqual(igual.descartes, ['las palabras clave ya están así']);
});

test('G7: la forma: «mantener» pide tamaño o color y no lleva palabras; la API y la tarjeta lo conocen', () => {
  assert.deepEqual(validarOperacion({ op: 'palabras_clave', modo: 'mantener', tamano: 300 }), { ok: true, op: { op: 'palabras_clave', modo: 'mantener', tamano: 300 } });
  assert.equal(validarOperacion({ op: 'palabras_clave', modo: 'mantener' }).ok, false, 'sin tamaño ni color no cambia nada');
  assert.equal(validarOperacion({ op: 'palabras_clave', modo: 'mantener', tamano: 300, palabras: ['x'] }).ok, false);
  const api = operacionApiPorId('resaltar_claves_subtitulos')!;
  assert.deepEqual(operacionDesdeInput(api, { proyecto: 'p', modo: 'mantener', tamano: 300 }), { ok: true, op: { op: 'palabras_clave', modo: 'mantener', tamano: 300 } });
  assert.equal(despuesDe({ op: 'palabras_clave', modo: 'mantener', tamano: 300 }), 'Las mismas palabras clave, al 300 %');
});

test('G8: el catálogo de la IA: agrandar las claves es palabras_clave, nunca estilo_texto', () => {
  const c = catalogoParaPrompt();
  assert.match(c, /"mantener" deja las que hay y cambia sólo su "tamano" o "color"/);
  assert.match(c, /«3 veces más grandes» = 300\): agrandar las claves es esto, nunca estilo_texto/);
  assert.match(c, /El tamaño o el color de las PALABRAS CLAVE no va aquí: palabras_clave con "tamano"\/"color"/);
});

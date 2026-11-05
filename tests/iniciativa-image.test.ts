// =============================================================================
// MaKo toma la iniciativa en el Image Editor: el diseño en blanco (5/11/2026, T12 de docs/mako-iniciativa/plan.md)
// =============================================================================
// Martín (29/10/2026): «que MaKo te vaya guiando… dependiendo del template que se eligió, o de la situación de la persona». Lo
// que se fija:
//   1. la apertura (lib/aperturas/image.ts): con una página sin nada y la charla vacía pregunta un HECHO, «¿Dónde lo vas a
//      publicar?», por diseño (alcance `entidad`); con algo en la página, con charla o sin diseño, calla; cada lugar tiene su medida;
//   2. el montaje: cada respuesta pone el lienzo a esa medida con el MISMO resize del panel de tamaño (sin IA), y mientras habla
//      el saludo y las píldoras se esconden.
//
// Correr: node --import tsx --test tests/iniciativa-image.test.ts
// PROBADO ROMPIÉNDOLO (base 2/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACCIONES_IMAGE, ID_DONDE, MEDIDA_DE, aperturaImage } from '../lib/aperturas/image';
import { PREGUNTA_DE_ACCION, claveApertura, claveValida, problemasDeApertura } from '../lib/aperturas/reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la apertura: en blanco y sin charla pregunta un hecho, por diseño; si no, calla; cada lugar con su medida', () => {
  const h = { diseno: '3f9a1b2c-4d5e-4f60-8a7b-1c2d3e4f5a6b', enBlanco: true, charlaVacia: true };
  const a = aperturaImage(h, {})!;
  assert.equal(a.id, ID_DONDE);
  assert.equal(a.texto, '¿Dónde lo vas a publicar?');
  assert.doesNotMatch(a.texto, PREGUNTA_DE_ACCION);
  assert.deepEqual(problemasDeApertura(a, { primerPaso: true }), []);
  assert.equal(a.alcance, 'entidad');
  assert.ok(claveValida(claveApertura(a.id, a.entidad)), 'la clave con el diseño pasa la validación de la ruta');
  assert.deepEqual(a.botones.filter((b) => b.tipo === 'hacer').map((b) => (b.tipo === 'hacer' ? b.accion : '')), [...ACCIONES_IMAGE]);
  assert.deepEqual(MEDIDA_DE.historia, { ancho: 1080, alto: 1920 }, 'la historia, 9:16');
  for (const acc of ACCIONES_IMAGE) assert.ok(MEDIDA_DE[acc].ancho > 0 && MEDIDA_DE[acc].alto > 0, acc);
  assert.equal(aperturaImage({ ...h, enBlanco: false }, {}), null, 'con algo en la página');
  assert.equal(aperturaImage({ ...h, charlaVacia: false }, {}), null, 'con la charla empezada');
  assert.equal(aperturaImage({ ...h, diseno: null }, {}), null);
});

test('2. el montaje: el mismo resize del panel de tamaño, y el saludo y las píldoras se esconden mientras habla', () => {
  const panel = sinComentarios(leer('app/image-editor/mako/chat/PanelMakoIA.tsx'));
  assert.match(panel, /const enBlanco = useEditorState\(\(s\) => s\.doc\.pages\.length === 1 && s\.doc\.pages\[0\]\.objects\.length === 0\);/);
  assert.match(panel, /editor\.pages\.resize\(m\.ancho, m\.alto, 'keep'\)/, 'el resize del panel de tamaño, sin IA');
  assert.match(panel, /\{hilo\.mensajes\.length === 0 && !estadoApertura\.apertura && \(\n\s*<div className=\{styles\.saludo\}>/);
  assert.match(panel, /\{!hilo\.corriendo && !estadoApertura\.apertura && \(\n\s*<div className=\{styles\.sugerencias\}>/, 'las píldoras, sólo sin la apertura');
});

// PROBADO ROMPIÉNDOLO (5/11/2026, base 2/0):
//   · la apertura también con algo en la página                  → 1/1 (1)
//   · las píldoras siguen a la vista con la apertura              → 1/1 (2)

// =============================================================================
// La lámina fiel: los pasos de la IA de imagen y la capa de lettering (lib/carruseles/plancha.ts, 9/11/2026)
// =============================================================================
// Las reglas que estos tests ejecutan: UN cambio por pedido, lo que se conserva dicho primero y SIN lo que el paso cambia, dos
// ediciones como mucho, la persona sólo si el negocio eligió, y un lettering que guarda su texto aunque el editor guarde y abra.
//
// Correr: node --import tsx --test tests/carruseles-plancha.test.ts
//
// PROBADO ROMPIÉNDOLO (9/11/2026, base 5/0), cada rotura con su rojo:
//   · sacar el texto pidiendo conservar el texto        → 4/1 (2)
//   · cambiar la persona pidiendo conservar la persona   → 4/1 (2)
//   · la persona desde el original (no desde la plancha) → 4/1 (1)
//   · pedir «sin texto» a una lámina sin texto           → 4/1 (1)
//   · sin elegir, se saca la persona                     → 4/1 (1)
//   · una comilla del texto corta la frase del lettering → 4/1 (4)
//   · un texto (no una imagen) leído como lettering      → 4/1 (4)
//   · `lettering` fuera de EXTRA_PROPS del editor        → 4/1 (5)
// Lo que NO se puede romper con estos pasos: el techo de dos ediciones (sólo hay dos pasos que se suman), así que sacar el
// `slice` da verde: el techo vive igual, para el día que haya un tercer paso.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  TECHO_DE_EDICIONES, TOPE_TEXTO_LETTERING, letteringDe, objetoDeLettering, pasosDeLamina, pedidoDeLettering, porQueNoSirveElLettering,
  promptDeLettering, promptDePaso,
} from '../lib/carruseles/plancha';
import { PREAMBULO_CLON, TOPE_PROMPT_CON_REFERENCIA, porQueNoSirveElClon, promptDeClon } from '../lib/carruseles/clon-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');

test('1. los pasos: sin texto desde el original; la persona desde la plancha con UNA foto; nada que no cambie', () => {
  const todo = pasosDeLamina({ texto: true, persona: true }, 'cara');
  assert.deepEqual(todo.map((p) => [p.id, p.base, p.referencia]), [['sin-texto', 'original', null], ['persona', 'anterior', 'foto']]);
  assert.deepEqual(pasosDeLamina({ texto: true, persona: true }, 'look').map((p) => p.id), ['sin-texto', 'persona']);
  assert.deepEqual(pasosDeLamina({ texto: true, persona: true }, 'ninguno').map((p) => p.id), ['sin-texto', 'sin-persona']);
  assert.deepEqual(pasosDeLamina({ texto: false, persona: true }, 'cara').map((p) => [p.id, p.base]), [['persona', 'original']]);
  assert.deepEqual(pasosDeLamina({ texto: false, persona: false }, 'cara'), [], 'una lámina que no cambia no se le pide a la IA');
  assert.deepEqual(pasosDeLamina({ texto: true, persona: true }, null).map((p) => p.id), ['sin-texto'], 'sin elegir, la persona no se toca');
  assert.deepEqual(pasosDeLamina({ texto: true, persona: false }, 'cara').map((p) => p.id), ['sin-texto'], 'sin persona, la foto no se usa');
  for (const a of ['cara', 'look', 'ninguno', null] as const) assert.ok(pasosDeLamina({ texto: true, persona: true }, a).length <= TECHO_DE_EDICIONES);
});

test('2. cada prompt dice primero qué se conserva, SIN lo que cambia, y un solo cambio', () => {
  const sinTexto = promptDePaso('sin-texto');
  assert.ok(sinTexto.startsWith('This reference image is a carousel slide and it is the only source of truth.'));
  assert.doesNotMatch(sinTexto.split('ONE change only:')[0], /the text|the typography/, 'pedir conservar el texto y sacarlo es una orden que se contradice');
  assert.match(sinTexto.split('ONE change only:')[0], /the people/, 'sacar el texto conserva a las personas');
  const persona = promptDePaso('persona');
  assert.doesNotMatch(persona.split('ONE change only:')[0], /the people/);
  assert.match(persona.split('ONE change only:')[0], /the text/, 'cambiar la persona conserva el texto que haya');
  for (const p of [sinTexto, persona, promptDePaso('sin-persona')]) {
    assert.equal(p.split('ONE change only:').length, 2, 'un solo cambio por pedido');
    // El pedido (lo que va después del preámbulo) pasa la misma vara que un pedido de clonado de la persona.
    assert.equal(porQueNoSirveElClon(p.split('ONE change only:')[1], 1), null);
  }
});

test('3. el preámbulo medido el 7/11 no cambió: con la lista por defecto sale el mismo texto, palabra por palabra', () => {
  assert.equal(PREAMBULO_CLON, 'This reference image is a carousel slide and it is the only source of truth. Keep it exactly as it is. Do not redraw it, do not restyle it, do not change the layout. Keep the typography, the text, the colours, the framing, the background and the people unchanged. ONE change only:');
  assert.equal(promptDeClon('carrusel', 'Pon mi logo.'), `${PREAMBULO_CLON} Pon mi logo.`);
});

test('4. el lettering: guarda su texto, se regenera con una frase y su tope, y se lee de vuelta', () => {
  const o = objetoDeLettering('l1', { texto: 'Vende más', estilo: 'letras de nubes blancas' }, { x: 100, y: 200, ancho: 800, alto: 300 }, { url: 'https://x/l.png', ancho: 1600, alto: 400 });
  assert.equal(o.type, 'image');
  assert.equal(o.name, 'Lettering: Vende más');
  assert.equal((o.scaleX as number) * 1600, 800, 'cabe en su caja por el ancho');
  assert.equal(o.top, 200 + (300 - 400 * 0.5) / 2, 'centrado en el alto de su caja');
  assert.deepEqual(letteringDe(o), { texto: 'Vende más', estilo: 'letras de nubes blancas' });
  assert.equal(letteringDe({ type: 'image', src: 'x' }), null, 'una foto común no es un lettering');
  assert.equal(letteringDe({ type: 'textbox', lettering: { texto: 'x' } }), null);
  assert.match(pedidoDeLettering('Tu "mejor" mes'), /It now says "Tu ”mejor” mes"\./, 'una comilla del texto no corta la frase');
  assert.doesNotMatch(promptDeLettering('Hola').split('ONE change only:')[0], /the text/);
  assert.equal(porQueNoSirveElLettering('   '), 'Escribe qué tiene que decir.');
  assert.ok(porQueNoSirveElLettering('x'.repeat(TOPE_TEXTO_LETTERING + 1)));
  assert.equal(porQueNoSirveElLettering('x'.repeat(TOPE_TEXTO_LETTERING)), null, 'el más largo permitido pasa el tope del pedido');
  assert.ok(pedidoDeLettering('x'.repeat(TOPE_TEXTO_LETTERING)).length <= TOPE_PROMPT_CON_REFERENCIA);
});

test('5. el editor guarda `lettering` (está en EXTRA_PROPS): sin eso, el texto se pierde al primer guardado', () => {
  const src = readFileSync(join(RAIZ, 'app/image-editor/_doory/editor/engine/serialization.ts'), 'utf8').replace(/\r\n/g, '\n');
  const lista = /export const EXTRA_PROPS: readonly string\[\] = \[([\s\S]*?)\n\]/.exec(src)?.[1] ?? '';
  const props = [...lista.replace(/\/\*\*[\s\S]*?\*\//g, '').matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]);
  assert.ok(props.length > 10, `se leyeron ${props.length} props: el recorte de la lista se rompió`);
  assert.ok(props.includes('lettering'));
});

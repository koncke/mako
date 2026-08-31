// =============================================================================
// El prompt de video del formato le gana al que escribe el modelo
// =============================================================================
// Martín: «el prompt está mal... Cambialo por: Esta persona dice: "…", con
// micromovimientos naturales…». Es el gemelo de lo que ya pasó con las imágenes:
// un prompt que él validó a mano contra Flow reemplaza al que redacta un modelo.
//
// El del modelo describía la toma DESDE CERO y en inglés —«Close-up selfie angle
// filmed with a handheld smartphone inside a parked car…»—, o sea reinventando la
// escena que la imagen de referencia ya tiene resuelta: el auto, la luz, el
// encuadre y la cara. Un clip con referencia sólo necesita decir QUÉ HACE la
// persona.

import test from 'node:test';
import assert from 'node:assert/strict';
import { promptDeClip, comoSeDice, acentoDe, tienePromptVideoPropio } from '../lib/prompts-video';

const ACENTO = 'Spoken in Northern Mexican Spanish (Baja California, Sonora, Sinaloa).';
const clip = (voz: string, habla = true, prompt = `Lo que escribió el modelo.\n${ACENTO}`) =>
  ({ voz, habla, prompt });

test('el prompt del formato REEMPLAZA al del modelo, no lo acompaña', () => {
  const p = promptDeClip('selfie-movimiento', clip('Mira, el viernes.'));
  assert.match(p, /^Esta persona dice: "Mira, el viernes\.", con micromovimientos naturales/);
  assert.doesNotMatch(p, /Lo que escribió el modelo/, 'mezclar dos prompts da un clip que no obedece a ninguno');
});

test('y llega TEXTUAL como lo escribió Martín', () => {
  // El copy del dueño se usa tal cual: es lo que él probó contra Flow.
  const p = promptDeClip('selfie-movimiento', clip('X.'));
  assert.match(p, /moviendo la palanca de cambio que no sale en el plano/);
  assert.match(p, /pero no por mucho tiempo ya que está conduciendo\. Todo natural\./);
});

// ── El acento, que no se pierde ─────────────────────────────────────────────

test('el acento sobrevive al cambio de prompt', () => {
  // Equivocarlo no se nota al leer: se nota cuando alguien lo dice en voz alta.
  assert.match(promptDeClip('selfie-movimiento', clip('X.')), /Spoken in Northern Mexican Spanish/);
});

test('el acento sale del PLAN, no de un default', () => {
  const otro = promptDeClip('selfie-movimiento', clip('X.', true, 'algo.\nSpoken in Rioplatense Spanish.'));
  assert.match(otro, /Spoken in Rioplatense Spanish\./);
});

test('acentoDe se queda con la ÚLTIMA, que es la que se mandó', () => {
  assert.equal(acentoDe('Spoken in A.\ntexto\nSpoken in B.'), 'Spoken in B.');
  assert.equal(acentoDe('un prompt sin acento'), '');
});

test('sin acento en el plan no se inventa uno', () => {
  const p = promptDeClip('selfie-movimiento', clip('X.', true, 'un prompt viejo sin acento'));
  assert.doesNotMatch(p, /Spoken in/);
});

// ── Las marcas de lectura no se pronuncian ──────────────────────────────────

test('el énfasis del guion NO llega al modelo', () => {
  // Medido: 12 de 14 clips del historial traen `**…**` en la línea hablada. Antes
  // no llegaban por casualidad —el prompt lo redactaba el mismo modelo, que al
  // copiar la línea los dejaba afuera—. Interpolando verbatim, ese accidente
  // desaparece.
  const p = promptDeClip('selfie-movimiento', clip('apagando una **bronca que ya existía** desde el lunes.'));
  assert.doesNotMatch(p, /\*/, 'ningún asterisco puede llegar a Flow');
  assert.match(p, /apagando una bronca que ya existía desde el lunes\./);
});

test('comoSeDice saca las marcas y respeta el texto', () => {
  assert.equal(comoSeDice('una **frase** y otra'), 'una frase y otra');
  assert.equal(comoSeDice('con __guion bajo__ también'), 'con guion bajo también');
  assert.equal(comoSeDice('un `código` suelto'), 'un código suelto');
  // Un par sin cerrar no es énfasis: es un carácter que el modelo interpretaría.
  assert.equal(comoSeDice('a medio **abrir'), 'a medio abrir');
  // Las comillas tipográficas del guion SÍ se conservan: son parte de lo que se dice.
  assert.equal(comoSeDice('Miércoles: “todo va bien”.'), 'Miércoles: “todo va bien”.');
});

// ── Cuándo NO aplica ────────────────────────────────────────────────────────

test('un formato sin prompt probado se queda con el del modelo', () => {
  // Copiar el de Car Talks sería peor: habla de la palanca de cambios, y en una
  // oficina eso no es un detalle de más, es una instrucción falsa.
  assert.equal(promptDeClip('podcast', clip('X.')), `Lo que escribió el modelo.\n${ACENTO}`);
  assert.equal(tienePromptVideoPropio('podcast'), false);
  assert.equal(tienePromptVideoPropio('selfie-movimiento'), true);
});

test('en un clip de voz en OFF no se usa: «esta persona dice» sería falso', () => {
  const p = promptDeClip('selfie-movimiento', clip('la voz en off.', false));
  assert.doesNotMatch(p, /Esta persona dice/);
});

test('sin guion tampoco: no se manda un prompt con las comillas vacías', () => {
  assert.doesNotMatch(promptDeClip('selfie-movimiento', clip('   ')), /Esta persona dice/);
  assert.doesNotMatch(promptDeClip('selfie-movimiento', clip('****')), /Esta persona dice/);
});

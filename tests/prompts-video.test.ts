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
  ({ voz, habla, prompt, queSeVe: '' });

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

// ── Y las urls firmadas que vencen ──────────────────────────────────────────
// Las direcciones de Flow vienen firmadas con `Expires` y duran ~6 h. La tira de
// variantes las conserva para siempre —que es lo correcto: son las versiones que
// la persona puede querer recuperar— así que al día siguiente se dibujaban ROTAS.
// Y una imagen rota no se lee como «venció el enlace»: se lee como que la app
// perdió el archivo. No lo perdió: el `mediaId` no vence y filmar sigue andando.

import { urlDeFlowVencida } from '../lib/flow-imagen';

test('una url con Expires pasado está vencida', () => {
  const ayer = Math.floor(Date.now() / 1000) - 3600;
  assert.equal(urlDeFlowVencida(`https://flow-content.google/image/x?Expires=${ayer}`), true);
});

test('una vigente no', () => {
  const luego = Math.floor(Date.now() / 1000) + 3600;
  assert.equal(urlDeFlowVencida(`https://flow-content.google/image/x?Expires=${luego}`), false);
});

test('sin Expires se considera VIGENTE: no saber cuándo vence no es saber que venció', () => {
  assert.equal(urlDeFlowVencida('https://flow-content.google/image/x'), false);
  assert.equal(urlDeFlowVencida(''), false);
});

test('lee el Expires venga primero o en el medio de la query', () => {
  const ayer = Math.floor(Date.now() / 1000) - 10;
  assert.equal(urlDeFlowVencida(`https://x/y?KeyName=k&Expires=${ayer}&Signature=s`), true);
});

// ── Y el prompt de un formato que creó el CLIENTE ───────────────────────────
// Los formatos de fábrica guardan su prompt en `PROMPT_VIDEO`, una constante de
// código. Los del cliente viven en la base, por workspace, así que entran por
// parámetro — y ocupan el mismo lugar en la precedencia.

test('el prompt de un formato del cliente se usa, con la voz adentro', () => {
  const p = promptDeClip('ws1-mi-formato', clip('Mira esto.'), undefined,
    'La persona dice: "{{voz}}", de pie frente a una pizarra.');
  assert.match(p, /La persona dice: "Mira esto\.", de pie frente a una pizarra\./);
});

test('⚠️ sin el hueco {{voz}} NO se usa: un prompt sin la línea hace que el modelo la invente', () => {
  // No produce un clip mudo — produce uno donde el modelo decide qué decir, o
  // sea un video plausible que dice otra cosa. Peor que no tener plantilla.
  const p = promptDeClip('ws1-mi-formato', clip('Mira esto.'), undefined,
    'La persona de pie frente a una pizarra.');
  assert.doesNotMatch(p, /pizarra/);
  assert.match(p, /Lo que escribió el modelo/, 'cae al del modelo, que al menos trae el guion');
});

test('lo que la persona escribió A MANO le gana también al formato del cliente', () => {
  // Misma precedencia que con los de fábrica: quien abrió el prompt y lo cambió
  // sabe algo de ESA toma que ninguna plantilla puede saber.
  const p = promptDeClip('ws1-mi-formato', clip('X.'), 'lo mío, tal cual',
    'La persona dice: "{{voz}}".');
  assert.equal(p, 'lo mío, tal cual');
});

test('y un formato de FÁBRICA no se deja pisar por una plantilla de cliente', () => {
  // Los ids no se pueden cruzar —el del cliente lleva prefijo `ws`— pero si
  // alguna vez llegaran juntos, manda el de fábrica: está medido contra un
  // anuncio entero.
  const p = promptDeClip('selfie-movimiento', clip('Hola.'), undefined,
    'ESTO NO TENDRIA QUE APARECER {{voz}}');
  assert.doesNotMatch(p, /NO TENDRIA QUE APARECER/);
  assert.match(p, /micromovimientos naturales/);
});

test('las marcas de lectura tampoco llegan al prompt del cliente', () => {
  const p = promptDeClip('ws1-x', clip('una **cosa** importante'), undefined, 'Dice: "{{voz}}".');
  assert.doesNotMatch(p, /\*/);
  assert.match(p, /una cosa importante/);
});

// ── The Office: el formato que no tenía prompt ──────────────────────────────
// Era el único sin uno, y es el que más lo necesita: cuatro escenarios, ritmo
// mixto y acción física adentro de cada toma. Sin prompt propio caía al que
// escribió el modelo — genérico, en inglés, compitiendo con la imagen de
// referencia que ya tiene el lugar, la luz y la cara resueltos.

const oficina = (voz: string, habla: boolean, queSeVe: string) =>
  ({ voz, habla, queSeVe, prompt: `Lo que escribió el modelo.\n${ACENTO}` });

test('OFICINA: la ACCIÓN va adentro del prompt', () => {
  // Es la regla medida del formato, textual: «La acción se escribe en el prompt.
  // Si no se escribe, el modelo rellena repitiendo sílabas».
  const p = promptDeClip('plano-secuencia', oficina('El lunes empieza el incendio.', true, 'Camina por el open space.'));
  assert.match(p, /camina por el open space/);
  assert.match(p, /dice: "El lunes empieza el incendio\."/);
});

test('OFICINA: un clip de VOZ EN OFF recibe la instrucción de NO hablar', () => {
  // ⚠️ Es el caso que antes NO recibía ninguna dirección: `promptDeClip` se caía
  // al prompt del modelo apenas `habla` era false. Y son TRES de las ocho tomas
  // de este formato (ritmo H O H O H O H H). Un clip mudo sin instrucción de
  // estar mudo es un clip donde el avatar habla encima de la voz en off.
  const p = promptDeClip('plano-secuencia', oficina('Y ahí es donde se pierde el lunes.', false, 'Se sirve un café.'));
  assert.match(p, /NO habla/);
  assert.match(p, /sin mover los labios/);
  assert.match(p, /se sirve un café/);
  assert.doesNotMatch(p, /dice: "/, 'en off la persona NO lo está diciendo: afirmarlo es falso');
  assert.doesNotMatch(p, /Lo que escribió el modelo/);
});

test('OFICINA: sin `queSeVe` NO se inventa una acción', () => {
  // Escribir «se sirve un café» cuando el plan no lo dice es dirigir una toma que
  // nadie pidió, y eso se paga en créditos.
  const p = promptDeClip('plano-secuencia', oficina('X.', true, ''));
  assert.match(p, /se mueve por el espacio con naturalidad/);
  assert.doesNotMatch(p, /café|saluda|escritorio/);
});

test('OFICINA: NUNCA se describe la cara', () => {
  // La regla de oro: la identidad la resuelve la foto real. Un bloque de
  // contra-deriva la SOBREESCRIBE — se defendió seis versiones como corrección
  // medida y era justo lo que rompía el parecido.
  for (const habla of [true, false]) {
    const p = promptDeClip('plano-secuencia', oficina('X.', habla, 'Saluda a un colega.'));
    assert.doesNotMatch(p, /mentón|mandíbula|jaw|chin|nariz|ojos claros|rasgos/i);
  }
});

test('OFICINA: el acento sobrevive en las dos ramas', () => {
  for (const habla of [true, false]) {
    assert.match(promptDeClip('plano-secuencia', oficina('X.', habla, 'Camina.')), /Spoken in Northern Mexican Spanish/);
  }
});

test('⚠️ CAR TALKS no dirige un clip en off, y por eso el formato DECIDE', () => {
  // Su plantilla empieza con «Esta persona dice»: en un clip de voz en off es una
  // afirmación falsa. Devuelve `null` y gana el prompt del modelo — que dirá algo
  // genérico, pero no algo que no ocurre.
  const p = promptDeClip('selfie-movimiento', { voz: 'X.', habla: false, queSeVe: '', prompt: 'Lo del modelo.' });
  assert.equal(p, 'Lo del modelo.');
});

test('la acción se limpia para que encaje después de «mientras»', () => {
  // `queSeVe` llega como una oración suelta y con punto. Sin limpiarla quedaba
  // «mientras Camina por el open space.», que es lo que el modelo lee.
  const p = promptDeClip('plano-secuencia', oficina('X.', true, 'Camina por el open space.'));
  assert.match(p, /mientras camina por el open space\./);
  assert.doesNotMatch(p, /mientras Camina/);
});

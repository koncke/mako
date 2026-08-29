// =============================================================================
// El guion del cliente se REPARTE, no se reescribe
// =============================================================================
// El caso real, y es el que da nombre a todo esto: el dueño eligió su guion y el
// plan salió con otro texto. El cierre pasó de «En el video del enlace te
// explico cómo construir ese sistema» a «Toca el botón aquí abajo, deja tus
// datos en el formulario». Un CTA distinto manda a la gente a un paso del embudo
// que puede no existir.
//
// Estos tests son el contrato: si el reparto puede perder, agregar o cambiar una
// palabra, no sirve.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repartirGuion, contarPalabrasReparto } from '../lib/guion-reparto';

/** El guion 2 de Mauricio, tal cual lo cargó. */
const GUION = `El viernes vas a terminar resolviendo un problema que, probablemente, ya existía desde la junta del lunes.

Solo que todavía nadie lo podía ver.

El lunes preguntas:

"¿Llegamos el viernes?"

Todos dicen que sí.

Miércoles: "vamos bien".

Jueves: "solo falta un detalle".

Y el viernes estás tú hablando con el cliente para explicar por qué no llegaron.

Entonces piensas:

"Necesito alguien más duro que los haga cumplir."

Pero ahí está la trampa.

Porque puedes contratar al gerente más exigente del mundo… y seis meses después estar exactamente igual.

Lo que faltaba no era presión. Era una forma de saber desde el lunes quién podía incumplir el viernes.

Eso cambia por completo cómo se dirige una operación.

En el video del enlace te explico cómo construir ese sistema para detectar el incendio antes de que empiece.

Da click en el enlace.`;

/** Las palabras, normalizadas, para comparar sin que la puntuación moleste. */
const palabras = (t: string) => t.toLowerCase().split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));

// ── La garantía que da nombre al módulo ────────────────────────────────────

test('NO se pierde, agrega ni cambia una sola palabra', () => {
  const topes = [24, 24, 24, 24, 24, 24, 24];
  const tomas = repartirGuion(GUION, topes);
  assert.deepEqual(palabras(tomas.map((t) => t.voz).join(' ')), palabras(GUION));
});

test('EL CASO REAL: el CTA llega entero y en la última toma', () => {
  // Es lo que falló en producción. El cierre del cliente manda al video del
  // enlace; el plan lo cambió por un formulario que no existe en su embudo.
  const tomas = repartirGuion(GUION, [24, 24, 24, 24, 24, 24, 24]);
  const ultima = tomas[tomas.length - 1].voz;
  assert.match(ultima, /Da click en el enlace\.$/);
  assert.ok(
    tomas.some((t) => /En el video del enlace te explico/.test(t.voz)),
    'se perdió la frase que dice a dónde manda el anuncio',
  );
  assert.ok(
    !tomas.some((t) => /formulario|deja tus datos|botón aquí abajo/i.test(t.voz)),
    'apareció un CTA que el cliente no escribió',
  );
});

test('el orden del guion se respeta', () => {
  const tomas = repartirGuion(GUION, [24, 24, 24, 24, 24, 24, 24]);
  const junto = tomas.map((t) => t.voz).join(' ');
  const iInicio = junto.indexOf('El viernes vas a terminar');
  const iTrampa = junto.indexOf('Pero ahí está la trampa');
  const iCierre = junto.indexOf('Da click en el enlace');
  assert.ok(iInicio === 0, 'el guion no arranca por el principio');
  assert.ok(iInicio < iTrampa && iTrampa < iCierre, 'las partes salieron desordenadas');
});

// ── El reparto ─────────────────────────────────────────────────────────────

test('devuelve exactamente una toma por tope', () => {
  for (const n of [4, 6, 7, 8, 12]) {
    const tomas = repartirGuion(GUION, Array(n).fill(24));
    assert.equal(tomas.length, n, `pedí ${n} tomas`);
  }
});

test('ninguna toma queda vacía mientras haya texto', () => {
  const tomas = repartirGuion(GUION, Array(8).fill(24));
  for (const [i, t] of tomas.entries()) {
    assert.ok(t.voz.trim().length > 0, `la toma ${i + 1} salió vacía`);
  }
});

test('reparte parejo: no llena las primeras y vacía las últimas', () => {
  // Un anuncio que se queda sin texto al final es el sintoma de un reparto
  // codicioso. Ninguna toma puede tener menos de un tercio de la más cargada.
  const tomas = repartirGuion(GUION, Array(7).fill(24));
  const max = Math.max(...tomas.map((t) => t.palabras));
  const min = Math.min(...tomas.map((t) => t.palabras));
  assert.ok(min >= max / 3, `reparto disparejo: entre ${min} y ${max} palabras`);
});

test('respeta el tope de palabras cuando el guion entra', () => {
  // 140 palabras en 8 tomas de 24 = 192 de capacidad: entra holgado.
  const tomas = repartirGuion(GUION, Array(8).fill(24));
  for (const [i, t] of tomas.entries()) {
    assert.ok(t.palabras <= 24, `la toma ${i + 1} tiene ${t.palabras} palabras y el tope es 24`);
  }
});

test('cuando el guion NO entra, se pasa en vez de recortar', () => {
  // Recortar seria tirar el final del guion —el CTA— en silencio. La pantalla ya
  // avisa antes de llegar acá cuando el guion desborda.
  const tomas = repartirGuion(GUION, [10, 10, 10]);
  assert.deepEqual(palabras(tomas.map((t) => t.voz).join(' ')), palabras(GUION));
  assert.match(tomas[2].voz, /Da click en el enlace\.$/);
});

// ── Los bordes ─────────────────────────────────────────────────────────────

test('una oración más larga que el tope se parte por sus comas, no por la mitad', () => {
  const largo = 'Porque puedes contratar al gerente más exigente del mundo, que llegue temprano, que revise todo, y seis meses después estar exactamente igual.';
  const tomas = repartirGuion(largo, [10, 10, 10]);
  assert.deepEqual(palabras(tomas.map((t) => t.voz).join(' ')), palabras(largo));
  // Cada trozo tiene que terminar en un corte natural, no en mitad de una idea.
  assert.ok(tomas[0].voz.endsWith(',') || /[.…:;]$/.test(tomas[0].voz), `cortó mal: «${tomas[0].voz}»`);
});

test('un guion vacío devuelve tomas vacías, no revienta', () => {
  const tomas = repartirGuion('', [24, 24]);
  assert.equal(tomas.length, 2);
  assert.deepEqual(tomas.map((t) => t.voz), ['', '']);
});

test('sin tomas devuelve lista vacía', () => {
  assert.deepEqual(repartirGuion(GUION, []), []);
});

test('un guion de una sola frase corta entra en la primera toma', () => {
  const tomas = repartirGuion('Da click en el enlace.', [24, 24, 24]);
  assert.equal(tomas[0].voz, 'Da click en el enlace.');
  assert.deepEqual(palabras(tomas.map((t) => t.voz).join(' ')), palabras('Da click en el enlace.'));
});

test('contarPalabrasReparto ignora la puntuación suelta', () => {
  assert.equal(contarPalabrasReparto('Hola , mundo — ¿sí?'), 3);
  assert.equal(contarPalabrasReparto('   '), 0);
});

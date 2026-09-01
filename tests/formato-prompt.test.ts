// =============================================================================
// El molde del prompt de un formato, y la guarda que lo cuida
// =============================================================================
// El creador de formatos NO le pide el prompt entero a un modelo. Ya se probó y
// por eso existen `PROMPT_IMAGEN` y `PROMPT_VIDEO`: el prompt que escribía el
// modelo reinventaba la escena desde cero, describía la cara —que es la regla
// que más caro se paga romper— y perdía el tratamiento fotográfico.
//
// El molde acota lo que el modelo puede arruinar a los tres bloques que de
// verdad son del formato. Estos tests fijan lo que el molde garantiza.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  promptImagenDeFormato, promptVideoDeFormato, porQueNoSirveElPrompt,
} from '../lib/formato-prompt';

const LUGAR = {
  escena: 'de pie en una cocina profesional, mientras revuelve una olla.',
  luz: 'La única luz viene de los tubos del techo y de la ventana de la izquierda.',
  fondo: 'Detrás se ven las hornallas encendidas y un pasaplatos, suavemente desenfocados.',
  objetos: 'Acero gastado, manchas de uso en el delantal, repasadores fuera de lugar.',
};

// ── Lo que el molde SIEMPRE pone ────────────────────────────────────────────

test('la identidad va PRIMERO y textual: es la que no se puede perder', () => {
  // Si el prompt describe la cara, el modelo prefiere el texto por sobre la foto
  // y devuelve a alguien que cumple la descripción sin ser la persona. No es un
  // parecido malo: es otra persona con la marca del cliente encima.
  const p = promptImagenDeFormato(LUGAR);
  assert.ok(p.startsWith('Mantén a la persona totalmente inalterada'));
});

test('y siempre trae exposición y enfoque, que son los que un modelo se olvida', () => {
  // Sin exposición el modelo mide para el fondo y deja la cara en sombra — y eso
  // no se lee como estilo, se lee como un video mal hecho.
  const p = promptImagenDeFormato(LUGAR);
  assert.match(p, /EXPOSICIÓN\./);
  assert.match(p, /mide la exposición basándose en su rostro/);
  assert.match(p, /ENFOQUE\./);
});

test('el lugar entra entero, en sus tres bloques', () => {
  const p = promptImagenDeFormato(LUGAR);
  assert.match(p, /cocina profesional/);
  assert.match(p, /tubos del techo/);
  assert.match(p, /hornallas/);
  assert.match(p, /delantal/);
});

// ── El prompt de video ──────────────────────────────────────────────────────

test('el prompt de video trae el hueco de la voz', () => {
  const v = promptVideoDeFormato('con micromovimientos naturales mientras cocina.');
  assert.match(v, /\{\{voz\}\}/);
  assert.match(v, /Todo natural\./);
});

// ── Y la guarda, que es la segunda capa ─────────────────────────────────────

test('un prompt de video SIN el hueco se rechaza', () => {
  // No produce un clip mudo: produce uno donde el modelo inventa qué decir. Un
  // video plausible que dice otra cosa no se detecta mirando por encima.
  const no = porQueNoSirveElPrompt(promptImagenDeFormato(LUGAR), 'La persona cocina.');
  assert.ok(no && /lo que la persona dice/i.test(no), no ?? 'lo aceptó');
});

test('⚠️ un prompt que describe la CARA se rechaza, y dice cuáles palabras', () => {
  const malo = promptImagenDeFormato({
    ...LUGAR,
    escena: 'de pie en una cocina, un hombre de barba y ojos claros, unos 40 años.',
  });
  const no = porQueNoSirveElPrompt(malo, promptVideoDeFormato('quieto.'));
  assert.ok(no, 'lo aceptó');
  assert.match(no!, /barba/);
  assert.match(no!, /años/);
});

test('⚠️ y lo que la guarda NO caza, escrito para que nadie la crea una prueba', () => {
  // «ojos», «rostro», «piel» y «alto» SALIERON de la lista a propósito: un prompt
  // de fotografía habla de la cara todo el tiempo —dónde cae la luz, qué está
  // enfocado— sin describirla. Medido contra el prompt real de Car Talks, la
  // lista larga dio 10 coincidencias y las 10 falsas.
  //
  // O sea que esto es una red para lo obvio, no una prueba. Lo que de verdad
  // protege es el bloque de identidad, que le pide al modelo no cambiar a la
  // persona — y eso no se puede verificar con una regex.
  const conOjos = promptImagenDeFormato({ ...LUGAR, luz: 'La luz deja los ojos en sombra.' });
  assert.equal(
    porQueNoSirveElPrompt(conOjos, promptVideoDeFormato('quieto.')), null,
    'si esto empieza a fallar, alguien volvió a meter «ojos» en la lista',
  );
});

test('pero la identidad FIJA no cuenta como describir la cara', () => {
  // El bloque de identidad nombra el rostro a propósito —para pedir que NO se
  // cambie—. Buscar las palabras en el prompt entero daría un falso positivo
  // siempre, y una guarda que rechaza todo se apaga a la semana.
  assert.equal(porQueNoSirveElPrompt(promptImagenDeFormato(LUGAR), promptVideoDeFormato('quieto.')), null);
});

test('⚠️ y caza las palabras terminadas en acento o en ñ', () => {
  // El `\b` de JavaScript es ASCII incluso con el flag `u`: en «años» no hay
  // borde entre la `ñ` y la `o`. Con `\b` este detector daría CERO coincidencias
  // sobre justo las palabras que importan, y pasaría verde.
  const conAnios = promptImagenDeFormato({ ...LUGAR, objetos: 'Un local de unos 40 años, gastado.' });
  const no = porQueNoSirveElPrompt(conAnios, promptVideoDeFormato('quieto.'));
  assert.ok(no && /años/.test(no), no ?? 'se le escapó «años»');
});

test('un prompt de imagen demasiado corto tampoco pasa', () => {
  const no = porQueNoSirveElPrompt('corto', promptVideoDeFormato('quieto.'));
  assert.ok(no && /corto/i.test(no), no ?? 'lo aceptó');
});

// ── EL CALIBRE: el prompt real tiene que pasar ──────────────────────────────

import { PROMPT_IMAGEN } from '../lib/prompts-imagen';

test('⚠️ el prompt REAL de Car Talks pasa la guarda', () => {
  // Es el calibre y no un test de más: la guarda salió de leer ESE prompt, así
  // que si lo rechazara estaría midiendo otra cosa. Y ya pasó una vez —marcaba
  // «rostro» y «cara» de sus propios bloques fijos— con la guarda dando por malo
  // justo lo único que sabemos que funciona.
  const real = PROMPT_IMAGEN['selfie-movimiento'];
  assert.ok(real, 'sin el prompt de fábrica este test no mide nada');
  const no = porQueNoSirveElPrompt(real, promptVideoDeFormato('quieto.'));
  assert.equal(no, null, `la guarda rechazó el prompt que la inspiró: ${no}`);
});

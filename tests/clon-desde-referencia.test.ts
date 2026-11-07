// =============================================================================
// Clonar desde una referencia: el texto largo COMPITE con la imagen (7/11/2026)
// =============================================================================
// Martín pidió poder clonar literalmente una pieza de la competencia —carrusel, anuncio o miniatura— pasándole la
// referencia a la IA de imagen. La lección que gobierna eso ya se pagó una vez en `lib/curso-avatar.ts:65`: «la
// descripción textual COMPITE con la imagen de referencia, y el modelo prefiere el texto». O sea que un prompt
// largo no da más detalle: tapa la referencia y el resultado se parece MENOS.
//
// Esto prueba la CONDUCTA de la regla, no su redacción: que un pedido largo se rechace, que uno corto pase, que
// sin referencia no se pueda clonar, y que el mensaje diga qué hacer. Si mañana alguien cambia los textos o el
// número del tope, sigue en verde mientras eso se cumpla.
//
// ⚠️ POR QUÉ EL VALIDADOR NO BUSCA PALABRAS, y es una lección de la guarda hermana (`porQueNoSirveElPrompt`): ahí
// se probó una lista de 25 palabras y, medida contra el único prompt real que existía, dio **10 coincidencias y
// las 10 falsas**. Está escrito ahí mismo que «una guarda que rechaza todo se apaga a la semana». Describir una
// imagen se puede hacer con cualquier palabra: lo único medible sin equivocarse es CUÁNTO texto hay.
//
// Correr: node --import tsx --test tests/clon-desde-referencia.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  promptDeClon, porQueNoSirveElClon, TOPE_PROMPT_CON_REFERENCIA, TOPE_REFERENCIAS, PISO_PROMPT,
  type QueSeClona,
} from '../lib/carruseles/clon-reglas';

const LOS_TRES: QueSeClona[] = ['carrusel', 'anuncio', 'thumbnail'];

test('los tres tipos se pueden clonar, y el prompt los nombra distinto', () => {
  const dichos = LOS_TRES.map((q) => promptDeClon(q, 'que diga «Agenda tu llamada»'));
  for (const d of dichos) {
    assert.match(d, /referencia/i, 'el prompt no nombra la imagen de referencia, que es lo que tiene que mandar');
    assert.match(d, /Agenda tu llamada/, 'se perdió lo que pidió el negocio');
  }
  assert.equal(new Set(dichos).size, 3, 'los tres tipos arman el mismo prompt: el modelo no sabe si es una miniatura o un carrusel');
});

test('un pedido LARGO se rechaza: es lo que tapa la referencia', () => {
  // Un pedido que describe lo que la imagen ya muestra. Es el error natural, y el que arruina el parecido.
  const largo = 'Quiero una imagen con fondo degradado azul y naranja, una persona sonriendo a la izquierda '
    + 'con camisa blanca, tipografía sans serif muy grande arriba, un recuadro redondeado abajo a la derecha '
    + 'con el logo, sombras suaves, estilo editorial moderno, mucho contraste y colores saturados.';
  assert.ok(largo.length > TOPE_PROMPT_CON_REFERENCIA, 'el caso de prueba tiene que superar el tope');

  const motivo = porQueNoSirveElClon(largo, 1);
  assert.ok(motivo, 'un pedido largo con una referencia enfrente tiene que rechazarse');
  assert.match(motivo, /compite|se parece menos|DISTINTO/i, 'el mensaje no explica POR QUÉ el texto largo arruina el parecido');
});

test('un pedido CORTO pasa, que es el caso normal', () => {
  for (const q of LOS_TRES) {
    assert.equal(porQueNoSirveElClon(promptDeClon(q, 'con mi logo y mi paleta'), 1), null, `«${q}» rechazó un pedido corto`);
  }
});

test('sin referencia no es clonar, y se dice', () => {
  const motivo = porQueNoSirveElClon('con mi logo', 0);
  assert.ok(motivo, 'sin ninguna referencia tendría que rechazarse');
  assert.match(motivo, /referencia/i, 'no nombra lo que falta');
});

test('el pedido vacío se rechaza: sin él el modelo improvisa', () => {
  assert.ok(porQueNoSirveElClon('', 1), 'un pedido vacío tendría que rechazarse');
  assert.ok(porQueNoSirveElClon('x'.repeat(PISO_PROMPT - 1), 1), 'un pedido por debajo del piso tendría que rechazarse');
  assert.equal(porQueNoSirveElClon('x'.repeat(PISO_PROMPT + 1), 1), null, 'justo arriba del piso tiene que pasar');
});

test('más referencias que el tope se rechaza: el modelo promedia estéticas', () => {
  assert.equal(porQueNoSirveElClon('con mi logo', TOPE_REFERENCIAS), null, 'en el tope exacto tiene que pasar');
  const motivo = porQueNoSirveElClon('con mi logo', TOPE_REFERENCIAS + 1);
  assert.ok(motivo, 'pasarse del tope tendría que rechazarse');
  assert.match(motivo, /promedia|tope/i, 'el mensaje no dice por qué');
});

test('el tope está atado a algo medido, no a un número redondo', () => {
  // Si alguien lo sube a ojo, que al menos quede claro que no era arbitrario: el valor sale del largo del único
  // prompt con referencia que ya funciona en producción (`promptVideoDeFormato`).
  assert.ok(TOPE_PROMPT_CON_REFERENCIA > PISO_PROMPT, 'el tope tiene que estar arriba del piso');
  assert.ok(TOPE_PROMPT_CON_REFERENCIA <= 500, 'un tope así de alto deja de proteger: con 500 caracteres el texto ya le gana a la referencia');
});

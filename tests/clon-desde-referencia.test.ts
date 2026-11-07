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
  PREAMBULO_CLON, MODELO_QUE_CONSERVA, USD_POR_LAMINA_CLONADA,
  type QueSeClona,
} from '../lib/carruseles/clon-reglas';

const LOS_TRES: QueSeClona[] = ['carrusel', 'anuncio', 'thumbnail'];

test('los tres tipos se pueden clonar, y el prompt los nombra distinto', () => {
  const dichos = LOS_TRES.map((q) => promptDeClon(q, 'que diga «Agenda tu llamada»'));
  for (const d of dichos) {
    // El preámbulo va EN INGLÉS porque así se midió el 7/11 (ver `PREAMBULO_CLON`): se acepta cualquiera de
    // las dos formas, lo que importa es que el prompt apunte a la referencia y no describa un estilo.
    assert.match(d, /referen(cia|ce)/i, 'el prompt no nombra la imagen de referencia, que es lo que tiene que mandar');
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
    assert.equal(porQueNoSirveElClon('con mi logo y mi paleta', 1), null, `«${q}» rechazó un pedido corto`);
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

// =============================================================================
// Clonar es CONSERVAR, no «hacer algo parecido» (7/11/2026)
// =============================================================================
// Martín, viendo la primera réplica: «La idea era replicar las imágenes… de un lado se ve al protagonista de
// Breaking Bad y por el otro al influencer, que ese deberíamos reemplazarlo, sólo a ese, por Mauricio… ni
// siquiera la tipografía es igual, ni cómo se acomoda la letra, está muy mal».
//
// Tenía razón. El prompt decía «con el mismo estilo visual que la imagen de referencia», y eso **le pide al
// modelo que reinterprete**: le describís un estilo en vez de pedirle que conserve una imagen.
//
// Medido el 7/11 con la MISMA referencia y el MISMO pedido:
//   · diciendo primero qué NO se toca  → conservó tipografía, encabezado, encuadre, fondo y la otra persona;
//     cambió sólo la cara pedida. US$0,012.
//   · dejando al modelo libre           → redibujó todo y ROMPIÓ el texto del encabezado:
//     «CREATIVE STRATEGIST» salió «GREATINE STRATEOIST» y «©2026» salió «©2023».

test('el prompt dice qué NO se toca ANTES de qué cambia', () => {
  // El orden importa: lo primero que lee el modelo decide si conserva o reinterpreta.
  const p = promptDeClon('carrusel', 'Cambia la persona de la derecha por la foto adjunta.');
  const dondeConserva = p.indexOf('Keep it exactly as it is');
  const dondeCambia = p.indexOf('ONE change only');
  assert.ok(dondeConserva >= 0, 'desapareció la orden de conservar la imagen');
  assert.ok(dondeCambia > dondeConserva, 'el cambio quedó ANTES de lo que hay que conservar');
  assert.ok(p.endsWith('la foto adjunta.'), 'el pedido de la persona tiene que ir al final, no al medio');
});

test('el prompt NO le pide «el mismo estilo visual»: eso es lo que lo hacía redibujar', () => {
  // ⚠️ Es la frase exacta que produjo la réplica que Martín rechazó. Pedir un ESTILO es pedir una
  // interpretación; pedir que conserve una imagen es otra cosa.
  const p = promptDeClon('carrusel', 'Pon mi logo.');
  for (const frase of ['mismo estilo', 'same style', 'similar', 'inspired by', 'in the style of']) {
    assert.ok(!p.toLowerCase().includes(frase), `el prompt volvió a pedir «${frase}»: eso invita a reinterpretar`);
  }
});

test('el prompt nombra lo que más se rompe: la tipografía y el texto', () => {
  // Lo que delató el fallo no fue la cara: fue el encabezado con el texto corrompido. Si el prompt no los
  // nombra, el modelo los considera decorado.
  const p = promptDeClon('anuncio', 'Cambia el titular.');
  for (const que of ['typography', 'text', 'layout', 'framing']) {
    assert.ok(p.toLowerCase().includes(que), `el prompt no pide conservar «${que}»`);
  }
});

test('el modelo por defecto es el que CONSERVA, no el que hace mejores caras', () => {
  // ⚠️ La diferencia entre los dos medidos no es calidad: es obediencia. El otro hace mejores caras y peores
  // copias — y en una copia, un encabezado con el texto roto es inusable, mientras que una cara un 10 % menos
  // parecida no lo es.
  assert.equal(MODELO_QUE_CONSERVA, 'gemini-nano-banana-2.1-ext');
  assert.ok(!/seedream/i.test(MODELO_QUE_CONSERVA),
    'el default pasó al modelo que redibuja: rompe el texto del encabezado');
});

test('el costo de una lámina clonada está medido y es de centavos', () => {
  // Si alguien lo cambia por un número grande, el clonado deja de ser algo que se puede ofrecer sin pensarlo.
  assert.ok(USD_POR_LAMINA_CLONADA > 0, 'un costo en cero deja pasar generaciones que sí se pagan');
  assert.ok(USD_POR_LAMINA_CLONADA < 0.05, `US$${USD_POR_LAMINA_CLONADA} por lámina ya no es «un centavo»: volver a medirlo`);
});

test('el pedido de la persona sigue acotado, pero el preámbulo NO cuenta', () => {
  // ⚠️ Yo creía que el largo era el enemigo. No lo es: lo que compite con la referencia es DESCRIBIR EL ESTILO
  // con palabras. Enumerar lo que hay que dejar quieto ancla en vez de competir — el prompt que funcionó tenía
  // ~470 caracteres y el que falló, menos. Por eso el tope acota el pedido de la persona y no el prompt entero.
  // ⚠️ Lo supuse y estaba mal: el preámbulo son 211 caracteres y el tope son 240, así que NO es «más largo que
  // el tope». La afirmación que vale es otra, y es la que importa: el prompt COMPLETO pasa holgadamente el tope
  // y aun así el pedido se acepta, porque el tope acota el pedido de la persona y no lo que arma el sistema.
  const completo = promptDeClon('carrusel', 'Cambia la persona de la derecha.');
  assert.ok(completo.length > TOPE_PROMPT_CON_REFERENCIA,
    'el prompt completo entra en el tope del pedido: entonces el tope se está aplicando al lugar equivocado');
  assert.equal(porQueNoSirveElClon('x'.repeat(TOPE_PROMPT_CON_REFERENCIA + 1), 1) === null, false,
    'un pedido por encima del tope tendría que seguir rechazándose');
  assert.equal(porQueNoSirveElClon('Cambia la persona de la derecha.', 1), null);
});

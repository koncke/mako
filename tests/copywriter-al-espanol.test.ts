// =============================================================================
// Las palabras sueltas en INGLÉS se pasan solas al español (13/11/2026, el Cerebro con el guion real del anuncio de Hormozi)
// =============================================================================
// El chat de landings vio en un guion replicado del 13/11: «Gastan en creativos, en segmentación, en more budget». El voseo ya lo
// pasa solo `alTuteo`; el inglés sólo se avisaba (la segunda pasada). Ahora `alEspanol` (lib/copywriter/al-espanol.ts) cambia cada
// palabra suelta por la suya en español, como `alTuteo`: sólo en frases que están en español, sin tocar marcas ni nombres propios
// (Reels, YouTube, «Meta Business Suite»), lo citado entre «…» ni lo que el negocio llama así (el nombre de su oferta).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { alEspanol } from '../lib/copywriter/al-espanol';
import { operacionesAlEspanol, palabrasEnIngles } from '../lib/copywriter/ia-reglas';

const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');

test('el caso real: «en more budget» queda «en más presupuesto», y la detección ya no lo encuentra', () => {
  const guion = 'Gastan en creativos, en segmentación, en more budget. Y el problema no es el anuncio.';
  const bien = alEspanol(guion);
  assert.equal(bien, 'Gastan en creativos, en segmentación, en más presupuesto. Y el problema no es el anuncio.');
  assert.deepEqual(palabrasEnIngles(bien), []);
});

test('palabras sueltas con su mayúscula; «Title y CTA» de una respuesta; la jerga del rubro queda', () => {
  assert.equal(alEspanol('Revisé el Title y CTA de la página.'), 'Revisé el Título y CTA de la página.');
  assert.equal(alEspanol('Free: tres tips para cerrar más ventas, step by step.'), 'Gratis: tres consejos para cerrar más ventas, paso a paso.');
  assert.equal(alEspanol('CLASE FREE HOY'), 'CLASE GRATIS HOY');
  // Lo que en un guion en español es jerga del rubro no se toca.
  assert.equal(alEspanol('Más leads para tu funnel con un buen CTA y un hook claro en el Reel.'), 'Más leads para tu funnel con un buen CTA y un gancho claro en el Reel.');
});

test('una palabra que también es español no se toca ni se marca: «si sales hoy», «has visto»', () => {
  assert.equal(alEspanol('Si sales hoy a vender, ya has visto que el precio no es el problema.'), 'Si sales hoy a vender, ya has visto que el precio no es el problema.');
  assert.deepEqual(palabrasEnIngles('Si sales hoy a vender, ya has visto que el precio no es el problema.'), []);
});

test('no toca marcas, nombres propios, lo citado, el nombre de la oferta ni una frase entera en inglés', () => {
  assert.equal(alEspanol('Entra a Meta Business Suite y mira tus Reels de YouTube.'), 'Entra a Meta Business Suite y mira tus Reels de YouTube.');
  assert.equal(alEspanol('El original dice «more budget, more results» y lo tomé como idea.'), 'El original dice «more budget, more results» y lo tomé como idea.');
  assert.equal(alEspanol('Súmate a Free Money Club hoy.', 'Free Money Club'), 'Súmate a Free Money Club hoy.');
  assert.equal(alEspanol('This is the best way to get more sales.'), 'This is the best way to get more sales.', 'una frase en inglés no se traduce palabra por palabra');
  assert.equal(alEspanol('Escríbeme a hola@free.com o entra a mako.com/free'), 'Escríbeme a hola@free.com o entra a mako.com/free');
  assert.equal(alEspanol('Sigue a @freebudget y usa #budget.'), 'Sigue a @freebudget y usa #budget.');
});

test('en el guion entero: los textos de cada operación, las listas y las tablas; y la respuesta', () => {
  const ops = operacionesAlEspanol([
    { op: 'titulo', texto: 'Más ventas con less budget' },
    { op: 'escribir_seccion', seccion: 'GANCHO', bloques: [{ tipo: 'parrafo', texto: 'Tres tips para tu business.' }, { tipo: 'lista', items: ['Un free workshop', 'Más results'] }, { tipo: 'tabla', filas: [['Lámina', 'Texto'], ['1', 'More budget']] }] },
  ] as never, 'Mi oferta');
  assert.deepEqual(ops, [
    { op: 'titulo', texto: 'Más ventas con menos presupuesto' },
    { op: 'escribir_seccion', seccion: 'GANCHO', bloques: [{ tipo: 'parrafo', texto: 'Tres consejos para tu negocio.' }, { tipo: 'lista', items: ['Un taller gratis', 'Más resultados'] }, { tipo: 'tabla', filas: [['Lámina', 'Texto'], ['1', 'Más presupuesto']] }] },
  ]);
  const ia = leer('lib/copywriter/ia.ts');
  assert.ok(ia.includes('s.ops = operacionesAlEspanol(s.ops, permitido);'), 'el guion, antes de medirlo');
  assert.ok(ia.includes('let respuesta = alEspanol(alTuteo('), 'y la respuesta de Editar');
});

test('la réplica del short de Hormozi (14/11/2026): «dashboard» al español, y un dígito colado entre letras se saca', () => {
  assert.equal(alEspanol('La herramienta sin lectura es solo un dashboard bonito.'), 'La herramienta sin lectura es solo un tablero bonito.');
  assert.equal(alEspanol('Creí que era un problema mío, de capac0idad. No era.'), 'Creí que era un problema mío, de capacidad. No era.');
  // Lo que sí lleva un número queda: siglas, versiones, un @ y un link.
  assert.equal(alEspanol('Vendes B2B, en MP3 o en web3, con 4K y 2x más.'), 'Vendes B2B, en MP3 o en web3, con 4K y 2x más.');
  assert.equal(alEspanol('Escríbele a @ana2coach o entra a mi2web.com hoy.'), 'Escríbele a @ana2coach o entra a mi2web.com hoy.');
  // Lo de antes de un «.com» es un dominio, no una palabra (lo encontró este test: «free.com» quedaba «gratis.com»).
  assert.equal(alEspanol('Entra a free.com o a budget.net hoy.'), 'Entra a free.com o a budget.net hoy.');
  assert.equal(alEspanol('Sube tu budget. Y listo.'), 'Sube tu presupuesto. Y listo.', 'el punto final no es un dominio');
});

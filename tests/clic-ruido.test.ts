// =============================================================================
// El sello del constructor no es un clic de la persona
// =============================================================================
// Medido el 05/10/2026 contra producción: 208 de los 441 clics del ws1 son el badge
// «Edit with Lovable» que la landing lleva pegado, y el PRIMER renglón del recorrido
// de un lead decía «Hizo clic en "Edit with" — lovable.dev/projects/…». O sea que lo
// primero que se leía de lo que hizo una persona era el cartelito del editor.
//
// Lo que este test cuida son las DOS direcciones, que es lo que hace peligroso a un
// filtro: que el ruido NO pase, y que el contenido del negocio SÍ pase. Un filtro
// demasiado goloso acá no deja un error — borra clics reales de la ficha, que es un
// dato que ya no se recupera por ningún lado.
//
// Correr: npx tsx --test tests/clic-ruido.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { esClicDelConstructor } from '../lib/clic-ruido';

/** ⚠️ Sin comentarios: el propio arreglo escribe la cadena perseguida al explicarse. */
const soloCodigo = (src: string): string =>
  src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('el badge del constructor NO entra — con el caso textual medido en producción', () => {
  // Copiado de un evento real del ws1, tal como lo guardó el snippet.
  assert.equal(
    esClicDelConstructor('https://lovable.dev/projects/lovp_1mx5k8xzt79tpvf8bq4dttbmpf?utm_source=lovable-badge — Edit with Lovable'),
    true,
  );
  assert.equal(esClicDelConstructor('Edit with Lovable'), true);
  assert.equal(esClicDelConstructor('Made in Webflow'), true);
  assert.equal(esClicDelConstructor('https://www.framer.com/projects/abc'), true);
});

test('⚠️ UN CLIC DEL NEGOCIO SÍ ENTRA, aunque el host se parezca', () => {
  // Esta es la mitad cara: si el filtro se pasa de goloso, borra de la ficha clics
  // que ocurrieron de verdad y no hay de dónde recuperarlos.
  assert.equal(esClicDelConstructor('https://negocioejemplo.com/precios — Ver planes'), false);
  assert.equal(esClicDelConstructor('Agendar una llamada'), false);
  assert.equal(esClicDelConstructor('https://calendly.com/ejemplo/30min — Reservar'), false);
  // Un sitio PUBLICADO con Wix no es el editor de Wix: el host solo no alcanza.
  assert.equal(esClicDelConstructor('https://ejemplo.wix.com/mi-sitio — Comprar'), false);
  // Y «framer.com» sin /projects es su web pública, no el sello de una landing.
  assert.equal(esClicDelConstructor('https://www.framer.com/pricing'), false);
});

test('un detalle vacío NO es ruido: es un clic que el snippet no supo nombrar', () => {
  // Esconderlo sería tirar un dato real. Si no se sabe qué apretó, igual apretó algo.
  for (const v of [null, undefined, '', '   ']) assert.equal(esClicDelConstructor(v), false);
});

test('y el lector lo LLAMA: sin el call site, la función es humo', () => {
  // Un guard de cableado, porque los tres de arriba pasan igual con la función
  // declarada y sin nadie que la use. Se recorta el bloque: un `readFileSync` del
  // archivo entero encuentra el nombre en el import y en tres comentarios.
  const src = soloCodigo(readFileSync('lib/leads.ts', 'utf8'));
  const i = src.indexOf('const esClick =');
  assert.ok(i > 0, 'no encontré el gate de tipos del lector de eventos');
  const bloque = src.slice(i, src.indexOf('out.push(', i));
  assert.ok(bloque.length < 3000, `el recorte quedó en ${bloque.length}: está mirando otra cosa`);
  assert.match(
    bloque,
    /if \(esClick && esClicDelConstructor\(e\.detalle\)\) continue;/,
    'sin esto, el badge del constructor vuelve a ser el primer renglón del recorrido',
  );
});

// Verificado ROMPIÉNDOLO, una rotura por vez y restaurando cada una:
//   · sacando el `if (esClick && esClicDelConstructor(...))` del lector → 1 fallo, 3 pases
//     (cae el guard de cableado, que es el único que mira ahí)
//   · aflojando /\bwix\.com\/(editor|website-builder)\b/ a /\bwix\.com\b/ → 1 fallo, 3 pases
//     (cae «un clic del negocio SÍ entra»: se llevaba puesto un sitio publicado)
//   · haciendo que un detalle vacío devuelva true                        → 1 fallo, 3 pases
// En verde: 4 pases, 0 fallos.

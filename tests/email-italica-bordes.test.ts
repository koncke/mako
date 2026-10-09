// =============================================================================
// La itálica del mail junto a los signos del español (lib/email-html.ts → marcasAHtml)
// =============================================================================
// Revisión de la segunda tanda del Chatbot (09/10/2026). El editor de email (EditorMensaje) y
// «Probar» (TextoMarcas) pintan `¡_Hola_!`, `«_esto_»` y `"_aquello_"` en itálica, porque sus
// renderers no exigen bordes. El envío pasa por `bodyToHtml` → `marcasAHtml`, que exigía un
// espacio o un paréntesis antes y un espacio o una puntuación ASCII después: al lead le llegaban
// los guiones bajos a la vista. Y la comilla recta llega ESCAPADA (`&quot;`), así que el borde se
// escribe así y no como `"` (un `"` crudo calzaría con los atributos que mete `linkify`).
//
// Se prueba con el camino ENTERO (`bodyToHtml`: escapar → linkify → marcas), que es lo que sale.
//
// PROBADO ROMPIÉNDOLO (09/10/2026): con la regex de antes (`(^|[\s(])_…_(?=$|[\s.,;:!?)])`)
// dio 4 fallos y 1 pase: caen los tres signos y el de `linkify` (que pide `&quot;<em>listo</em>`);
// el de snake_case / URL / itálica suelta queda verde con las dos regex, que es lo esperado.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bodyToHtml, marcasAHtml, escapeHtml } from '../lib/email-html';

test('¡_Hola_! sale en itálica, sin los guiones bajos', () => {
  const html = bodyToHtml('¡_Hola_! ¿Cómo estás?');
  assert.ok(html.includes('¡<em>Hola</em>!'), html);
  assert.ok(!html.includes('_Hola_'), 'quedaron los guiones bajos a la vista');
});

test('«_esto_» sale en itálica (comillas latinas)', () => {
  const html = bodyToHtml('Mira «_esto_» y “_esto otro_”.');
  assert.ok(html.includes('«<em>esto</em>»'), html);
  assert.ok(html.includes('“<em>esto otro</em>”'), html);
});

test('"_aquello_" sale en itálica: la comilla recta llega como &quot;', () => {
  const html = bodyToHtml('Dijo "_aquello_" y se fue.');
  assert.ok(html.includes('&quot;<em>aquello</em>&quot;'), html);
  assert.ok(!html.includes('_aquello_'), html);
});

test('lo de siempre no cambia: snake_case, una URL con guiones bajos y la itálica suelta', () => {
  assert.equal(marcasAHtml(escapeHtml('lead_nombre y otro_campo_x')), 'lead_nombre y otro_campo_x');
  const conUrl = bodyToHtml('Entra a https://x.com/_a_/b');
  assert.ok(!conUrl.includes('<em>'), conUrl);
  assert.equal(marcasAHtml('hola _mundo_.'), 'hola <em>mundo</em>.');
});

test('el borde &quot; no se mete en los atributos de linkify (que usan comillas crudas)', () => {
  const html = bodyToHtml('Visita https://mako.app/x y "_listo_"');
  // El <a> queda entero (sus comillas son crudas) y la itálica es la del texto.
  assert.match(html, /<a href="https:\/\/mako\.app\/x" style="[^"]*" target="_blank" rel="noopener">https:\/\/mako\.app\/x<\/a>/);
  assert.ok(html.includes('&quot;<em>listo</em>&quot;'), html);
});

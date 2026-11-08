// =============================================================================
// «No tiene voz» tiene que ser alcanzable, y un video mudo no se paga N veces (8/11/2026)
// =============================================================================
// Lo encontró la revisión de `punta/nada-por-detras`: «"No tiene voz: es sólo música o imagen"
// quedó inalcanzable para YouTube: el piso es siempre > 0, así que todo video mudo vuelve marcado
// `corto` y pagando cada modelo y cada cuenta».
//
// ⚠️ Y acá hay una SUTILEZA que me costó una corrida roja. El arreglo obvio —«si contesta
// (vacío), devolvé en el acto»— ESTÁ MAL, y el repo ya lo sabía: con piso, un solo «(vacío)» NO se
// cree, porque está medido que Gemini lo contesta de más, y preguntarle al otro modelo recupera el
// guion de verdad. Eso lo fija el caso M de tests/spy-guion-youtube.test.ts, que mi primera versión
// puso en rojo. Lo que estaba roto era el OTRO lado: cuando TODOS coinciden en «(vacío)», el guion
// volvía marcado `corto` igual, y el cliente leía «puede faltar parte» sobre un video donde no se
// dice nada.
//
// La regla que queda: **un solo «(vacío)» es una sospecha; todos de acuerdo es un hecho.**
//
// Correr: node --import tsx --test tests/guion-yt-sin-voz.test.ts
// ROTURAS (8/11/2026, una por vez y restaurada; base 3 / 0): sacar el retorno de acuerdo en vacío
// → 2 / 1; contar el vacío sin contar los de bajo el piso → 2 / 1; devolverlo con `corto: true`
// → 2 / 1.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// ⚠️ `lib/ai-cheap.ts` lleva `server-only`: importarlo desde un test de node tira «This module
// cannot be imported from a Client Component module». Por eso acá se LEE el fuente.
const src = readFileSync(join(process.cwd(), 'lib/ai-cheap.ts'), 'utf8');

test('todos de acuerdo en «(vacío)» devuelve sin voz, y NO marcado `corto`', () => {
  assert.match(src, /if \(bajoElPiso > 0 && vacios === bajoElPiso\) return \{ ok: true, texto: '',/,
    'sin esto, «No tiene voz: es sólo música o imagen» no se alcanza nunca con piso');
  const i = src.indexOf('if (bajoElPiso > 0 && vacios === bajoElPiso)');
  assert.ok(!/corto/.test(src.slice(i, i + 130)),
    'marcarlo `corto` le dice al cliente «puede faltar parte» sobre un video donde no se dice nada');
});

test('⚠️ pero UN solo «(vacío)» no alcanza: se cuenta contra los que vinieron bajo el piso', () => {
  // Si se contaran sólo los vacíos, un «(vacío)» más un guion corto de verdad daría «sin voz», y se
  // perdería texto que el cliente sí tenía. La comparación con `bajoElPiso` es lo que lo impide.
  assert.match(src, /bajoElPiso \+= 1;/, 'hay que contar TODAS las respuestas bajo el piso');
  assert.match(src, /if \(texto === '\(vacío\)'\) vacios \+= 1;/, 'y aparte las que fueron «(vacío)»');
  assert.ok(src.indexOf('bajoElPiso += 1;') < src.indexOf("if (texto === '(vacío)') vacios += 1;"),
    'las dos cuentas van juntas, en la misma rama');
});

test('⚠️ y el otro modelo se sigue probando: con piso, un «(vacío)» es sospecha, no hecho', () => {
  // Esto es lo que fija el caso M de tests/spy-guion-youtube.test.ts y lo que mi primer intento rompió.
  assert.ok(!/if \(texto === '\(vacío\)'\) return/.test(src),
    'un «(vacío)» NO puede cortar el bucle: el otro modelo lo recupera, y está medido');
  assert.match(src, /const limpio = texto === '\(vacío\)' \? '' : texto;/,
    '«(vacío)» sigue entrando por el camino del piso, como el resto');
});

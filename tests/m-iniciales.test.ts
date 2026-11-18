// Las iniciales del avatar de MaKo Mobile salen sólo de LETRAS (app/m/_ui/formato.ts, `inicialesM`).
// Medido el 12/10/2026 al verificar /m a 390 px: «Dev (local)» dibujaba «D(» en el avatar de Today y de More.
// Probado rompiéndolo: sin el `replace` de lo que no es letra, falla 1 (las dos con paréntesis) y pasan 2.
//
// 18/11/2026 (O14 de docs/pendientes-verificados-17-11.md): nunca media letra. `partes[0][0]`, `slice(0, 2)` y el `trim()[0]`
// del email tomaban la primera UNIDAD UTF-16: una letra fuera del plano básico (la «𝐀» en negrita de Instagram) o un email que
// empieza con un emoji dejaban un surrogate suelto, y la barra del teléfono (app/m/layout.tsx) se caía con #418 al hidratar.
// Probado rompiéndolo (base 4/0), de a una: de vuelta a `partes[0][0] + partes[...][0]` → 3 / 1; el email con `trim()[0]` → 3 / 1;
// la palabra sola con `slice(0, 2)` → 3 / 1 (las tres, «nunca media letra»).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inicialesM } from '../app/m/_ui/formato';

test('lo que no es letra no llega al avatar', () => {
  assert.equal(inicialesM('Dev (local)'), 'DL');
  assert.equal(inicialesM('Juan (ventas)'), 'JV');
});

test('primera y última palabra, con acentos', () => {
  assert.equal(inicialesM('Ana María Pérez'), 'AP');
  assert.equal(inicialesM('Sofía'), 'SO');
  assert.equal(inicialesM('Ñandú Ólafsson'), 'ÑÓ');
});

const SUELTO = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

test('nunca media letra: una letra fuera del plano básico y un email con emoji', () => {
  // La «𝐀» de negrita de Unicode es una letra (pasa el filtro) y ocupa DOS unidades UTF-16.
  assert.equal(inicialesM('𝐀𝐧𝐚 𝐁𝐞𝐥𝐥𝐨'), '𝐀𝐁');
  assert.equal(inicialesM('a𝐁c'), 'A𝐁', 'una sola palabra: sus dos primeras letras, enteras');
  assert.equal(inicialesM('', '😀ana@ejemplo.com'), 'A', 'el emoji del email se saltea');
  for (const [n, e] of [['𝐀𝐧𝐚 𝐁𝐞𝐥𝐥𝐨', null], ['a𝐁c', null], ['𝐙', null], ['', '😀ana@ejemplo.com'], ['🚀', '🔥x@ejemplo.com']] as const) {
    assert.doesNotMatch(inicialesM(n, e), SUELTO, `«${n}» / «${e}» dio media letra`);
  }
});

test('sin nombre, la inicial del email; sin nada, un punto', () => {
  assert.equal(inicialesM('', 'martin@hola-mako.com'), 'M');
  assert.equal(inicialesM(null), '·');
});

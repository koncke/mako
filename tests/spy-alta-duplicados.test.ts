// =============================================================================
// El alta no deja entrar dos veces a la misma persona
// =============================================================================
// Martín, 2/11/2026: «no veo la opción de eliminar o cosas así, porque ya tengo varias "sofia
// contreras"». Borrarlas era el síntoma; la causa es que el alta deduplicaba SÓLO por el nombre
// tal cual, y pegar su @ guarda «sofiacontreras» mientras que pegar su nombre guarda «Sofia
// Contreras». Para la base son dos; para cualquier persona es una.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dominioComparable, nombreComparable } from '../lib/spy-reglas';
import { queEs } from '../lib/spy-que-es';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));

test('las tres formas de escribir a la misma persona se comparan igual', () => {
  const sofia = nombreComparable('Sofia Contreras');
  assert.equal(nombreComparable('sofiacontreras'), sofia);
  assert.equal(nombreComparable('@Sofia.Contreras'), sofia);
  assert.equal(nombreComparable('SOFIA  CONTRERAS'), sofia);
  // Y las tildes, que es como se escribe de verdad el nombre.
  assert.equal(nombreComparable('Sofía Contreras'), sofia);
});

test('comparar NO es renombrar: dos personas distintas siguen siendo dos', () => {
  assert.notEqual(nombreComparable('Sofia Contreras'), nombreComparable('Sofia Contrera'));
  assert.notEqual(nombreComparable('Alex Hormozi'), nombreComparable('Leila Hormozi'));
  // Un nombre que al reducirlo queda vacío no puede hacer de comodín y tragarse a cualquiera.
  assert.equal(nombreComparable('—'), '');
  assert.equal(nombreComparable('   '), '');
});

test('la landing se compara por dominio, no por la URL entera', () => {
  const d = dominioComparable('https://www.acquisition.com/');
  assert.equal(dominioComparable('http://acquisition.com'), d);
  assert.equal(dominioComparable('acquisition.com/precios?x=1'), d);
  assert.equal(dominioComparable('https://ACQUISITION.com#top'), d);
  assert.notEqual(dominioComparable('https://otra.com'), d);
});

test('el @ y el link de Instagram se guardan en minúsculas, que es lo que permite deduplicar', () => {
  // `queEs` se mudó a lib/spy-que-es.ts el 3/11/2026 y ahora se EJECUTA. Si dejara de bajar a
  // minúsculas, «@Sofia» y «@sofia» serían dos personas.
  assert.deepEqual(queEs('@Sofia'), { campo: 'instagram', valor: 'sofia' });
  assert.deepEqual(queEs('https://www.instagram.com/Sofia/'), { campo: 'instagram', valor: 'sofia' });
});

test('el alta mira si ya está ANTES de insertar, y suma el canal que falte', () => {
  // Se mira el código: lo que se rompió no fue una cuenta, fue que el único criterio era el
  // nombre literal. Un `onConflict` por nombre no puede ver que son la misma persona.
  const src = readFileSync(join(RAIZ, 'lib/spy.ts'), 'utf8').replace(/\r\n/g, '\n');
  const alta = src.slice(src.indexOf('export async function agregarCompetidor'));
  // ⚠️ SE MIRA LA COMPARACIÓN, NO EL NOMBRE DE LA FUNCIÓN. La primera versión de este guard
  // buscaba `nombreComparable(` y pasaba en verde con la comparación cambiada a `x.nombre ===
  // nombre`, porque la función seguía existiendo una línea más arriba. Un guard que busca un
  // identificador encuentra la declaración, no el uso.
  assert.match(alta, /nombreComparable\(x\.nombre\)\s*===/, 'el alta volvió a comparar el nombre literal: vuelven los duplicados');
  assert.match(alta, /dominioComparable\(x\.landing_url\)\s*===/, 'el alta dejó de comparar landings por dominio');
  assert.ok(alta.indexOf('yaEsta') < alta.indexOf('.upsert('), 'la búsqueda del duplicado tiene que ir ANTES del insert');
  // ⚠️ Y el TOPE de competidores va DESPUÉS de esa búsqueda. Con la lista llena, pegar a alguien
  // que ya estaba contestaba «ya tienes 25 competidores» en vez de abrirlo — y volver a pegar al
  // mismo es exactamente lo que uno hace cuando la lista está llena de duplicados. El tope existe
  // para que no entren 25 personas DISTINTAS, no para frenar al que ya está adentro.
  assert.ok(alta.indexOf('yaEsta') < alta.indexOf('TOPES.competidores'),
    'el tope se mira antes de buscar el duplicado: con la lista llena no se puede ni abrir a uno que ya está');
  // Y que sume el canal que falta en vez de pisar el que ya estaba.
  assert.match(alta, /!yaEsta\.instagram/, 'el alta pisa el canal existente en vez de sumar el que falta');
});

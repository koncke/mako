// =============================================================================
// Las reuniones del EQUIPO en el Calendario (6/11/2026, la promesa a la agencia de Thiago)
// =============================================================================
// Un closer o un setter entra al Calendario SÓLO a «Llamadas», arrancando en las suyas (las que lleva como closer o como
// setter); el admin ve todo y filtra por persona. Lo que un closer NO ve —la agenda de Google del dueño, los cobros, los
// objetivos y las tareas del Plan— depende de una sola respuesta: `miradaDeRol` (lib/calendario-llamadas.ts), que usan la
// computadora, el teléfono y nadie más. Acá se EJECUTA la regla, y se mira que las dos pantallas la consulten.
//
// Probado rompiéndolo (6/11/2026), con la base en 7/0:
//   · `miradaDeRol` devolviendo la vista entera para cualquier rol → 5/2: «un closer o un setter: sólo Llamadas» y «a quién filtra al abrir».
//   · `esDeLaPersona` mirando sólo el closer → 6/1: «la del setter también es suya».
//   · sin el `|| mirada.soloLlamadas` en app/calendario/page.tsx → 6/1: «la computadora…».
//   · las acciones de la pantalla con `requireRolWs(['closer', 'setter'],` → 6/1: «escribir sigue siendo del admin».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PERSONA_SIN_ASIGNAR, PERSONA_TODAS, esDeLaPersona, llamadasDeLaPersona, miradaDeRol, personaDelFiltro, personasDeLlamadas,
  type LlamadaDeVenta,
} from '../lib/calendario-llamadas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n')
  .replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const llamada = (id: string, closer: string | null, setter: string | null = null): LlamadaDeVenta => ({
  id, leadId: Number(id.replace(/\D/g, '')) || 1, nombre: `Lead ${id}`, cual: 'R1', inicio: '2026-11-10T15:00:00.000Z', diaCompleto: false,
  closer, setter, asistio: null, cancelada: false,
});

const LISTA = [
  llamada('1', 'Ana Pérez', 'Beto Ruiz'),
  llamada('2', 'ana  pérez'),
  llamada('3', 'Carla Díaz', 'Ana Pérez'),
  llamada('4', null, 'Beto Ruiz'),
  llamada('5', null, null),
];

test('un closer o un setter: sólo «Llamadas», arrancando en las suyas; el admin, todo', () => {
  assert.deepEqual(miradaDeRol('admin', 'Dueña'), { soloLlamadas: false, personaPropia: null });
  assert.deepEqual(miradaDeRol('closer', ' Ana Pérez '), { soloLlamadas: true, personaPropia: 'Ana Pérez' });
  assert.deepEqual(miradaDeRol('setter', 'Beto Ruiz'), { soloLlamadas: true, personaPropia: 'Beto Ruiz' });
  assert.equal(miradaDeRol(null, 'X').soloLlamadas, true, 'un rol que no se pudo leer ve lo mínimo, nunca la vista del admin');
  assert.equal(miradaDeRol('cualquier-cosa', null).personaPropia, null);
});

test('la del setter también es suya, y el nombre se compara sin mayúsculas ni espacios de más', () => {
  assert.deepEqual(llamadasDeLaPersona(LISTA, 'Ana Pérez').map((l) => l.id), ['1', '2', '3'], 'closer en 1 y 2, setter en 3');
  assert.deepEqual(llamadasDeLaPersona(LISTA, 'beto ruiz').map((l) => l.id), ['1', '4']);
  assert.deepEqual(llamadasDeLaPersona(LISTA, PERSONA_SIN_ASIGNAR).map((l) => l.id), ['5']);
  assert.equal(llamadasDeLaPersona(LISTA, PERSONA_TODAS).length, 5);
  assert.equal(llamadasDeLaPersona(LISTA, '').length, 5, 'sin filtro, todas');
  assert.equal(llamadasDeLaPersona(LISTA, 'Nadie').length, 0);
  assert.equal(esDeLaPersona(llamada('9', null, null), ''), false, 'un nombre vacío no es «la persona sin nombre»');
});

test('a quién filtra al abrir: lo que pide la URL, si no la persona misma, y el admin a todo el equipo', () => {
  assert.equal(personaDelFiltro(undefined, miradaDeRol('closer', 'Ana Pérez')), 'Ana Pérez');
  assert.equal(personaDelFiltro('Carla Díaz', miradaDeRol('closer', 'Ana Pérez')), 'Carla Díaz', 'un closer ve lo mismo que en el CRM: puede mirar las del equipo');
  assert.equal(personaDelFiltro('  ', miradaDeRol('admin', 'X')), PERSONA_TODAS);
  assert.equal(personaDelFiltro('x'.repeat(500), miradaDeRol('admin', 'X')).length, 120, 'la URL no mete un texto sin tope');
  assert.equal(personaDelFiltro(undefined, miradaDeRol('setter', null)), PERSONA_TODAS, 'sin nombre en su cuenta, arranca en todas');
});

test('las personas del filtro: el equipo aunque no tenga llamadas, las de las llamadas, sin repetir, con su cuenta', () => {
  const p = personasDeLlamadas(LISTA, ['Diego Sol', 'Ana Pérez']);
  assert.deepEqual(p.map((x) => [x.nombre, x.llamadas]), [['Ana Pérez', 3], ['Beto Ruiz', 2], ['Carla Díaz', 1], ['Diego Sol', 0]]);
  assert.deepEqual(personasDeLlamadas([llamada('1', 'Ana', 'ana')]).map((x) => x.llamadas), [1], 'closer y setter la misma persona: una llamada, no dos');
});

test('la computadora: closers y setters entran, y si es su caso la página va directo a «Llamadas» sin el Plan', () => {
  const page = leer('app/calendario/page.tsx');
  assert.match(page, /await requireRolWs\(\['closer', 'setter'\], \{ nav: 'calendario' \}\);/);
  assert.match(page, /quienMiraElCalendario\(\)/);
  assert.match(page, /if \(sp\?\.vista === 'llamadas' \|\| mirada\.soloLlamadas\) \{/, 'un closer que pide ?vista=semana no ve la grilla');
  assert.match(page, /mirada\.soloLlamadas \? Promise\.resolve\(\[\] as ItemCalendario\[\]\) : leerTareasConFecha\(/, 'las tareas del Plan no se leen para un closer');
  assert.match(leer('app/calendario/layout.tsx'), /await requireRolWs\(\['closer', 'setter'\], \{ nav: 'calendario' \}\);/, 'la puerta del layout es la de la página');
});

test('el teléfono, con la misma regla', () => {
  const m = leer('app/m/calendario/page.tsx');
  assert.match(m, /quienMiraElCalendario\(\)/);
  assert.match(m, /if \(sp\.vista === 'llamadas' \|\| mirada\.soloLlamadas\) \{/);
  assert.match(m, /mirada\.soloLlamadas \? Promise\.resolve\(\[\] as ItemCalendario\[\]\) : leerTareasConFecha\(/);
});

test('escribir sigue siendo del admin: las acciones de la pantalla no se abrieron', () => {
  assert.match(leer('app/calendario/actions.ts'), /const guard = \(\) => requireRolWs\(\[\], \{ nav: 'calendario' \}\);/);
});

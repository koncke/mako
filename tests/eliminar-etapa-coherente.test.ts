// =============================================================================
// El menú de una columna sólo ofrece BORRAR lo que el server sabe borrar
// =============================================================================
// Leila, en vivo el 01/10/2026 (00:11:07), sobre la columna «Nutrición No Show R1»:
// «No se pudo. Esta etapa no es del pipeline, no se la puede eliminar solo». Martín lo
// reconoció ahí mismo: «creo que hay un error… tengo que ver ahí de qué depurar eso».
//
// La causa son DOS condiciones distintas para la misma pregunta:
//   · el menú      → `!esTerminal(c.key)`                       (app/crm/CrmBoard.tsx)
//   · el server    → `pipeline.some((st) => st.key === op.key)` (app/crm/actions.ts)
// Y las etapas de NUTRICIÓN no están en `pipeline`: las agrega `generateFunnel` en cada
// lectura. Medido el 04/10/2026 contra producción: **102 columnas en los 16 embudos**
// ofrecían «Eliminar etapa» y el server las rechazaba siempre.
//
// Acá se prueban las dos mitades, que es lo que hace que el arreglo no se deshaga:
//   · la DECISIÓN, con `generateFunnel` puro: qué columnas son borrables de verdad;
//   · el CABLEADO, leyendo el fuente: que el menú cuelgue de `colsBorrables` y no de
//     `esTerminal` — sin esto el arreglo es inerte y el test da verde igual.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_PIPELINE, generateFunnel, esTerminal, type Stage } from '../lib/pipeline';

const SRC = readFileSync('app/crm/CrmBoard.tsx', 'utf8').replace(/\r\n/g, '\n');

/** Lo que el server ACEPTA borrar, derivado de las tres guardas de `editarEtapaAction`. */
function borrablesSegunServer(pipeline: Stage[]): Set<string> {
  if (pipeline.length <= 1) return new Set();
  return new Set(
    pipeline.filter((st) => !esTerminal(st.key) && st.kind !== 'entrada').map((st) => st.key),
  );
}

/** Lo que el menú OFRECÍA antes del arreglo: toda columna no terminal. */
const ofreciaAntes = (stages: Stage[]) => new Set(stages.filter((s) => !esTerminal(s.key)).map((s) => s.key));

/** Lo que el menú ofrece AHORA: la regla de `colsBorrables`. */
const ofreceAhora = (stages: Stage[]) => new Set(
  stages.filter((s) => (s.band ?? 'pipeline') === 'pipeline' && !esTerminal(s.key) && s.kind !== 'entrada').map((s) => s.key),
);

test('la regla nueva ofrece EXACTAMENTE lo que el server acepta', () => {
  const { stages } = generateFunnel(DEFAULT_PIPELINE, []);
  assert.deepEqual([...ofreceAhora(stages)].sort(), [...borrablesSegunServer(DEFAULT_PIPELINE)].sort());
});

test('EL CASO DE LEILA: la regla VIEJA ofrecía etapas que el server rechaza', () => {
  // Si esto diera 0, el test no estaría midiendo nada: significaría que el funnel de
  // prueba no tiene etapas generadas, que es justo la mitad que produjo el bug.
  const { stages } = generateFunnel(DEFAULT_PIPELINE, []);
  const acepta = borrablesSegunServer(DEFAULT_PIPELINE);
  const fantasma = [...ofreciaAntes(stages)].filter((k) => !acepta.has(k));
  assert.ok(
    fantasma.length >= 3,
    `la regla vieja tenía que ofrecer varias que el server rechaza; ofrecía ${fantasma.length}`,
  );
  // Y las que sobraban son de DOS clases, no una — esto lo corrigió el propio test, y la
  // medición de producción se había quedado corta: contó sólo las 102 de nutrición
  // (comparando contra `pipeline`) y no las ENTRADAS, que sí están en `pipeline` y el
  // server rechaza igual. O sea una más por embudo: 16 de regalo.
  const bandaDe = new Map(stages.map((s) => [s.key, s.band ?? 'pipeline']));
  const kindDe = new Map(stages.map((s) => [s.key, s.kind]));
  const inesperada = fantasma.filter((k) => bandaDe.get(k) !== 'nutricion' && kindDe.get(k) !== 'entrada');
  assert.equal(
    inesperada.length, 0,
    `sobraba algo que no es ni nutrición ni la entrada: ${inesperada.map((k) => `${k}=${bandaDe.get(k)}/${kindDe.get(k)}`).join(', ')}`,
  );
  assert.ok(fantasma.some((k) => kindDe.get(k) === 'entrada'), 'la entrada tenía que estar entre las que sobraban');
  // Y la regla nueva no ofrece ninguna de ésas.
  const ahora = ofreceAhora(stages);
  assert.ok(fantasma.every((k) => !ahora.has(k)), 'la regla nueva todavía ofrece una fantasma');
});

test('la ENTRADA no se ofrece: el server también la rechaza', () => {
  const { stages } = generateFunnel(DEFAULT_PIPELINE, []);
  const entrada = stages.find((s) => s.kind === 'entrada');
  assert.ok(entrada, 'el funnel por defecto tiene que traer una entrada, o este test no mide nada');
  assert.ok(!ofreceAhora(stages).has(entrada.key), 'se ofrece borrar la etapa de entrada');
});

test('CABLEADO: la opción de borrar del menú cuelga de `colsBorrables`', () => {
  // ⚠️ SE EXTRAE LA LÍNEA, NO SE BUSCA EN EL ARCHIVO ENTERO. `esTerminal` aparece
  // legítimamente en otras ocho líneas de este componente; un `match` sobre el fuente
  // completo daría verde con el bug puesto, que es el modo de falla que AGENTS.md ya
  // tiene medido («un guard que lee el archivo entero encuentra lo que el archivo dice
  // de sí»).
  const linea = SRC.split('\n').find((l) => l.includes("value: 'eliminar'") && l.includes('Eliminar etapa'));
  assert.ok(linea, 'no encontré la línea que arma la opción «Eliminar etapa» del menú de columna');
  assert.match(linea, /colsBorrables\.has\(c\.key\)/, 'la opción de borrar no cuelga de `colsBorrables`');
  assert.doesNotMatch(linea, /esTerminal/, 'volvió la condición vieja: `esTerminal` no alcanza, ver el encabezado');
});

test('CABLEADO: `colsBorrables` saca lo que no está en el pipeline Y la entrada', () => {
  const i = SRC.indexOf('const colsBorrables');
  assert.ok(i > 0, 'desapareció `colsBorrables`');
  const bloque = SRC.slice(i, SRC.indexOf('\n  }', i) + 4 || i + 400);
  assert.match(bloque, /colsPropias\.includes/, '`colsBorrables` dejó de apoyarse en `colsPropias` (banda + terminal)');
  assert.match(bloque, /kind !== 'entrada'/, '`colsBorrables` dejó de sacar la etapa de entrada');
});

// ── Verificado rompiéndolo (04/10/2026), con los números ─────────────────────
// · sin romper nada                                        → 5 pases, 0 fallos
// · volviendo la condición del menú a `!esTerminal(c.key)` → 4 pases, 1 fallo (CABLEADO)
// · sacando `kind !== 'entrada'` de `colsBorrables`        → 4 pases, 1 fallo

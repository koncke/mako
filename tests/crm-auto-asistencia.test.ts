// =============================================================================
// El motor NO afirma una asistencia que nadie verificó
// =============================================================================
// `applyFathomRecording` resuelve `attended ?? true`, así que un `null` entra como
// un «sí»: marca `asistio_j1` y mueve la etapa del lead —
// que el revert de la regla T1 no deshace. Y el `null` es un valor NORMAL desde que
// `buscarReunionesAutomatico` lee también los links que una persona pegó a mano en
// la ficha: un link pegado prueba que la reunión se grabó, no quién estuvo.
//
// El caso se midió el 04/10/2026 y lo produjo un arreglo correcto de OTRO archivo
// (la fuente nueva de `fathomR1/R2` en lib/auto-reuniones.ts). Los dos lados estaban
// bien por separado; lo que faltaba era el contrato entre ellos, que no tenía guard.
//
// ⚠️ Esto NO se puede testear llamando a la función: necesita base. Lo que se fija es
// la FORMA de la llamada, que es donde vive la decisión.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('lib/crm-auto.ts', 'utf8');
const AUTO = readFileSync('lib/auto-reuniones.ts', 'utf8');

/** El bloque de la regla T1, sin sus comentarios: lo que se busca es CÓDIGO. */
const t1 = (() => {
  const i = SRC.indexOf('const { addedLink');
  assert.ok(i > 0, 'no encontré la llamada a applyFathomRecording en la regla T1');
  const bloque = SRC.slice(i, SRC.indexOf('revert,', i));
  return bloque.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
})();

test('la regla T1 le pasa marcarAsistencia, en vez de dejar que `?? true` decida', () => {
  assert.match(
    t1,
    /applyFathomRecording\([^;]*marcarAsistencia:\s*asistio\s*!=\s*null/,
    'sin esto, un link pegado a mano en la ficha marca «asistió» y mueve al lead de etapa',
  );
});

test('la fila de «Asistió» sólo se dibuja si la asistencia se marcó de verdad', () => {
  const asist = t1.slice(t1.indexOf('cambios:'));
  // El rótulo de la reunión sale del embudo desde el 06/10/2026 (`rotuloReunion`, cae a
  // «R1»/«R2»): la fila dice `Asistió ${reunion}` y no «Asistió R1» fijo. Es sólo lo que
  // se DIBUJA en la confirmación: el historial sigue escribiendo «Asistió R1» desde
  // `AUDIT_FIELDS` (lib/leads.ts), que es la clave con la que se deshace una línea.
  // Probado rompiendo lib/crm-auto.ts (06/10/2026): la fila colgando de `true` en vez de
  // `markedAsistencia` → 4 pases / 1 fallo; el rótulo cambiado a otra palabra → 4 / 1.
  assert.match(asist, /markedAsistencia[\s\S]*?Asisti[óo] (?:R|\$\{reunion\})/, 'la fila de asistencia tiene que colgar de markedAsistencia');
  // ⚠️ El «no aparece la fila fija» NO se puede escribir como un `doesNotMatch` del
  // texto de la fila: la fila sigue ahí, adentro del ternario. Lo que distingue a la
  // versión buena de la vieja es que la lista se ARMA con spreads condicionales.
  assert.match(
    asist,
    /cambios:\s*\[\s*\.\.\.\(/,
    'la lista de cambios tiene que arrancar con un spread condicional, no con una fila fija',
  );
});

test('la fila de la grabación sólo se dibuja si el link se agregó', () => {
  const asist = t1.slice(t1.indexOf('cambios:'));
  assert.match(asist, /addedLink\s*\?\s*\[\{\s*campo:\s*'Grabación Fathom'/, 'desde que el buscador lee fathom_links, el link ya suele estar: afirmarlo es mentir');
});

test('una corrida que no marcó ni agregó nada no deja confirmación', () => {
  assert.match(t1, /if \(!markedAsistencia && !addedLink\) return 'skip';/, 'una confirmación que no cambió un dato es ruido en la bandeja');
});

test('y del otro lado: sólo la grabación ANALIZADA afirma la asistencia', () => {
  // Si esto cambia a `linkR1 ? true : null`, el guard de arriba deja de proteger:
  // el null desaparece y vuelve a afirmarse una asistencia que nadie miró.
  assert.match(AUTO, /asistioJ1:\s*anaLinkR1 \? true : null/, 'asistioJ1 tiene que salir del link ANALIZADO, no del que alguien pegó a mano');
  assert.match(AUTO, /asistioJ2:\s*anaLinkR2 \? true : null/, 'idem R2');
});

// Verificado rompiéndolo, una rotura por vez y restaurando cada una:
//   · sacando `{ marcarAsistencia: asistio != null }` de la llamada → 1 fallo, 4 pases
//   · volviendo las dos filas de `cambios` a incondicionales        → 2 fallos, 3 pases
//   · borrando el `return 'skip'`                                   → 1 fallo, 4 pases
//   · cambiando `anaLinkR1` por `linkR1` en auto-reuniones          → 1 fallo, 4 pases
// En verde: 5 pases, 0 fallos.
//
// ⚠️ Y el primer intento del segundo test era un `doesNotMatch` del texto de la
// fila, que NO puede fallar: la fila sigue ahí, adentro del ternario. Lo que
// distingue la versión buena de la vieja es que la lista se ARMA con spreads.

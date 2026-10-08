import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// =============================================================================
// El tope de antigüedad de una secuencia tiene que estar en TODAS sus entradas
// =============================================================================
// `dentroDeAntiguedad` decide, y tiene su test en setting-estrategia.test.ts.
// Esto cuida el CABLEADO, que es lo que se rompe sin que nada falle: el tope
// vale al inscribir por el cron (plan y commit), al inscribir por el evento del
// webhook, y otra vez al mandar el primer paso. Si falta en una, esa es la
// puerta por la que entra el acumulado — medido el 17/09/2026: prender la
// bienvenida de ws1 sin tope le escribía «vi que dejaste tus datos» a 125
// leads; con 48 h, a 11.
//
// Probado rompiéndolo: sacando la guarda de `procesarEnvios`, cae «el primer
// paso vuelve a mirar el tope» (2 pasan / 1 falla); sacando `aTiempo` de
// `enrolarPorEvento`, cae «las tres entradas» (2/1). Como está, 3/3.

/**
 * El fuente SIN comentarios: los de este repo citan el código que explican, y
 * una guarda que busca `dentroDeAntiguedad(` se encontraría en su propio
 * comentario y daría verde con la guarda borrada.
 */
function sinComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

// Sin `\r`: en un checkout de Windows (autocrlf) el archivo llega con CRLF y el
// `\n}\n` que cierra cada función no aparece. La primera versión de este test
// daba 3/3 en el clon donde se editó —que tenía LF— y 0/3 en un worktree limpio.
const SRC = sinComentarios(readFileSync(new URL('../lib/nutricion.ts', import.meta.url), 'utf8').replace(/\r\n/g, '\n'));

/** El cuerpo de una función de primer nivel: de su firma al `}` en columna 0. */
function cuerpo(nombre: string): string {
  const ini = SRC.search(new RegExp(`\\n(export )?async function ${nombre}\\b`));
  assert.ok(ini >= 0, `no encontré la función ${nombre} en lib/nutricion.ts`);
  const fin = SRC.indexOf('\n}\n', ini);
  assert.ok(fin > ini, `no encontré el cierre de ${nombre}`);
  return SRC.slice(ini, fin);
}

test('aTiempo decide con dentroDeAntiguedad, no con una cuenta propia', () => {
  assert.match(cuerpo('aTiempo'), /dentroDeAntiguedad\(/);
});

// La cuarta, desde el 08/10/2026: la inscripción A MANO (`inscribirEnSecuencia`, MaKo y los
// pasos «⚡ Acción» de los flujos). Ahí el tope no filtra en silencio: contesta el motivo.
// Probado rompiéndolo (08/10/2026): sacando su `aTiempo`, este test cae (2 pasan / 1 falla).
test('las cuatro entradas de inscripción pasan por el tope', () => {
  for (const f of ['planificarInscripciones', 'comprometerInscripciones', 'enrolarPorEvento', 'inscribirEnSecuencia']) {
    assert.match(cuerpo(f), /aTiempo\(/, `${f} inscribe sin mirar el tope de antigüedad`);
  }
});

test('el primer paso vuelve a mirar el tope al mandar', () => {
  // Una inscripción puede esperar días con la línea caída: sin esto, un lead que
  // entró con 2 h recibe la bienvenida con 5 días.
  const c = cuerpo('procesarEnvios');
  assert.match(c, /dentroDeAntiguedad\(/, 'procesarEnvios manda el primer paso sin mirar el tope');
  // Desde el 08/10/2026 (flujo con ramas): «el primero» ya no es `paso_actual === 0` —detrás de
  // la condición «Llegó hace menos de N h» que pone el conversor, el primer mensaje está en
  // otro índice— y el tope sale de la secuencia O de esa condición (`topeAntiguedad`).
  assert.match(c, /esPrimerPaso\(sec\.pasos, insc\.paso_actual\) && topeAntig != null/);
  assert.match(c, /const topeAntig = topeAntiguedad\(sec\)/);
});

// Probado rompiéndolo (08/10/2026): con `topeAntiguedad` devolviendo sólo
// `sec.antiguedad_max_horas`, este test cae (1 falla); como está, pasa.
test('el tope sale de la secuencia y, si no tiene, de la condición de entrada del flujo', () => {
  const ini = SRC.indexOf('\nfunction topeAntiguedad(');
  assert.ok(ini >= 0, 'no encontré topeAntiguedad');
  const fin = SRC.indexOf('\n}\n', ini);
  assert.match(SRC.slice(ini, fin), /sec\.antiguedad_max_horas \?\? antiguedadDeEntrada\(sec\.pasos\)/);
  assert.match(cuerpo('aTiempo'), /topeAntiguedad\(sec\)/, 'aTiempo no usa el tope del flujo');
});

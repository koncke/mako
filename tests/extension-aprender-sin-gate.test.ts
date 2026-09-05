// =============================================================================
// Aprender no se gatea con poder trabajar
// =============================================================================
// `guardarPlantillas` es la ÚNICA línea que mueve lo que el espejo capturó desde la
// memoria de la pestaña de Flow —que se vacía con cada F5— hasta `chrome.storage`,
// que es de donde lo lee todo el mundo: el popup, el latido y el servidor.
//
// ⚠️ ESTE TEST EXISTE PORQUE YA PASÓ, y costó tres rondas con el dueño mirando.
//
// Esa llamada vivía adentro del `if (estado === 'listo')`. En el Flow nuevo `estado`
// no es `listo` NUNCA —no hay bearer que capturar, así que la rama `if (!bearer)`
// escribe `sin_sesion` siempre—, o sea que el guardado era estructuralmente
// inalcanzable justo en el único caso en que había algo nuevo que aprender. El
// espejo capturaba la generación perfecta, con su sentinela, y moría en la pestaña.
//
// El popup, leyendo un storage vacío, pedía generar el clip de prueba de nuevo por
// más veces que la persona pagara — en créditos de Google del cliente.
//
// Es la trampa que AGENTS.md ya tiene escrita palabra por palabra: «¿la condición
// que activa a mi arreglo puede ser falsa POR CULPA de lo que el arreglo viene a
// arreglar?». Acá la respuesta era sí y en el peor sentido, porque el aprendizaje
// existe PARA salir del estado que lo estaba bloqueando.
//
// Y no da error: no hay excepción, no hay log, y el estado que se muestra es
// exactamente el de «todavía no aprendió».
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const src = readFileSync(
  resolve(import.meta.dirname, '..', 'extension', 'background.js'), 'utf8',
);

/**
 * El cuerpo de un bloque que arranca en `abre`, por conteo de llaves.
 *
 * ⚠️ Se le sacan los comentarios ANTES de contar: este archivo tiene llaves adentro
 * de la prosa de sus comentarios —`{tipo}`, `${p.clase}`— y con ellas el conteo
 * cierra en cualquier lado. Un extractor que devuelve el bloque equivocado hace que
 * el test pase sobre código que no miró, que es peor que no tenerlo.
 */
function cuerpoDelBloque(texto: string, abre: string): string {
  const limpio = texto
    .replace(/^[ \t]*\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const i = limpio.indexOf(abre);
  assert.notEqual(i, -1, `no encontré el bloque que arranca con: ${abre}`);
  let n = 0;
  let j = i + abre.length - 1;
  for (; j < limpio.length; j++) {
    if (limpio[j] === '{') n++;
    else if (limpio[j] === '}') { n--; if (n === 0) break; }
  }
  return limpio.slice(i, j + 1);
}

test('`guardarPlantillas` NO vive adentro del gate de `estado === \'listo\'`', () => {
  const gate = cuerpoDelBloque(src, "if (estado === 'listo') {");
  assert.ok(
    !gate.includes('guardarPlantillas('),
    'Volvió a quedar adentro del `if (estado === \'listo\')`.\n\n'
    + 'En el Flow nuevo ese gate es FALSO siempre, así que ahí adentro el guardado no\n'
    + 'corre nunca: lo que el espejo aprende muere en la memoria de la pestaña y el\n'
    + 'popup pide generar el clip de prueba de nuevo, cobrándoselo al cliente.\n\n'
    + 'Va afuera del gate, con su propio try.',
  );
});

test('`guardarPlantillas` se llama en el latido, afuera de todo gate de estado', () => {
  // El inverso del de arriba: sacarlo del gate y olvidarse de llamarlo en otro lado
  // deja el mismo agujero con el test en verde.
  assert.ok(
    src.includes('await guardarPlantillas(tabAprender.id)'),
    'Nadie llama a `guardarPlantillas` fuera del gate: lo que se aprende no se guarda.',
  );
  const antes = src.indexOf('await guardarPlantillas(tabAprender.id)');
  const gate = src.indexOf("if (estado === 'listo') {");
  assert.ok(
    antes !== -1 && gate !== -1 && antes < gate,
    'La llamada tiene que correr ANTES del gate, no después: después del gate el `catch` '
    + 'de arriba ya pudo haber salido del ciclo.',
  );
});

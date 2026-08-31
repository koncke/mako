// =============================================================================
// La versión de la extensión: la copia gemela y el número publicado
// =============================================================================
// El 31/08/2026 el dueño apretó «actualizar» y la extensión se quedó en 0.16.0
// mientras el repo iba en 0.17.0. Era la TERCERA vez que reportaba lo mismo.
//
// La causa nunca fue el botón: una extensión instalada DESCOMPRIMIDA no se
// actualiza nunca, porque tanto el ↻ de chrome://extensions como
// `chrome.runtime.reload()` vuelven a leer LA MISMA CARPETA. Medido ese día
// leyendo el perfil de Chrome: cargaba `C:\Users\marti\OneDrive\Escritorio\
// mako-puente`, una copia congelada del 30/08 a las 21:12, y no la carpeta del
// repo.
//
// Este archivo no puede impedir eso —es un hecho de cómo funciona Chrome—, pero
// sí fija las dos cosas que hacían que se diagnosticara a ciegas: que las dos
// copias de la comparación no se separen, y que el número que la pantalla publica
// sea el que está adentro del paquete.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { esMasVieja } from '../lib/version-comparar';
import { EXTENSION_VERSION } from '../lib/extension-version';

const FUENTE = readFileSync(join(process.cwd(), 'extension/background.js'), 'utf8');

/** La gemela, extraída del fuente REAL de la extensión. */
function traerGemela(): (a: string, b: string) => boolean {
  const ini = FUENTE.indexOf('function esMasVieja(');
  assert.ok(ini > 0, 'esMasVieja() ya no está en extension/background.js: el test quedó viejo');
  const desde = FUENTE.indexOf('{', ini);
  let d = 0;
  let fin = -1;
  for (let i = desde; i < FUENTE.length; i++) {
    if (FUENTE[i] === '{') d++;
    else if (FUENTE[i] === '}') { d--; if (d === 0) { fin = i + 1; break; } }
  }
  assert.ok(fin > 0, 'no se pudo delimitar esMasVieja() en la extensión');
  // eslint-disable-next-line no-new-func
  return new Function(`${FUENTE.slice(ini, fin)}; return esMasVieja;`)() as (a: string, b: string) => boolean;
}

const gemela = traerGemela();

/**
 * Los casos. El primero es el que motiva que la función exista.
 *
 * Cada uno es `[instalada, publicada, deberíaAvisar]`.
 */
const CASOS: Array<[string, string, boolean]> = [
  // ⚠️ EL CASO QUE ROMPE LA COMPARACIÓN DE TEXTO. Alfabéticamente '0.10.0' es
  // MENOR que '0.6.0', así que una comparación de strings diría que la 0.10.0
  // quedó vieja y mandaría a reiniciar para siempre a quien está al día.
  ['0.10.0', '0.6.0', false],
  ['0.6.0', '0.10.0', true],

  // El caso real del 31/08.
  ['0.16.0', '0.17.0', true],
  ['0.17.0', '0.17.0', false],

  // ⚠️ La instalada ADELANTE no avisa. Pasa en la máquina de desarrollo, en los
  // minutos entre el push y el deploy, y para siempre si el build falló. Con un
  // `!==` en lugar de un orden, cada uno de esos casos sería un reinicio que deja
  // la pestaña muda hasta el latido siguiente.
  ['0.18.0', '0.17.0', false],

  // Distinta cantidad de tramos: lo que falta vale cero.
  ['0.17', '0.17.0', false],
  ['0.17', '0.17.1', true],
  ['1.0.0', '0.99.99', false],

  // Basura: no se rompe y no manda a actualizar por las dudas. Avisar de más acá
  // significa un bucle de reinicio, que es peor que estar desactualizado.
  ['', '', false],
  ['x.y.z', '0.1.0', true],
];

test('las dos copias de esMasVieja contestan lo mismo', () => {
  for (const [a, b] of CASOS) {
    assert.equal(
      esMasVieja(a, b),
      gemela(a, b),
      `la app y la extensión no coinciden en esMasVieja("${a}", "${b}")`,
    );
  }
});

test('esMasVieja ordena por número, no por texto', () => {
  for (const [a, b, esperado] of CASOS) {
    assert.equal(esMasVieja(a, b), esperado, `esMasVieja(${a}, ${b})`);
  }
});

test('el número que publica la pantalla es el que está adentro del paquete', () => {
  // ⚠️ `lib/extension-version.ts` lo GENERA `scripts/zip-extension.mjs`, así que
  // en teoría no puede desfasarse. En la práctica es el número contra el que la
  // pantalla decide si avisar, y si alguna vez se edita a mano —o el script
  // cambia— el aviso empieza a mentir en la dirección peor: diciendo «estás al
  // día» a alguien que no lo está. Es una línea de test contra un fallo mudo.
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), 'extension/manifest.json'), 'utf8'),
  ) as { version: string };
  assert.equal(
    EXTENSION_VERSION,
    manifest.version,
    'lib/extension-version.ts quedó desfasado del manifest: corré `node scripts/zip-extension.mjs`',
  );
});

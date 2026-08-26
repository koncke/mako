// =============================================================================
// El copy del puente va en español neutro, y nada lo cazaba
// =============================================================================
// La pantalla está escrita en imperativo neutro («Instala», «Conecta», «Abre»),
// pero el kit compartido trae VOSEO en sus textos por defecto — `ErrorState` dice
// «Probá de nuevo en unos segundos», `PermissionState` dice «No tenés acceso» — y
// los comentarios del repo también. Copiar de ahí mete «conectá/pegalo» en una
// pantalla que dice «conecta/pégalo», sin que nada falle.
//
// El único test de voseo que existía mira SOLO el catálogo de puestas
// (tests/video-puestas.test.ts), así que este archivo no tenía red.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = join(import.meta.dirname, '..');

/**
 * ⚠️ Sin `\b`: el límite de palabra de JavaScript es ASCII, así que después de
 * una vocal acentuada NO hay borde y `pegá`, `mirá` o `entrá` se escapan en
 * silencio. Van los límites por Unicode.
 *
 * Y ojo con los imperativos que en neutro existen igual (`pega`, `mira`): lo que
 * los distingue es justamente la tilde final, así que la lista es de formas
 * acentuadas y de verbos que no tienen homógrafo neutro.
 */
const VOSEO =
  /(?<!\p{L})(vos|sos|tenés|querés|podés|debés|sabés|hacés|ponés|vas a tener|andá|mirá|pegá|tocá|dejá|entrá|fijate|acordate|probá|conectá|descargá|instalá|abrí|escribí|elegí|revisá|clickeá|apretá)(?!\p{L})/giu;

/** Solo el texto que un cliente LEE: fuera comentarios, imports y nombres de código. */
function copyVisible(ruta: string): string {
  const crudo = readFileSync(join(RAIZ, ruta), 'utf8');
  return crudo
    .replace(/\/\*[\s\S]*?\*\//g, ' ')   // bloques /* … */ y {/* … */}
    .replace(/^\s*\/\/.*$/gm, ' ')       // líneas // …
    .replace(/^import[\s\S]*?;$/gm, ' ');
}

const PANTALLAS = [
  'app/video-generator/PuentePanel.tsx',
  'app/video-generator/VideoGeneratorApp.tsx',
];

for (const ruta of PANTALLAS) {
  test(`sin voseo en el copy de ${ruta}`, () => {
    const encontrado = [...copyVisible(ruta).matchAll(VOSEO)].map((m) => m[0]);
    assert.deepEqual(
      encontrado,
      [],
      `El producto se usa en México: la interfaz va en español neutro. Encontrado: ${encontrado.join(', ')}`,
    );
  });
}

/** Normaliza el texto de un JSX: el copy viene partido en varias líneas. */
const enUnaLinea = (s: string) => s.replace(/\s+/g, ' ');

test('el aviso de navegador incompatible ofrece una SALIDA, no solo la puerta cerrada', () => {
  // Un aviso que dice «no podés» y nada más deja a la persona en un callejón.
  // Este es el contrato: nombra los navegadores que sí sirven, y aclara que puede
  // seguir usando MaKo donde está — la extensión trabaja desde donde se instaló,
  // que es cierto porque el que encola y el que ejecuta solo comparten el
  // workspace (lib/flow-cola.ts), nunca la sesión ni el navegador.
  const copy = enUnaLinea(copyVisible('app/video-generator/PuentePanel.tsx'));
  const aviso = /Este navegador no puede instalar la extensión.{0,320}/.exec(copy)?.[0] ?? '';

  assert.ok(aviso, 'desapareció el aviso de navegador incompatible');
  assert.match(aviso, /Chrome/, 'el aviso tiene que nombrar a dónde ir');
  assert.match(aviso, /puedes seguir usando MaKo/, 'el aviso tiene que decir que no hay que mudarse');
});

test('TODO var(--fs-*) del repo apunta a un token que existe', () => {
  // Un `var(--x)` inexistente no da error: hereda el tamaño del padre, en
  // silencio. Es el mismo modo de falla que `<Icon name="inventado">` dibujando
  // un punto — y ya se coló dos veces (`--fs-xs`, `--fs-lg`).
  //
  // El chequeo va sobre el repo ENTERO y no sobre una lista de archivos: un guard
  // que cubre dos pantallas deja pasar la tercera, y el que la escribe no tiene
  // por qué saber que este test existe.
  const definidos = new Set(
    [...readFileSync(join(RAIZ, 'app/globals.css'), 'utf8').matchAll(/^\s*(--fs-[a-z]+)\s*:/gm)].map((m) => m[1]),
  );
  assert.ok(definidos.size >= 5, 'no se pudieron leer los tokens de app/globals.css');

  // `git grep` sale con código 1 cuando no encuentra NADA, y eso hace tirar a
  // execFileSync: sin este catch, el test explotaría con un error críptico justo
  // en el caso en que no hay nada que reprochar.
  let salida = '';
  try {
    salida = execFileSync(
      'git',
      ['grep', '-n', '-o', '-E', 'var\\(--fs-[a-z]+\\)', '--', 'app', 'lib'],
      { cwd: RAIZ, encoding: 'utf8' },
    );
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    if (err.status !== 1) throw e;   // 1 = sin coincidencias; cualquier otro sí es un problema
  }

  const huerfanos = salida
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [archivo, linea, uso] = l.split(':');
      return { archivo, linea, token: uso.replace(/^var\(|\)$/g, '') };
    })
    .filter((u) => !definidos.has(u.token))
    .map((u) => `${u.archivo}:${u.linea} usa ${u.token}`);

  assert.deepEqual(huerfanos, [], `tokens de fuente inexistentes:\n  ${huerfanos.join('\n  ')}`);
});

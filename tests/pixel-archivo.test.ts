// =============================================================================
// El Pixel de MaKo como archivo .js (lib/pixel-archivo.ts).
// =============================================================================
// El caso (08/10/2026): los clientes de Código Inmobiliario no podían instalar el
// Pixel. Su editor con IA contestó que el código le llegó con `********` en varias
// secciones y lo rechazó por JavaScript inválido. Los asteriscos los pone la
// herramienta, no MaKo; la salida es el archivo, que se guarda en el proyecto sin
// pasar por el chat. Este archivo fija que ese archivo CARGUE: se prueba contra el
// snippet que emite MaKo de verdad, no contra uno escrito a mano.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Script } from 'node:vm';
import { ARCHIVO_PIXEL, pixelComoArchivo } from '../lib/pixel-archivo';

const RAIZ = join(__dirname, '..');
const TOKEN = `mko_${'a1'.repeat(16)}`;

/** El snippet que emite MaKo. `lib/landing-token.ts` tiene `server-only`, así que se
 *  emite en un node aparte con la condición del server. */
function snippetEmitido(): string {
  const modulo = pathToFileURL(join(RAIZ, 'lib', 'landing-token.ts')).href;
  const codigo = `import { landingSnippet } from ${JSON.stringify(modulo)}; process.stdout.write(landingSnippet(${JSON.stringify(TOKEN)}));`;
  return execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  });
}

const SNIPPET = snippetEmitido();

test('el archivo del snippet emitido es JavaScript válido; el snippet tal cual no lo es', () => {
  const archivo = pixelComoArchivo(SNIPPET);
  assert.ok(archivo, 'el snippet emitido cambió de forma y el botón de descargar desapareció');
  assert.doesNotThrow(() => new Script(archivo!, { filename: ARCHIVO_PIXEL }), 'el archivo no compila: no carga en la página');
  // La razón de que exista: pegado tal cual adentro de un .js, el snippet no compila.
  assert.throws(() => new Script(SNIPPET), 'el snippet crudo compila como .js: este test ya no distingue nada');
});

test('el archivo no pierde nada: es el mismo código, con el token, sin las etiquetas', () => {
  const archivo = pixelComoArchivo(SNIPPET)!;
  assert.ok(!/<\/?script/i.test(archivo));
  assert.ok(archivo.includes(`'${TOKEN}'`), 'el archivo no lleva el token: los eventos no tendrían de quién ser');
  assert.equal(archivo.trim(), SNIPPET.trim().replace(/^<script>\r?\n/, '').replace(/\r?\n<\/script>$/, '').trim());
});

// Probado rompiéndolo (13/10/2026): sin la salida temprana, o sin que la primera copia se
// anote, este test falla (1 fallo cada una).
test('una sola copia por página: la segunda no hace nada (13/10/2026)', () => {
  const archivo = pixelComoArchivo(SNIPPET)!;
  // Con otra copia ya corriendo, sale ANTES de tocar nada de la página: en un contexto sin
  // `document`, no tira.
  const otra = { __makoPixel: 1 } as Record<string, unknown>;
  assert.doesNotThrow(() => new Script(archivo).runInNewContext({ window: otra }), 'con otra copia corriendo, ésta siguió y tocó la página');
  // Sin otra copia, sigue de largo (acá tira porque no hay `document`): si no tirara, este
  // test no distinguiría nada. Y se anota, para que la siguiente sea la que no corre.
  const sola = {} as Record<string, unknown>;
  assert.throws(() => new Script(archivo).runInNewContext({ window: sola }), /document is not defined/);
  assert.equal(sola.__makoPixel, 1, 'la primera copia no se anotó: la segunda correría igual');
});

test('con saltos CRLF también sale', () => {
  const crlf = SNIPPET.replace(/\r?\n/g, '\r\n');
  const archivo = pixelComoArchivo(crlf);
  assert.ok(archivo);
  assert.doesNotThrow(() => new Script(archivo!));
});

test('una forma inesperada no ofrece archivo, en vez de ofrecer uno roto', () => {
  assert.equal(pixelComoArchivo('<script src="https://x.test/a.js"></script>'), null);
  assert.equal(pixelComoArchivo('var a = 1;'), null);
  assert.equal(pixelComoArchivo('<script>\nvar a = 1;\n</script>\n<script>\nvar b = 2;\n</script>'), null, 'dos scripts: el archivo saldría con etiquetas adentro');
});

test('la pantalla ofrece el archivo: el botón, el nombre y la línea de ayuda', () => {
  const src = readFileSync(join(RAIZ, 'app', 'integraciones', 'IntegracionesBoard.tsx'), 'utf8').replace(/\r\n/g, '\n');
  const codigo = src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(codigo, /pixelComoArchivo\(codigo\)/, 'la pantalla no arma el archivo');
  assert.match(codigo, /a\.download = ARCHIVO_PIXEL;/, 'el archivo se baja con otro nombre que el que el cliente ya carga');
  assert.match(codigo, /\{archivo && <IconBtn name="descargar"[^>]*onClick=\{descargar\}/, 'no hay botón para bajarlo');
  const ayuda = codigo.slice(codigo.indexOf('const DONDE_PEGAR'), codigo.indexOf('];', codigo.indexOf('const DONDE_PEGAR')));
  assert.match(ayuda, /\*{8}[^\n]*descárgalo/, 'la ayuda no dice qué hacer cuando el editor tapa el código');
});

// Probado rompiéndolo (08/10/2026), una rotura por vez y con todo en verde antes:
// devolver el snippet sin sacarle las etiquetas tumba 3 (el que compila, el que no
// pierde nada y el de CRLF); sacar el chequeo de `</script` tumba el de la forma
// inesperada; la regex sin `\r?` tumba el de CRLF; y quitar el botón o la línea de
// ayuda tumba el último. 5 roturas, todas con su fallo.

// Un test no fija una ruta de Windows como dato: en Linux (GitHub Actions) `C:\…` es una ruta
// RELATIVA y `resolve` le pega delante el cwd del runner. El 16/10/2026 un
// `REPO = 'C:\\repo\\dashboard-marketing'` en tests/tsc-acotado.test.ts dio verde en la notebook y
// 2 rojos en el run 38845971505. La guarda (scripts/rutas-windows-en-tests.mjs) corre en el push.
//
// Verificado rompiéndolo: volver a poner aquella línea en otro test da salida 1 en la guarda; sacar
// la excepción de la barra seguida de comilla da 2 fallos acá (el caso del escape, y vuelve a
// aparecer instagram-buscar sin estar permitido); sacar la llamada de guardas-push.sh da 1 fallo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lineasConRutaWindows, PERMITIDOS } from '../scripts/rutas-windows-en-tests.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

test('caza la ruta de Windows en un string, un template o un String.raw', () => {
  assert.deepEqual(lineasConRutaWindows("const REPO = 'C:\\\\repo\\\\dashboard-marketing';"), [1], 'la del 16/10');
  assert.deepEqual(lineasConRutaWindows("x\nconst R = 'C:/repo/x';"), [2]);
  assert.deepEqual(lineasConRutaWindows('const R = String.raw`C:\\Users\\marti`;'), [1]);
});

test('no caza comentarios, URLs ni una comilla escapada', () => {
  assert.deepEqual(lineasConRutaWindows("// const REPO = 'C:\\\\repo';"), []);
  assert.deepEqual(lineasConRutaWindows("/* 'C:\\\\repo'\n   'D:/x' */\nconst a = 1;"), []);
  assert.deepEqual(lineasConRutaWindows("const u = 'https://hola-mako.com';"), []);
  assert.deepEqual(lineasConRutaWindows('const m = `las claves de \\`m:\\`: ${x}`;'), [], 'instagram-buscar: `m:\\` es un escape, no una ruta');
});

test('la lista blanca está al día: cada permitido todavía lo necesita, y no falta ninguno', () => {
  const archivos = execFileSync('git', ['ls-files', 'tests'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter((f) => /\.(ts|tsx|mts|mjs)$/.test(f));
  const conLiteral = archivos.filter((f) => { try { return lineasConRutaWindows(leer(f)).length > 0; } catch { return false; } });
  for (const f of PERMITIDOS.keys()) assert.ok(conLiteral.includes(f), `${f} ya no tiene rutas de Windows: sacalo de PERMITIDOS`);
  for (const f of conLiteral) assert.ok(PERMITIDOS.has(f), `${f} fija una ruta de Windows y no está permitido con su motivo`);
});

test('las guardas del push la corren', () => {
  assert.match(leer('scripts/guardas-push.sh').replace(/\r\n/g, '\n'), /if ! node scripts\/rutas-windows-en-tests\.mjs; then[\s\S]*?exit 1/);
});

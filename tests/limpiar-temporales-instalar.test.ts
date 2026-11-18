// =============================================================================
// La limpieza SEMANAL de %TEMP% (F69, 18/11/2026): scripts/limpiar-temporales-instalar.cmd y limpiar-temporales-semanal.cmd
// =============================================================================
// El pendiente: nada podaba `tsx-<usuario>` (216.852 entradas el 6/11/2026). scripts/limpiar-temporales.mjs ya existía y
// sabía borrar; faltaba que alguien lo corriera solo. Ahora hay un instalador que registra la tarea programada de Windows y el
// .cmd que esa tarea corre. Lo instala Martín: ninguna sesión lo corre (borra cientos de miles de archivos en su máquina).
//
// Un .cmd no corre en Linux, así que lo que se fija es lo que se rompe EN SILENCIO entre los tres archivos, y la parte que sí
// se puede correr se corre:
//   1. la tarea corre el .mjs con las MISMAS banderas con que el .mjs borra (corrido de verdad, con un %TEMP% de mentira);
//   2. los nombres que el instalador y la tarea llaman existen al lado, sin rutas de una máquina escritas a mano;
//   3. el instalador sólo REGISTRA: no borra nada al instalarse, y la tarea es semanal.
//
// Probado rompiéndolo (18/11/2026), base 3 pases / 0 fallos, una rotura por vez y restaurando de memoria:
//   · la tarea sin `--aplicar` (contaría y no borraría nunca)                         → 2 / 1
//   · el instalador apuntando a `limpiar-temporales-semana.cmd` (un nombre que no está) → 2 / 1
//   · el instalador con una ruta fija `C:\Users\marti\…`                                → 2 / 1
//   · el instalador corriendo el .mjs con `--aplicar` al instalarse                     → 2 / 1
// Correr: node --import tsx --test tests/limpiar-temporales-instalar.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas que cmd ejecuta: sin los REM ni las vacías. */
const ejecutables = (src: string) => src.split('\n').filter((l) => l.trim() && !/^\s*rem\b/i.test(l));
const INSTALADOR = 'scripts/limpiar-temporales-instalar.cmd';
const TAREA = 'scripts/limpiar-temporales-semanal.cmd';

test('1. la tarea corre el limpiador con las banderas con que borra (corrido de verdad sobre un %TEMP% de mentira)', () => {
  const linea = ejecutables(leer(TAREA)).find((l) => /limpiar-temporales\.mjs/.test(l));
  assert.ok(linea, 'la tarea no corre scripts/limpiar-temporales.mjs');
  const m = /"%~dp0([\w.-]+\.mjs)"((?:\s+--[\w-]+)*)/.exec(linea);
  assert.ok(m, `no entiendo la línea de la tarea: ${linea}`);
  const [, script, banderasTxt] = m;
  const banderas = banderasTxt.trim().split(/\s+/).filter(Boolean);
  assert.ok(banderas.includes('--aplicar'), 'sin --aplicar el limpiador sólo cuenta: la tarea no borraría nunca');

  // Lo mismo que hace la tarea, con el node de este test y un %TEMP% descartable.
  const base = mkdtempSync(join(tmpdir(), 'limpiar-instalar-'));
  try {
    const viejo = join(base, 'tsx-prueba', 'viejo');
    const nuevo = join(base, 'tsx-prueba', 'nuevo');
    for (const d of [viejo, nuevo]) { mkdirSync(d, { recursive: true }); writeFileSync(join(d, 'x'), 'x'); }
    const hace10 = (Date.now() - 10 * 86_400_000) / 1000;
    utimesSync(viejo, hace10, hace10);
    const salida = execFileSync(process.execPath, [join(RAIZ, 'scripts', script), ...banderas], {
      encoding: 'utf8', timeout: 60_000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, TMPDIR: base, TEMP: base, TMP: base },
    });
    assert.match(salida, /Borrados 1\b/, `la tarea tiene que borrar lo viejo:\n${salida}`);
    assert.equal(existsSync(viejo), false, 'lo de hace 10 días se va');
    assert.equal(existsSync(nuevo), true, 'lo de hoy se queda: lo puede estar usando un test');
    assert.equal(existsSync(join(base, 'tsx-prueba')), true, 'la carpeta de la caché no se borra, sólo lo de adentro');
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test('2. lo que el instalador y la tarea llaman existe al lado, sin rutas de una máquina escritas a mano', () => {
  for (const rel of [INSTALADOR, TAREA]) {
    const src = leer(rel);
    for (const [, nombre] of src.matchAll(/%~dp0([\w.-]+)/g)) {
      assert.ok(existsSync(join(RAIZ, 'scripts', nombre)), `${rel} llama a scripts/${nombre}, que no existe`);
    }
    assert.doesNotMatch(ejecutables(src).join('\n'), /[A-Za-z]:\\/, `${rel} tiene una ruta fija de una máquina: va con %~dp0`);
    // cmd lee el archivo con la página de códigos de la consola: una tilde sale como basura.
    assert.doesNotMatch(src, /[^\x00-\x7F]/, `${rel} tiene caracteres fuera de ASCII`);
  }
  assert.match(leer(INSTALADOR), /%~dp0limpiar-temporales-semanal\.cmd/, 'el instalador registra la tarea que corre el limpiador');
});

test('3. el instalador sólo registra: no borra nada al instalarse, y la tarea es semanal', () => {
  const lineas = ejecutables(leer(INSTALADOR));
  assert.deepEqual(lineas.filter((l) => /limpiar-temporales\.mjs|--aplicar/.test(l)), [], 'instalar no corre el limpiador');
  const crear = lineas.findIndex((l) => /schtasks \/create/.test(l));
  assert.ok(crear >= 0, 'no registra ninguna tarea');
  const orden = lineas.slice(crear, crear + 2).join(' ');
  assert.match(orden, /\/tn "mako-limpiar-temporales"/);
  assert.match(orden, /\/sc WEEKLY/, 'una vez por semana');
  assert.match(orden, /\/f\b/, 'correrlo dos veces deja una sola tarea');
});

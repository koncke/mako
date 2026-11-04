// =============================================================================
// El chequeo de tipos en TANDAS: la unión de las tandas dice LO MISMO que el tsc, y cada tanda chequea un pedazo
// =============================================================================
// El paso «Tipos» de Actions pasó de ~2 GB a 5,06 GB de memoria viva en ocho días (run 203: vivo_mb=5062, el 82 % del tope en un runner de 7,9 GB). El tsc crea UN programa y chequea todo con UN
// verificador que no suelta nada; scripts/tipos-por-tandas.mjs crea el programa entero (el piso) pero chequea sólo un pedazo de los archivos por proceso. Su riesgo es el contrario del OOM: que
// una tanda se pierda un error que el tsc sí diría, y el verde lo escondería. Por eso lo que se fija acá no es «anda» sino «dice lo mismo que el tsc de verdad»:
//   · `repartir`: pedazos contiguos, sin perder ni repetir un archivo, de peso parecido.
//   · DE PUNTA A PUNTA, con el tsc de la línea de comandos como oráculo, sobre un proyecto con errores en varias carpetas: para K = 1, 2, 3 y 5 la unión de las tandas da EXACTAMENTE las líneas de error del tsc.
//   · Cada archivo se chequea en una sola tanda (en proceso, con la API).
//   · El orden del tsc: un error de sintaxis o de configuración se informa SOLO (no se chequea lo semántico), igual en todas las tandas.
//   · skipLibCheck: un error dentro de un .d.ts no se informa, como en el tsc.
//   · El bloque de estadísticas lo lee `leerEstadisticas` de tipos-ci (la misma memoria viva).
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BYTES_POR_PESO, argumentosInvalidos, bloqueEstadisticas, chequearTanda, esRaizAmbiente, leerPesos, leerTanda, ordenDelPrograma, ordenarPorPrograma, pesoDe, repartir } from '../scripts/tipos-por-tandas.mjs';
import { leerEstadisticas, tandasPedidas } from '../scripts/tipos-ci.mjs';
import { aplicarSinLiteralesGrandes, experimentos, leerProceso, resumenDeMedicion, sinLiteralesGrandes, tsconfigsDeMedicion, tsconfigsPartidos } from '../scripts/medir-tipos.mjs';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const TSC = join(REPO, 'node_modules', 'typescript', 'bin', 'tsc');
const TANDAS = join(REPO, 'scripts', 'tipos-por-tandas.mjs');
const ts = createRequire(import.meta.url)('typescript');

// ---------------------------------------------------------------------------------------------------------------------------------
// repartir / leerTanda
// ---------------------------------------------------------------------------------------------------------------------------------

test('repartir: pedazos contiguos que no pierden ni repiten un archivo, de peso parecido', () => {
  const items = Array.from({ length: 20 }, (_, i) => ({ nombre: `f${String(i).padStart(2, '0')}`, peso: i % 4 === 0 ? 30 : 10 }));
  for (const K of [1, 2, 3, 4, 7]) {
    const partes = repartir(items, K);
    assert.equal(partes.length, K);
    assert.deepEqual(partes.flat(), items.map((x) => x.nombre), `K=${K}: el orden y el conjunto se conservan (contiguos)`);
    if (K > 1) {
      const peso = (p: string[]) => p.reduce((a, n) => a + (items.find((x) => x.nombre === n)?.peso ?? 0), 0);
      const total = items.reduce((a, x) => a + x.peso, 0);
      for (const p of partes) assert.ok(peso(p) <= (total / K) * 1.6, `K=${K}: ninguna tanda se lleva mucho más que su parte (${peso(p)} de ${total})`);
    }
  }
  assert.deepEqual(repartir([], 3), [[], [], []], 'sin archivos hay K tandas vacías');
  assert.equal(repartir([{ nombre: 'solo', peso: 5 }], 3).flat().length, 1, 'con menos archivos que tandas no se pierde el único');
});

test('leerTanda: i/K válido o null', () => {
  assert.deepEqual(leerTanda('2/3'), { i: 2, K: 3 });
  assert.deepEqual(leerTanda('1/1'), { i: 1, K: 1 });
  for (const malo of ['0/3', '4/3', '2', 'a/b', '', undefined, '1/0']) assert.equal(leerTanda(malo as string | undefined), null, `«${malo}»`);
});

// ---------------------------------------------------------------------------------------------------------------------------------
// DE PUNTA A PUNTA, con el tsc de verdad como oráculo
// ---------------------------------------------------------------------------------------------------------------------------------

const TSCONFIG = { compilerOptions: { strict: true, noEmit: true, target: 'ES2020', module: 'esnext', moduleResolution: 'bundler', skipLibCheck: true, types: [] }, include: ['**/*.ts'], exclude: ['node_modules'] };

function proyecto(archivos: Record<string, string>, tsconfig: object = TSCONFIG): string {
  const dir = mkdtempSync(join(tmpdir(), 'tandas-'));
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(tsconfig));
  for (const [ruta, texto] of Object.entries(archivos)) {
    mkdirSync(dirname(join(dir, ruta)), { recursive: true });
    writeFileSync(join(dir, ruta), texto);
  }
  return dir;
}
const lineasDeError = (salida: string) => salida.split('\n').map((l) => l.trim()).filter((l) => /error TS\d+/.test(l)).sort();
const correr = (dir: string, args: string[]) => spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
const tscReal = (dir: string) => { const r = correr(dir, [TSC, '-p', 'tsconfig.json', '--noEmit']); return { codigo: r.status, lineas: lineasDeError(`${r.stdout}${r.stderr}`) }; };
const porTandas = (dir: string, K: number) => {
  const lineas: string[] = [];
  const codigos: (number | null)[] = [];
  for (let i = 1; i <= K; i++) {
    const r = correr(dir, ['--expose-gc', TANDAS, '-p', 'tsconfig.json', '--tanda', `${i}/${K}`]);
    codigos.push(r.status);
    lineas.push(...lineasDeError(`${r.stdout}${r.stderr}`));
  }
  return { codigos, lineas: [...new Set(lineas)].sort() };
};

const VARIAS_CARPETAS: Record<string, string> = {
  'lib/tipos.ts': "export type P = { a: string; b: number };\nexport const base: P = { a: 'x', b: 1 };\n",
  'lib/util.ts': "import type { P } from './tipos';\nexport const f = (p: P): number => p.b;\n",
  'app/uno/a.ts': "import { f } from '../../lib/util';\nexport const r: string = f({ a: 'x', b: 2 });\n",
  'app/uno/b.ts': "import { f } from '../../lib/util';\nexport const r2: number = f({ a: 'y', b: 3 });\n",
  'app/dos/c.ts': "import { base } from '../../lib/tipos';\nexport const z: number = base.a;\n",
  'app/dos/d.ts': "import { base } from '../../lib/tipos';\nexport const w: string = base.a;\n",
  'tests/t1.test.ts': "import { f } from '../lib/util';\nf('x');\n",
  'tests/t2.test.ts': "import { f } from '../lib/util';\nexport const ok: number = f({ a: 'q', b: 4 });\n",
};

test('DE PUNTA A PUNTA: para K = 1, 2, 3 y 5 la unión de las tandas da EXACTAMENTE las líneas de error del tsc', () => {
  const dir = proyecto(VARIAS_CARPETAS);
  try {
    const oraculo = tscReal(dir);
    assert.equal(oraculo.codigo, 2, 'el tsc de verdad sale 2 con errores (también con noEmit)');
    assert.equal(oraculo.lineas.length, 3, `tres errores en tres carpetas: ${oraculo.lineas.join(' | ')}`);
    for (const K of [1, 2, 3, 5]) {
      const r = porTandas(dir, K);
      assert.deepEqual(r.lineas, oraculo.lineas, `K=${K}: lo mismo que el tsc`);
      assert.ok(r.codigos.some((c) => c === 2), `K=${K}: alguna tanda sale 2, como el tsc`);
      assert.ok(r.codigos.every((c) => c === 0 || c === 2), `K=${K}: ninguna tanda se rompe (códigos ${r.codigos})`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('DE PUNTA A PUNTA: un proyecto sin errores da exit 0 en TODAS las tandas', () => {
  const sano = Object.fromEntries(Object.entries(VARIAS_CARPETAS).map(([k, v]) => [k, k.includes('/uno/a.ts') ? "export const r = 1;\n" : k.includes('/dos/c.ts') ? "export const z = 2;\n" : k.includes('t1.test') ? "export const t = 3;\n" : v]));
  const dir = proyecto(sano);
  try {
    assert.equal(tscReal(dir).codigo, 0);
    const r = porTandas(dir, 3);
    assert.deepEqual(r.codigos, [0, 0, 0]);
    assert.deepEqual(r.lineas, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el orden del tsc: un error de SINTAXIS se informa solo (no se chequea lo semántico), igual en todas las tandas', () => {
  const dir = proyecto({ ...VARIAS_CARPETAS, 'app/dos/roto.ts': 'export const = ;\n' });
  try {
    const oraculo = tscReal(dir);
    assert.ok(oraculo.lineas.length >= 1 && oraculo.lineas.every((l) => /roto\.ts/.test(l)), `el tsc informa sólo lo de roto.ts: ${oraculo.lineas.join(' | ')}`);
    for (const K of [1, 3]) assert.deepEqual(porTandas(dir, K).lineas, oraculo.lineas, `K=${K}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('una opción mal escrita en el tsconfig: el tsc la informa y SIGUE con lo semántico (no corta nada); las tandas, igual', () => {
  const dir = proyecto(VARIAS_CARPETAS, { ...TSCONFIG, compilerOptions: { ...TSCONFIG.compilerOptions, target: 'ES1999' } });
  try {
    const oraculo = tscReal(dir);
    assert.ok(oraculo.lineas.some((l) => /TS6046/.test(l)), `el tsc se queja de la opción: ${oraculo.lineas.join(' | ')}`);
    assert.ok(oraculo.lineas.some((l) => /app\/uno\/a\.ts/.test(l)), 'y sigue con lo semántico: un error de configuración no corta nada');
    assert.deepEqual(porTandas(dir, 2).lineas, oraculo.lineas);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('un error de OPCIONES del programa (bundler con module commonjs) se informa solo, como en el tsc: no se baja a lo semántico', () => {
  const dir = proyecto(VARIAS_CARPETAS, { ...TSCONFIG, compilerOptions: { ...TSCONFIG.compilerOptions, module: 'commonjs' } });
  try {
    const oraculo = tscReal(dir);
    assert.ok(oraculo.lineas.some((l) => /TS5095/.test(l)), `el tsc se queja de la combinación de opciones: ${oraculo.lineas.join(' | ')}`);
    assert.ok(oraculo.lineas.every((l) => !/app\/uno\/a\.ts/.test(l)), 'y NO baja a lo semántico (las opciones inválidas cortan)');
    for (const K of [1, 3]) assert.deepEqual(porTandas(dir, K).lineas, oraculo.lineas, `K=${K}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('skipLibCheck: un error dentro de un .d.ts no se informa (como en el tsc), con o sin tandas', () => {
  const dir = proyecto({ 'types/malo.d.ts': 'export declare const x: nombreQueNoExiste;\n', 'app/a.ts': "export const ok = 1;\n" });
  try {
    assert.deepEqual(tscReal(dir).lineas, []);
    assert.deepEqual(porTandas(dir, 2).lineas, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// En proceso: cada archivo se chequea en UNA tanda
// ---------------------------------------------------------------------------------------------------------------------------------

test('cada archivo se chequea en una sola tanda: la unión es el conjunto completo y las tandas no se pisan', () => {
  const dir = proyecto(VARIAS_CARPETAS);
  try {
    // El programa se crea con ts.sys relativo al cwd del proceso: se usa la ruta absoluta del tsconfig.
    const config = join(dir, 'tsconfig.json');
    const K = 3;
    const tandas = Array.from({ length: K }, (_, i) => chequearTanda({ ts, config, tanda: { i: i + 1, K } }));
    const todos = tandas.flatMap((t) => t.archivosDeLaTanda);
    assert.equal(new Set(todos).size, todos.length, 'ningún archivo en dos tandas');
    const entero = chequearTanda({ ts, config });
    assert.deepEqual([...todos].sort(), [...entero.archivosDeLaTanda].sort(), 'las K tandas juntas son lo que chequea una sola');
    assert.ok(tandas.every((t) => t.archivosDeLaTanda.length > 0), 'ninguna tanda vacía con 8 archivos y K=3');
    assert.equal(todos.length, 8, 'con skipLibCheck sólo se reparten los 8 fuentes: los .d.ts (la lib de TypeScript y las suyas) no pesan ni se chequean');
    assert.ok(todos.every((f) => !f.endsWith('.d.ts')), 'ninguno es un .d.ts');
    assert.equal(tandas.reduce((a, t) => a + t.errores, 0), 3, 'y los tres errores salen, cada uno en la tanda de su archivo');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// El bloque de estadísticas
// ---------------------------------------------------------------------------------------------------------------------------------

test('el bloque de estadísticas lo lee leerEstadisticas de tipos-ci: la misma memoria viva, en el mismo formato que el tsc', () => {
  const e = { files: 7723, checked: 2500, symbols: 1, types: 2077874, instantiations: 7254272, baseMb: 1800, vivoMb: 3100, maxRssMb: 3400, parseS: 14.2, bindS: 6.1, checkS: 40.5, totalS: 61.3 };
  const bloque = bloqueEstadisticas(e, { i: 2, K: 3 }).join('\n');
  assert.match(bloque, /^Tanda:\s+2\/3$/m);
  const leido = leerEstadisticas(bloque);
  assert.equal(leido.vivoMb, 3100, 'Memory used → los MB vivos (miles de bytes, como el tsc)');
  assert.equal(leido.archivos, 7723);
  assert.equal(leido.tipos, 2077874);
  assert.equal(leido.instanciaciones, 7254272);
  assert.equal(leido.chequeoS, 40.5);
  assert.doesNotMatch(bloque, /Extra files checked/, 'sin extras no hay fila');
  const conExtras = bloqueEstadisticas({ ...e, extras: 16 }, { i: 2, K: 3 }).join('\n');
  assert.match(conExtras, /^Extra files checked:\s+16$/m, 'con extras, la fila que lee el medidor');
  assert.equal(leerEstadisticas(conExtras).vivoMb, 3100, 'y la fila nueva no desordena lo que tipos-ci lee');
});

// ---------------------------------------------------------------------------------------------------------------------------------
// El medidor (scripts/medir-tipos.mjs): lo que se corre UNA vez en Actions para elegir el arreglo con un número
// ---------------------------------------------------------------------------------------------------------------------------------

test('leerProceso lee lo que sale de un proceso del tsc o de una tanda, y la curva y los puntos calientes', () => {
  const salida = [
    'CURVA tanda=1/1 chequeados=500 vivo_mb=2100', 'CALIENTE ms=4200 lib/nutricion.ts', 'CALIENTE ms=900 app/crm/actions.ts',
    'EXTRA scripts/medir.mjs', 'EXTRA node_modules/pkg/index.ts',
    'Tanda:                  1/3', 'Files:                  7723', 'Files checked:          1800', 'Extra files checked:    2', 'Types:                  2077874', 'Instantiations:         7254272',
    'Base memory used:       1887436K', 'Memory used:            3250000K', 'Max RSS:                3400 MB', 'Parse time:             14.20s', 'Bind time:              6.10s', 'Check time:             40.50s', '',
  ].join('\n');
  const p = leerProceso(salida);
  assert.equal(p.vivoMb, 3099);
  assert.equal(p.baseMb, 1800);
  assert.equal(p.rssMb, 3400);
  assert.equal(p.archivos, 7723);
  assert.equal(p.chequeados, 1800, '«Files checked» son las raíces de la tanda; los extras no se suman acá');
  assert.deepEqual(p.extras, ['scripts/medir.mjs', 'node_modules/pkg/index.ts'], 'los EXTRA: los archivos que la tanda trae por import sin ser raíz de nadie, por su nombre');
  assert.equal(p.chequeoS, 40.5);
  assert.deepEqual(p.curva, ['CURVA tanda=1/1 chequeados=500 vivo_mb=2100']);
  assert.equal(p.calientes.length, 2);
  const sinNada = leerProceso('FATAL ERROR: Reached heap limit\n');
  assert.equal(sinNada.vivoMb, null, 'un proceso que murió no tiene memoria viva: n/d, no 0');
  assert.equal(sinNada.baseMb, null);
  assert.deepEqual(sinNada.extras, [], 'sin EXTRA, una lista vacía');
});

test('experimentos y tsconfig partidos: las trece mediciones en orden (tandas-1 antes que las balanceadas), y los dos programas que separan tests/ del resto', () => {
  const nombres = experimentos().map((e) => e.nombre);
  assert.deepEqual(nombres, [
    'tsc-real', 'tandas-1', 'tandas-2', 'tandas-3', 'tandas-4', 'partido-resto', 'partido-tests',
    'types-node', 'sin-literales', 'tandas-4-balanceadas', 'tandas-4-raices', 'tandas-4-raices-balanceadas', 'tandas-3-raices-balanceadas',
  ]);
  assert.ok(nombres.indexOf('tandas-1') < nombres.indexOf('tandas-4-balanceadas'), 'tandas-1 escribe el costo por archivo: va antes de quien lo lee');
  const por = (n: string) => experimentos().find((e) => e.nombre === n);
  assert.ok(por('tandas-4-balanceadas')?.pesos && !por('tandas-4-balanceadas')?.raices);
  assert.ok(por('tandas-4-raices')?.raices && !por('tandas-4-raices')?.pesos);
  assert.ok(por('tandas-4-raices-balanceadas')?.raices && por('tandas-4-raices-balanceadas')?.pesos);
  assert.ok(por('sin-literales')?.stub, 'el que modifica archivos lo declara');
  assert.deepEqual(Object.keys(tsconfigsDeMedicion()).sort(), ['tsconfig.medir-resto.json', 'tsconfig.medir-tests.json', 'tsconfig.medir-types.json']);
  assert.deepEqual((tsconfigsDeMedicion()['tsconfig.medir-types.json'] as { compilerOptions: { types: string[] } }).compilerOptions.types, ['node'], 'sólo los tipos de node, no los 30 @types que entran solos');
  assert.ok(experimentos().find((e) => e.nombre === 'tandas-1')?.medir, 'la curva y los puntos calientes se piden en el chequeo entero');
  assert.ok(experimentos().find((e) => e.nombre === 'tsc-real')?.real, 'la referencia es el tsc de verdad');
  const { 'tsconfig.medir-resto.json': resto, 'tsconfig.medir-tests.json': tests } = tsconfigsPartidos() as Record<string, { extends: string; include: string[]; exclude: string[] }>;
  assert.ok(resto.exclude.includes('tests'), 'el resto excluye tests/');
  assert.ok(tests.include.includes('tests/**/*.ts') && !tests.include.includes('**/*.ts'), 'los tests incluyen sólo tests/');
  assert.equal(resto.extends, './tsconfig.json');
});

test('resumenDeMedicion: la tabla, y una lectura mecánica que dice cuánto baja el pico con cada reparto (y si partir tests/ no alcanza)', () => {
  const proc = (vivoMb: number, baseMb: number | null, segundos = 100) => ({ i: 1, estado: 'ok', segundos, vivoMb, baseMb, rssMb: null, chequeados: null, archivos: null });
  const { md } = resumenDeMedicion([
    { nombre: 'tsc-real', K: 1, nota: '', procesos: [proc(5062, null, 134)] },
    { nombre: 'tandas-1', K: 1, nota: '', procesos: [proc(5000, 1800, 140)] },
    { nombre: 'tandas-3', K: 3, nota: '', procesos: [proc(2900, 1800, 70), proc(3100, 1800, 70), proc(2800, 1800, 70)] },
    { nombre: 'partido-resto', K: 1, nota: '', procesos: [proc(4300, 1500)] },
    { nombre: 'partido-tests', K: 1, nota: '', procesos: [proc(4800, 1700)] },
  ], 6144);
  assert.match(md, /\| tandas-3 \| 3 \| ok \| 3\.100 \| 50 % \| 1\.800 \| 210 \|/, 'el pico es el MAYOR de las tandas, y los segundos suman');
  assert.match(md, /3 tandas: pico 3\.100 MB \(50 % del tope\) contra 5\.000 MB del chequeo entero → 38 % menos/);
  assert.match(md, /NO alcanza \(el programa de los tests arrastra casi todo\)/, 'partir tests/ con 4.800 de 5.000 no sirve');
  assert.match(md, /El piso .* es 1\.800 MB: 36 % del pico/);
  // La cobertura: las tandas por raíces tienen que chequear los MISMOS archivos que el chequeo entero.
  const chequea = (c: number | null, extras: string[] = []) => ({ i: 1, estado: 'ok', segundos: 1, vivoMb: 3000, baseMb: 1500, rssMb: null, chequeados: c, archivos: null, extras });
  const cobertura = resumenDeMedicion([
    { nombre: 'tandas-1', K: 1, nota: '', procesos: [chequea(6185)] },
    { nombre: 'tandas-4', K: 4, nota: '', procesos: [chequea(6185)] },
    // Las raíces suman 6.183; dos .mjs sin tanda los trae cada programa (uno lo trae DOS veces) y cuentan UNA vez por nombre: 6.183 + 2 = 6.185.
    { nombre: 'tandas-4-raices', K: 4, nota: '', procesos: [chequea(3000, ['scripts/a.mjs', 'scripts/b.mjs']), chequea(3183, ['scripts/b.mjs'])] },
    // Las mismas raíces pero SIN los extras: faltan 2 archivos que el chequeo entero sí revisa.
    { nombre: 'tandas-3-raices-balanceadas', K: 3, nota: '', procesos: [chequea(3000), chequea(3183)] },
  ], 6144).md;
  assert.match(cobertura, /`tandas-4-raices`: .*cobertura ✔ \(6\.185 archivos chequeados/, 'raíces + extras sin repetir son los mismos archivos que el chequeo entero: cobertura ✔');
  assert.match(cobertura, /`tandas-3-raices-balanceadas`: .*⚠️ COBERTURA DISTINTA: 6\.183 archivos chequeados contra 6\.185/, 'unos archivos que ninguna tanda chequeó se dicen, no se pierden en silencio');
  const sinDatos = resumenDeMedicion([{ nombre: 'tandas-1', K: 1, nota: '', procesos: [{ ...proc(0, null), vivoMb: null }] }], 6144).md;
  assert.match(sinDatos, /\| tandas-1 \| 1 \| ok \| n\/d \| n\/d \|/, 'sin medir se dice n/d, nunca 0');
});

test('DE PUNTA A PUNTA: medir-tipos corre las trece mediciones sobre un proyecto, deja una línea MEDIDA-TIPOS por proceso, restaura lo que modifica y limpia sus tsconfig', () => {
  const grande = `export const DATOS = [\n${Array.from({ length: 1500 }, (_, i) => `  { id: ${i}, nombre: 'curso numero ${i}' },`).join('\n')}\n];\n`;
  assert.ok(grande.length > 40_000);
  const dir = proyecto({ ...VARIAS_CARPETAS, 'lib/datos.ts': grande });
  try {
    const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'medir-tipos.mjs')], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 600_000, env: { ...process.env, MEDIR_TIPOS_PROYECTO: dir, MEDIR_TIPOS_PERMITIR_STUBS: '1', GITHUB_STEP_SUMMARY: join(dir, 'resumen.md') } });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const lineas = r.stdout.split('\n').filter((l) => l.startsWith('MEDIDA-TIPOS '));
    assert.equal(lineas.length, 1 + 1 + 2 + 3 + 4 + 1 + 1 + 1 + 1 + 4 + 4 + 4 + 3, 'uno por proceso: 1 + 1 + 2 + 3 + 4 + 1 + 1 + 1 + 1 + 4 + 4 + 4 + 3');
    assert.match(r.stdout, /STUBS archivos=1 literales=1 caracteres_quitados=\d+/, 'el literal grande de lib/datos.ts se reemplazó');
    assert.equal(readFileSync(join(dir, 'lib', 'datos.ts'), 'utf8'), grande, 'y se restauró entero');
    assert.match(r.stdout, /cobertura ✔/, 'las tandas por raíces chequean los mismos archivos que el chequeo entero');
    const modoDe = (exp: string) => /modo=(\S+)/.exec(lineas.find((l) => l.startsWith(`MEDIDA-TIPOS exp=${exp} `)) ?? '')?.[1];
    assert.deepEqual([modoDe('tsc-real'), modoDe('tandas-4'), modoDe('tandas-4-balanceadas'), modoDe('tandas-4-raices'), modoDe('tandas-4-raices-balanceadas')], ['tsc', 'bytes', 'pesos', 'raices', 'raices+pesos'], 'cada experimento dice cómo repartió: los balanceados leyeron los pesos y los de raíces las usaron');
    assert.doesNotMatch(r.stdout, /COBERTURA DISTINTA/);
    assert.ok(lineas.every((l) => /vivo_mb=\d+/.test(l)), `todos miden la memoria viva:\n${lineas.join('\n')}`);
    assert.ok(lineas.every((l) => /estado=ok(\(con errores de tipos\))? /.test(l)), 'el proyecto tiene errores de tipos y eso no frena la medición: se anotan como ok');
    assert.ok(lineas.some((l) => /estado=ok\(con errores de tipos\)/.test(l)), 'y los procesos que chequean un archivo con error lo dicen');
    assert.match(r.stdout, /CALIENTE ms=\d+ /, 'los puntos calientes del chequeo entero');
    assert.match(r.stdout, /\| partido-tests \| 1 \|/, 'la tabla del resumen');
    for (const f of ['tsconfig.medir-resto.json', 'tsconfig.medir-tests.json', 'tsconfig.medir-types.json']) assert.equal(spawnSync(process.execPath, ['-e', `process.exit(require('fs').existsSync(${JSON.stringify(join(dir, f))}) ? 1 : 0)`]).status, 0, `${f} se borró`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---------------------------------------------------------------------------------------------------------------------------------
// Las palancas sobre el PISO (segunda medición, 21/10/2026): el programa por RAÍCES, el reparto por COSTO, los literales grandes
// ---------------------------------------------------------------------------------------------------------------------------------

test('pesoDe / leerPesos / esRaizAmbiente: el peso es el costo medido más el tamaño; un archivo nuevo pesa el promedio; los ambientes son siempre raíz', () => {
  const pesos = leerPesos(JSON.stringify({ version: 1, archivos: { 'a.ts': 100, 'b.ts': 300 } }));
  assert.equal(pesos.promedio, 200);
  assert.equal(pesoDe('a.ts', 3000, pesos), 100 + 3000 / BYTES_POR_PESO + 1, 'el costo medido más el tamaño a razón de un tipo cada 300 bytes');
  assert.equal(pesoDe('nuevo.ts', 0, pesos), 200 + 1, 'un archivo que no estaba en la medición pesa el promedio');
  assert.equal(pesoDe('a.ts', 3000, null), 3001, 'sin pesos: el tamaño');
  assert.equal(pesoDe('a.ts', 0, { archivos: { 'a.ts': -5 }, promedio: 0 }), 1, 'un costo negativo no resta');
  for (const malo of ['{}', '{"version":2,"archivos":{}}', '{"version":1}', 'null']) assert.throws(() => leerPesos(malo), /no es el de --costos-out|Unexpected|null/, malo);

  assert.equal(esRaizAmbiente('x.d.ts', 'export {};'), true, 'un .d.ts');
  assert.equal(esRaizAmbiente('x.ts', "declare global {\n interface Window { a: 1 }\n}\nexport {};"), true, 'declare global');
  assert.equal(esRaizAmbiente('x.ts', "  declare module 'foo' { export const v: number; }\nexport {};"), true, 'declare module');
  assert.equal(esRaizAmbiente('x.ts', 'declare const G: number;'), true, 'un script (sin import ni export): sus declaraciones son globales');
  assert.equal(esRaizAmbiente('x.ts', "import { a } from './a';\nexport const b = a;"), false, 'un módulo común no es ambiente');
  assert.equal(esRaizAmbiente('x.ts', 'export const b = 1;'), false);
});

test('sinLiteralesGrandes: reemplaza el literal grande de primer nivel (con as const / satisfies / export default) y deja lo demás', () => {
  const grande = (n: number) => `[${Array.from({ length: n }, (_, i) => `{ id: ${i}, t: 'x' }`).join(', ')}]`;
  const G = grande(2000);
  const uno = (src: string, min = 5000) => sinLiteralesGrandes(ts, src, 'x.ts', min);
  const a = uno(`export const A: Tipo[] = ${G};\nexport const chica = [1, 2, 3];\n`);
  assert.equal(a.literales, 1);
  assert.match(a.texto, /^export const A: Tipo\[\] = \[\] as any;\nexport const chica = \[1, 2, 3\];\n$/, 'el anotado de tipo queda, el literal chico también');
  assert.ok(a.caracteres > 5000);
  assert.match(uno(`export const B = {\n  datos: ${G},\n} as const;\n`).texto, /^export const B = \{\} as any;\n$/, 'as const se lleva puesto: {} as any as const no compila');
  assert.match(uno(`export const C = ${G} satisfies unknown[];\n`).texto, /^export const C = \[\] as any;\n$/, 'satisfies también');
  assert.match(uno(`export default ${G};\n`).texto, /^export default \[\] as any;\n$/, 'export default');
  assert.equal(uno(`export const D = Object.freeze(${G});\n`).literales, 0, 'dentro de una llamada no se toca (se dice en el encabezado)');
  assert.equal(uno(`function f() { const E = ${G}; return E; }\n`).literales, 0, 'tampoco lo que no es de primer nivel');
  assert.equal(uno('export const F = [1, 2, 3];\n', 5).literales, 1, 'el umbral es una cantidad de caracteres: [1, 2, 3] mide 9 y con un umbral de 5 se reemplaza');
  assert.equal(uno('export const F = [1, 2, 3];\n', 10).literales, 0, '…y con un umbral de 10 no');
  const tsx = sinLiteralesGrandes(ts, `export const T = ${G};\nexport const X = () => <div />;\n`, 'x.tsx', 5000);
  assert.match(tsx.texto, /export const X = \(\) => <div \/>;/, 'un .tsx se parsea como TSX');
  for (const salida of [a.texto, tsx.texto]) {
    const sf = ts.createSourceFile('x.tsx', salida, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal((sf as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics.length, 0, 'el resultado es TypeScript válido');
  }
});

test('aplicarSinLiteralesGrandes: sin CI ni el permiso no toca NADA; con el permiso modifica y restaura entero', () => {
  const grande = `export const D = [\n${Array.from({ length: 1500 }, (_, i) => `  { id: ${i}, n: 'curso ${i}' },`).join('\n')}\n];\n`;
  const dir = proyecto({ 'lib/datos.ts': grande, 'lib/chico.ts': 'export const c = [1];\n' });
  try {
    assert.equal(aplicarSinLiteralesGrandes(dir, ts, 20000, {}), null, 'sin CI y sin MEDIR_TIPOS_PERMITIR_STUBS no corre');
    assert.equal(readFileSync(join(dir, 'lib', 'datos.ts'), 'utf8'), grande, 'y no tocó nada');
    const r = aplicarSinLiteralesGrandes(dir, ts, 20000, { MEDIR_TIPOS_PERMITIR_STUBS: '1' });
    assert.ok(r && r.archivos === 1 && r.literales === 1, JSON.stringify(r));
    assert.equal(readFileSync(join(dir, 'lib', 'datos.ts'), 'utf8'), 'export const D = [] as any;\n');
    assert.equal(readFileSync(join(dir, 'lib', 'chico.ts'), 'utf8'), 'export const c = [1];\n', 'lo chico no se toca');
    r?.restaurar();
    assert.equal(readFileSync(join(dir, 'lib', 'datos.ts'), 'utf8'), grande, 'restaurado entero');
    assert.ok(aplicarSinLiteralesGrandes(dir, ts, 20000, { CI: 'true' }), 'en CI corre');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const AMBIENTES: Record<string, string> = {
  ...VARIAS_CARPETAS,
  // Tres formas de tipos que un archivo ve SIN importarlos: un `declare global` dentro de un módulo, un script con una declaración global y un .d.ts con `declare module`.
  'types/aug.ts': 'declare global {\n  interface Window { marca: string }\n}\nexport {};\n',
  'types/global-script.ts': 'declare const GLOBAL_Y: number;\n',
  'types/foo.d.ts': "declare module 'foo-sin-tipos' { export const v: number; }\n",
  'app/usa-global.ts': 'export const g: number = GLOBAL_Y;\nexport const m: string = window.marca;\n',
  'app/usa-foo.ts': "import { v } from 'foo-sin-tipos';\nexport const w: number = v;\n",
  'app/mal-global.ts': 'export const n: number = window.marca;\n',     // string → number: sólo da ESTE error si el declare global está en el programa
};
const porTandasCon = (dir: string, K: number, extra: string[]) => {
  const lineas: string[] = [];
  const codigos: (number | null)[] = [];
  const chequeados: number[] = [];
  const raices: number[] = [];
  const extras = new Set<string>();
  for (let i = 1; i <= K; i++) {
    const r = correr(dir, ['--expose-gc', TANDAS, '-p', 'tsconfig.json', '--tanda', `${i}/${K}`, ...extra]);
    codigos.push(r.status);
    lineas.push(...lineasDeError(`${r.stdout}${r.stderr}`));
    chequeados.push(Number(/^Files checked:\s+(\d+)/m.exec(r.stdout)?.[1] ?? NaN));
    raices.push(Number(/^Root files:\s+(\d+)/m.exec(r.stdout)?.[1] ?? NaN));
    for (const m of r.stdout.matchAll(/^EXTRA (.+)$/gm)) extras.add(m[1]);
  }
  return { codigos, lineas: [...new Set(lineas)].sort(), chequeados, raices, extras: [...extras].sort() };
};

test('DE PUNTA A PUNTA con --raices: la unión de las tandas da EXACTAMENTE las líneas del tsc, también con un declare global, un script y un .d.ts que otro archivo usa sin importar', () => {
  const dir = proyecto(AMBIENTES);
  try {
    const oraculo = tscReal(dir);
    assert.equal(oraculo.lineas.length, 4, `cuatro errores, uno de ellos el de mal-global (que sólo existe con el declare global): ${oraculo.lineas.join(' | ')}`);
    assert.ok(oraculo.lineas.some((l) => /mal-global\.ts.*TS2322/.test(l)), 'el tsc ve el declare global desde mal-global.ts sin importarlo');
    for (const K of [1, 2, 3, 5]) {
      const r = porTandasCon(dir, K, ['--raices']);
      assert.deepEqual(r.lineas, oraculo.lineas, `K=${K}: lo mismo que el tsc, con las raíces propias`);
      assert.equal(r.chequeados.reduce((a, n) => a + n, 0), 13, `K=${K}: los 13 fuentes se chequean una vez cada uno (sin pérdida de cobertura)`);
    }
    const r4 = porTandasCon(dir, 4, ['--raices']);
    const entero = porTandasCon(dir, 1, []);
    assert.ok(Math.max(...r4.raices) < entero.raices[0], `el programa de cada tanda parte de menos raíces (${r4.raices.join('/')} contra ${entero.raices[0]})`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Lo que el programa trae por IMPORT sin ser raíz de ninguna tanda: un .ts fuera del `include`, un .mjs (checkJs) y un .json. El tsc entero chequea los dos primeros; sin la regla de los «extras» las tandas por raíces no.
const CON_EXTRAS: Record<string, string> = {
  'app/a.ts': "import { e } from '../fuera/x';\nimport datos from '../datos.json';\nimport { h } from '../scripts/h.mjs';\nexport const s: string = datos.n;\nexport const t = [e, h];\n",
  'app/b.ts': "export const b: number = 'mal';\n",
  // x.ts entra por DOS tandas distintas: se chequea dos veces y su error sale una. Y c.ts importa a b.ts, que es raíz de OTRA tanda: b.ts está en el programa de la tanda de c pero NO es un extra (si lo fuera, cada tanda
  // chequearía todo lo que importa de las demás y el reparto no serviría de nada).
  'app/c.ts': "import { e } from '../fuera/x';\nimport { p } from 'pkg';\nimport { b } from './b';\nexport const c = [e, p, b];\n",
  'fuera/x.ts': "export const e: number = 'x';\n",
  // Un paquete que publica su fuente .ts: el tsc LO CHEQUEA (medido) y reporta sus errores, aunque sea de node_modules.
  'node_modules/pkg/package.json': '{ "name": "pkg", "version": "1.0.0", "main": "index.ts" }\n',
  'node_modules/pkg/index.ts': "export const p: number = 'mal en node_modules';\n",
  'datos.json': '{ "n": 1 }\n',
  'scripts/h.mjs': "// @ts-check\n/** @type {number} */\nexport const h = 'no es un número';\n",
};
const TSCONFIG_EXTRAS = { compilerOptions: { ...TSCONFIG.compilerOptions, allowJs: true, resolveJsonModule: true }, include: ['app/**/*.ts'] };

test('DE PUNTA A PUNTA con --raices: lo que el programa trae por import y NO es raíz (un .ts fuera del include, un .mjs) también se chequea, y la cobertura da lo mismo que el chequeo entero', () => {
  const dir = proyecto(CON_EXTRAS, TSCONFIG_EXTRAS);
  try {
    const oraculo = tscReal(dir);
    assert.equal(oraculo.lineas.length, 5, `cinco errores: a.ts (el json), b.ts, fuera/x.ts, scripts/h.mjs y node_modules/pkg/index.ts: ${oraculo.lineas.join(' | ')}`);
    for (const f of [/fuera[\\/]x\.ts/, /scripts[\\/]h\.mjs/, /node_modules[\\/]pkg[\\/]index\.ts/]) assert.ok(oraculo.lineas.some((l) => f.test(l)), `el tsc chequea lo que sólo entra por import: ${f}`);
    const entero = porTandasCon(dir, 1, []);
    assert.deepEqual(entero.lineas, oraculo.lineas);
    assert.equal(entero.chequeados[0], 6, 'el chequeo entero: las 3 raíces, x.ts, h.mjs y el .ts del paquete (el .json no da errores y no cuenta)');
    for (const K of [1, 2, 3, 4]) {
      const r = porTandasCon(dir, K, ['--raices']);
      assert.deepEqual(r.lineas, oraculo.lineas, `K=${K}: lo mismo que el tsc, con los archivos que sólo entran por import`);
      assert.equal(r.chequeados.reduce((a, n) => a + n, 0), 3, `K=${K}: las tres raíces, una vez cada una`);
      assert.deepEqual(r.extras, ['fuera/x.ts', 'node_modules/pkg/index.ts', 'scripts/h.mjs'], `K=${K}: los extras que alguna tanda trae, por su nombre y sin repetir`);
      assert.equal(r.chequeados.reduce((a, n) => a + n, 0) + r.extras.length, entero.chequeados[0], `K=${K}: la cobertura (raíces + extras sin repetir) es la del chequeo entero`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('con skipLibCheck: false el tsc SÍ chequea un .d.ts, y las tandas también (con o sin raíces): el .d.ts es código a chequear salvo que se lo saltee skipLibCheck', () => {
  const dir = proyecto({
    'app/a.ts': 'export const a: number = 1;\n',
    'app/b.ts': "export const b: number = 'mal';\n",
    'types/malo.d.ts': 'declare const DUP: number;\ndeclare const DUP: string;\n',     // TS2451 (redeclarar) dentro de un .d.ts
  }, { ...TSCONFIG, compilerOptions: { ...TSCONFIG.compilerOptions, skipLibCheck: false } });
  try {
    const oraculo = tscReal(dir);
    assert.ok(oraculo.lineas.some((l) => /types[\\/]malo\.d\.ts.*TS2451/.test(l)), `el tsc reporta el error del .d.ts con skipLibCheck: false: ${oraculo.lineas.join(' | ')}`);
    for (const K of [1, 2, 3]) {
      for (const modo of [[], ['--raices']]) assert.deepEqual(porTandasCon(dir, K, modo).lineas, oraculo.lineas, `K=${K} ${modo.join(' ') || 'entero'}: lo mismo que el tsc, el .d.ts incluido`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ⚠️ LO QUE EL CHECKER CACHEA (revisión del 21/10/2026, repros del Cerebro): TypeScript calcula algunos errores de forma perezosa y los cachea, y los atribuye al PRIMER sitio que dispara el cálculo. Si ese
// sitio está en un archivo de OTRA tanda, esa tanda lo descarta (no es suyo) y la tanda dueña ya no lo encuentra: la unión da menos errores que el tsc y el paso dice «OK». Pasó con TS2589 (una instanciación
// profunda, que este repo ya tuvo con supabase-js) y con TS2303 (un alias de re-export circular). El arreglo es chequear en el orden del PROGRAMA (el del tsc: las dependencias primero), que reparte en
// pedazos contiguos de ese orden: el primer sitio que dispara el cálculo es siempre del mismo pedazo o de uno anterior, y el dueño lo reporta al chequear su propio archivo.
const RELLENO = (n: number) => `//${'x'.repeat(n)}\n`;     // pesa lo mismo cada archivo: K = 4 los reparte de a dos, como en la repro
const PROFUNDO: Record<string, string> = {
  'a_g1.ts': `import { v1 } from './b_h1'; export const g1 = v1;\n${RELLENO(140)}`,
  'a_h0.ts': `import type { Rec } from './d_rec';\nexport const v0 = [null! as Rec<2000>][0];\n${RELLENO(118)}`,
  'b_g2.ts': `import { v0 } from './a_h0'; export const g2 = v0;\n${RELLENO(140)}`,
  'b_h1.ts': `import type { Rec } from './d_rec';\nexport const v1 = [null! as Rec<2000>][0];\n${RELLENO(118)}`,
  'c_1.ts': `export const c1 = 1;\n${RELLENO(170)}`,
  'c_2.ts': `export const c2 = 2;\n${RELLENO(170)}`,
  'd_1.ts': `export const d1 = 3;\n${RELLENO(170)}`,
  'd_rec.ts': `export type Rec<N extends number, A extends unknown[] = []> = A['length'] extends N ? A : Rec<N, [...A, 0]>;\n${RELLENO(88)}`,
};
const ALIAS_CIRCULAR: Record<string, string> = {
  'a_imp.ts': `import { x } from './bb2'; export const u = x;\n${RELLENO(150)}`,
  'aa2.ts': `export { x } from './bb2';\n${RELLENO(160)}`,
  'b_imp.ts': `import { x } from './aa2'; export const w = x;\n${RELLENO(150)}`,
  'bb2.ts': `export { x } from './aa2';\n${RELLENO(160)}`,
  'c_1.ts': `export const c_1 = 1;\n${RELLENO(170)}`,
  'c_2.ts': `export const c_2 = 1;\n${RELLENO(170)}`,
  'd_1.ts': `export const d_1 = 1;\n${RELLENO(170)}`,
  'd_2.ts': `export const d_2 = 1;\n${RELLENO(170)}`,
};

for (const [nombre, archivos, codigo] of [['TS2589 (instanciación profunda)', PROFUNDO, 'TS2589'], ['TS2303 (alias de re-export circular)', ALIAS_CIRCULAR, 'TS2303']] as const) {
  test(`un error que el checker cachea y atribuye a OTRO archivo, ${nombre}, no se pierde al repartir: ninguna tanda lo da por bueno (con o sin raíces) y con una sola tanda es el del tsc`, () => {
    const dir = proyecto(archivos);
    try {
      const oraculo = tscReal(dir);
      assert.equal(oraculo.codigo, 2, 'el tsc de verdad sale 2');
      assert.ok(oraculo.lineas.some((l) => l.includes(codigo)), `el tsc da ${codigo}: ${oraculo.lineas.join(' | ')}`);
      const una = porTandasCon(dir, 1, []);
      assert.deepEqual(una.lineas, oraculo.lineas, 'con una sola tanda se chequea en el orden del tsc y el error sale en el MISMO archivo y la MISMA línea');
      // Los códigos de error con su cantidad: «TS2303 ×1». Con raíces, dentro de un CICLO de imports el error puede salir en otro archivo de la misma tanda (el recorrido de un ciclo depende de por dónde se
      // entra, y cada tanda arma su programa con otras raíces): mismo código y misma cantidad, otro archivo. Lo que no puede pasar es que falte.
      const cuenta = (lineas: string[]) => { const m = new Map<string, number>(); for (const l of lineas) { const c = /error (TS\d+)/.exec(l)?.[1] ?? '?'; m.set(c, (m.get(c) ?? 0) + 1); } return m; };
      const faltanCodigos = (lineas: string[]) => [...cuenta(oraculo.lineas)].filter(([c, n]) => (cuenta(lineas).get(c) ?? 0) < n).map(([c]) => c);
      for (const K of [2, 3, 4, 5]) {
        for (const modo of [[], ['--raices']]) {
          const r = porTandasCon(dir, K, modo);
          const donde = `K=${K} ${modo.join(' ') || 'entero'}`;
          if (modo.length === 0) assert.deepEqual(oraculo.lineas.filter((l) => !r.lineas.includes(l)), [], `${donde}: la unión perdió una línea del tsc (códigos de salida ${r.codigos})`);
          assert.deepEqual(faltanCodigos(r.lineas), [], `${donde}: a los errores de las tandas les falta un código que el tsc da (códigos de salida ${r.codigos})`);
          assert.ok(r.codigos.includes(2), `${donde}: alguna tanda sale 2, como el tsc`);
        }
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test('ordenarPorPrograma: en el orden que dice el programa (no por nombre) y lo que no conoce, al final por nombre', () => {
  assert.deepEqual(ordenarPorPrograma(['b.ts', 'a.ts', 'c.ts'], ['c.ts', 'a.ts', 'x.ts', 'b.ts']), ['c.ts', 'a.ts', 'b.ts'], 'el orden del programa, ignorando lo que sobra');
  assert.deepEqual(ordenarPorPrograma(['z.ts', 'b.ts', 'a.ts', 'n2.ts', 'n1.ts'], ['z.ts', 'a.ts', 'b.ts']), ['z.ts', 'a.ts', 'b.ts', 'n1.ts', 'n2.ts'], 'un archivo que el programa no conoce (nuevo) va al final, por nombre');
  assert.deepEqual(ordenarPorPrograma([], ['a.ts']), []);
});

test('ordenDelPrograma: lo calcula y lo escribe la primera vez; las demás tandas lo leen; si es de otro proyecto o está roto, se recalcula', () => {
  const dir = proyecto({ 'a.ts': "import { b } from './b';\nexport const a = b;\n", 'b.ts': 'export const b = 1;\n' });
  try {
    const cwd = String(ts.sys.getCurrentDirectory());
    const parseado = ts.getParsedCommandLineOfConfigFile(join(dir, 'tsconfig.json'), {}, { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => undefined });
    const sinArchivo = ordenDelPrograma({ ts, parseado, cwd });
    const nombres = (l: string[]) => l.map((f) => f.replace(/\\/g, '/').split('/').pop());
    assert.deepEqual(nombres(sinArchivo).filter((n) => /^[ab]\.ts$/.test(n ?? '')), ['b.ts', 'a.ts'], 'el orden del tsc: b.ts (lo que a.ts importa) ANTES que a.ts, aunque por nombre sea al revés');
    const f = join(dir, 'orden.json');
    ordenDelPrograma({ ts, parseado, cwd, ordenArchivo: f });
    const escrito = JSON.parse(readFileSync(f, 'utf8')) as { version: number; cwd: string; archivos: string[] };
    assert.equal(escrito.version, 1);
    assert.equal(escrito.cwd, cwd);
    assert.deepEqual(escrito.archivos, sinArchivo, 'lo que escribe es lo que calculó');
    writeFileSync(f, JSON.stringify({ version: 1, cwd, archivos: ['/uno', '/otro'] }));
    assert.deepEqual(ordenDelPrograma({ ts, parseado, cwd, ordenArchivo: f }), ['/uno', '/otro'], 'si el archivo es de este proyecto, lo lee tal cual (no vuelve a parsear)');
    writeFileSync(f, JSON.stringify({ version: 1, cwd: '/otro/proyecto', archivos: ['/uno'] }));
    assert.deepEqual(ordenDelPrograma({ ts, parseado, cwd, ordenArchivo: f }), sinArchivo, 'uno de OTRO proyecto se descarta y se recalcula');
    writeFileSync(f, '{"version":1,"cwd"');
    assert.deepEqual(ordenDelPrograma({ ts, parseado, cwd, ordenArchivo: f }), sinArchivo, 'uno a medias (la corrida anterior murió escribiendo) también');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el CLI con --raices --orden: la primera tanda escribe el orden del programa y las demás lo LEEN (el reparto sigue el archivo)', () => {
  const dir = proyecto({ 'a.ts': "export const a: number = 'x';\n", 'b.ts': 'export const b = 1;\n', 'c.ts': 'export const c = 2;\n', 'd.ts': "export const d: number = 'y';\n" });
  try {
    const f = join(dir, 'orden.json');
    const tanda1 = () => correr(dir, ['--expose-gc', TANDAS, '-p', 'tsconfig.json', '--tanda', '1/2', '--raices', '--orden', f]);
    const primera = tanda1();
    assert.match(primera.stdout, /a\.ts.*TS2322/, `la tanda 1 de 2 chequea a.ts y b.ts (el orden del programa es el de los nombres acá): ${primera.stdout}${primera.stderr}`);
    assert.doesNotMatch(primera.stdout, /d\.ts.*TS2322/);
    const escrito = JSON.parse(readFileSync(f, 'utf8')) as { version: number; cwd: string; archivos: string[] };
    assert.equal(escrito.version, 1, 'la primera tanda dejó el orden en el archivo');
    const rutas = escrito.archivos.filter((a) => /[\\/][abcd]\.ts$/.test(a)).map((a) => a.replace(/^.*[\\/]/, ''));
    assert.deepEqual(rutas, ['a.ts', 'b.ts', 'c.ts', 'd.ts']);
    // Si la segunda tanda LEE el archivo, un orden dado vuelta le da otro pedazo: la tanda 1 pasa a ser d.ts y c.ts.
    writeFileSync(f, JSON.stringify({ ...escrito, archivos: [...escrito.archivos].reverse() }));
    const dada = tanda1();
    assert.match(dada.stdout, /d\.ts.*TS2322/, `con el orden dado vuelta la tanda 1 chequea d.ts: ${dada.stdout}${dada.stderr}`);
    assert.doesNotMatch(dada.stdout, /a\.ts.*TS2322/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('argumentosInvalidos: lo que el driver no entiende se dice (con el tsc se usaría; acá no se ignora en silencio) y el CLI sale 2', () => {
  assert.deepEqual(argumentosInvalidos(['-p', 'x.json', '--tanda', '1/4', '--raices', '--orden', 'o.json', '--pesos', 'p.json', '--medir', '--costos-out', 'c.json']), []);
  assert.deepEqual(argumentosInvalidos(['--strict']), ['--strict'], 'una opción del tsc que el driver no aplica');
  assert.deepEqual(argumentosInvalidos(['-p']), ['-p (sin valor)'], 'una que pide valor y no lo trae');
  assert.deepEqual(argumentosInvalidos(['--tanda', '--raices']), ['--tanda (sin valor)'], 'ni lo toma de la opción que sigue');
  const dir = proyecto({ 'a.ts': 'export const a = 1;\n' });
  try {
    const r = correr(dir, ['--expose-gc', TANDAS, '-p', 'tsconfig.json', '--strict']);
    assert.equal(r.status, 2, `${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /argumento\(s\) que no entiendo: --strict/);
    assert.equal(correr(dir, ['--expose-gc', TANDAS, '-p', 'tsconfig.json']).status, 0, 'y sin el argumento de más anda');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('con `declaration` o `composite` el driver FALLA (exit 3, y lo dice): el tsc pide además getDeclarationDiagnostics y las tandas darían OK donde el tsc da error', () => {
  const archivos = { 'a.ts': 'export function mk() { return class { private p = 1; }; }\n' };
  for (const opcion of [{ declaration: true }, { composite: true }]) {
    const dir = proyecto(archivos, { ...TSCONFIG, compilerOptions: { ...TSCONFIG.compilerOptions, ...opcion } });
    try {
      const tsc = tscReal(dir);
      assert.equal(tsc.codigo, 2, `el tsc de verdad da error con ${JSON.stringify(opcion)}: ${tsc.lineas.join(' | ')}`);
      assert.ok(tsc.lineas.some((l) => l.includes('TS4094')), 'TS4094: la clase anónima con miembros privados que no se puede declarar');
      const r = correr(dir, ['--expose-gc', TANDAS, '-p', 'tsconfig.json']);
      assert.equal(r.status, 3, `${JSON.stringify(opcion)}: ${r.stdout}${r.stderr}`);
      assert.match(r.stderr, /`declaration` o `composite`/);
      assert.equal(lineasDeError(r.stdout).length, 0, 'y no dice «OK» ni imprime nada que parezca un resultado');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('el programa por raíces SIN los ambientes daría errores que el tsc no da (por eso se agregan siempre): se ve rompiendo la regla', () => {
  const dir = proyecto(AMBIENTES);
  try {
    // Una tanda con SÓLO usa-global.ts como raíz y sin sus ambientes: sin el declare global y sin el script, el tsc diría TS2339 / TS2304 en un archivo que el tsc completo da por bueno.
    const cfg = join(dir, 'solo.json');
    writeFileSync(cfg, JSON.stringify({ ...TSCONFIG, include: undefined, files: ['app/usa-global.ts'] }));
    const r = correr(dir, [TSC, '-p', 'solo.json', '--noEmit']);
    assert.match(`${r.stdout}${r.stderr}`, /usa-global\.ts.*error TS(2304|2339)/, 'sin los ambientes hay errores falsos en usa-global.ts');
    assert.equal(tscReal(dir).lineas.filter((l) => /usa-global/.test(l)).length, 0, 'y el tsc entero no los da');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('DE PUNTA A PUNTA con --medir --costos-out y --pesos: el costo por archivo se escribe, el reparto lo usa, y la unión sigue siendo la del tsc', () => {
  const dir = proyecto(VARIAS_CARPETAS);
  try {
    const oraculo = tscReal(dir);
    const costos = join(dir, 'costos.json');
    const medido = correr(dir, ['--expose-gc', TANDAS, '-p', 'tsconfig.json', '--medir', '--costos-out', costos]);
    assert.ok([0, 2].includes(medido.status ?? -1), `${medido.stdout}${medido.stderr}`);
    const j = JSON.parse(readFileSync(costos, 'utf8')) as { version: number; archivos: Record<string, number> };
    assert.equal(j.version, 1);
    assert.deepEqual(Object.keys(j.archivos).sort(), ['app/dos/c.ts', 'app/dos/d.ts', 'app/uno/a.ts', 'app/uno/b.ts', 'lib/tipos.ts', 'lib/util.ts', 'tests/t1.test.ts', 'tests/t2.test.ts'], 'una entrada por fuente, con la ruta relativa');
    assert.ok(Object.values(j.archivos).every((n) => Number.isFinite(n) && n >= 0), 'cada costo es un número de tipos creados');
    const tiposTotales = Number(/^Types:\s+(\d+)/m.exec(medido.stdout)?.[1]);
    assert.ok(Object.values(j.archivos).reduce((a, n) => a + n, 0) <= tiposTotales, 'los costos son lo que crea CADA archivo (una suma que no pasa del total de tipos), no un contador acumulado');
    for (const K of [2, 3]) assert.deepEqual(porTandasCon(dir, K, ['--pesos', costos]).lineas, oraculo.lineas, `K=${K} con pesos: lo mismo que el tsc`);
    for (const K of [3, 4]) assert.deepEqual(porTandasCon(dir, K, ['--raices', '--pesos', costos]).lineas, oraculo.lineas, `K=${K} con raíces y pesos: lo mismo que el tsc`);
    // Un archivo con un peso enorme queda SOLO en su tanda: el reparto sí mira los pesos.
    const sesgado = join(dir, 'sesgado.json');
    writeFileSync(sesgado, JSON.stringify({ version: 1, archivos: { ...j.archivos, 'app/dos/c.ts': 5_000_000 } }));
    const r = porTandasCon(dir, 3, ['--pesos', sesgado]);
    assert.equal(r.chequeados.reduce((a, n) => a + n, 0), 8, 'los 8 fuentes, una vez cada uno');
    assert.ok(r.chequeados.includes(1), `el archivo que pesa 5 M queda solo en su tanda: ${r.chequeados.join('/')}`);
    assert.ok(!porTandasCon(dir, 3, []).chequeados.includes(1), 'por bytes, en cambio, no queda ninguna tanda con un solo archivo');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('el workflow de medición corre SÓLO en la rama medir-tipos (o a mano), con permisos de lectura, y no avanza nada', () => {
  const wf = readFileSync(join(REPO, '.github', 'workflows', 'medir-tipos.yml'), 'utf8').replace(/\r\n/g, '\n');
  const codigo = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  assert.match(codigo, /branches:\s*\[medir-tipos\]/, 'sólo la rama medir-tipos');
  assert.doesNotMatch(codigo, /integracion|\bmain\b/, 'ni integracion ni main: no puede tocar el camino a producción');
  assert.match(codigo, /permissions:\s*\n\s+contents: read/, 'permisos de sólo lectura');
  assert.doesNotMatch(codigo, /git push|--force|contents: write/, 'no escribe nada en el repo');
  assert.match(codigo, /npx next typegen[\s\S]*scripts\/medir-tipos\.mjs/, 'genera los tipos de las rutas ANTES de medir (como integracion.yml)');
  assert.match(codigo, /timeout-minutes:\s*(\d+)/, 'tiene tope de tiempo');
  assert.ok(Number(/timeout-minutes:\s*(\d+)/.exec(codigo)?.[1]) <= 60, 'y es razonable: los minutos son plata');
  // Cada nombre de --solo es un experimento que existe (un error de tipeo se saltearía en silencio) y tandas-1 va antes que quien lee su costo por archivo.
  const solo = (/medir-tipos\.mjs --solo (\S+)/.exec(codigo)?.[1] ?? '').split(',').filter(Boolean);
  assert.ok(solo.length >= 3, `el workflow elige qué medir: ${solo.join(',')}`);
  for (const n of ['tandas-1', 'tandas-4', 'tandas-4-raices']) assert.ok(solo.includes(n), `la tercera medición compara ${n}: sin él el medidor no dice si la cobertura es ✔ ni cuánto baja el pico`);
  const conocidos = experimentos().map((e) => e.nombre);
  assert.deepEqual(solo.filter((n) => !conocidos.includes(n)), [], 'todos existen');
  for (const n of solo.filter((x) => experimentos().find((e) => e.nombre === x)?.pesos)) assert.ok(solo.indexOf('tandas-1') >= 0 && solo.indexOf('tandas-1') < solo.indexOf(n), `tandas-1 va antes que ${n}`);
});

// 4/11/2026: integracion.yml se retiró; el paso «Tipos» que frena una subida es el de punta.yml (y el de sobre-main.yml, igual).
test('el paso «Tipos» de punta.yml pide las TANDAS que se midieron (4) y las entiende tipos-ci; y sigue sin tocar nada fuera del paso', () => {
  const wf = readFileSync(join(REPO, '.github', 'workflows', 'punta.yml'), 'utf8').replace(/\r\n/g, '\n');
  const codigo = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const paso = /- name: Tipos\n([\s\S]*?)(?=\n      - name: )/.exec(codigo)?.[1] ?? '';
  const pedido = /env:\s*\n\s+TIPOS_TANDAS: '(\d+)'/.exec(paso)?.[1];
  assert.ok(pedido, `el paso Tipos declara TIPOS_TANDAS en su env:\n${paso}`);
  assert.equal(tandasPedidas({ TIPOS_TANDAS: pedido }), 4, 'tipos-ci lo lee como 4 tandas: con 3 el pico (3.685 MB, 60 % del tope) queda justo y se pasa en una o dos semanas');
  assert.match(paso, /node scripts\/tipos-ci\.mjs/, 'sigue corriendo el script que dice qué pasó');
  assert.match(paso, /exit \$c/, 'y propaga su exit');
  assert.doesNotMatch(paso, /TIPOS_SOLO_TANDAS|TIPOS_HEAP_ENTERO_MB/, '«Tipos» es el tsc ENTERO: las tandas son sólo el respaldo si muere por memoria (OK PARCIAL); el paso no salta el entero ni le achica el heap');
  assert.ok(Number(/TIPOS_HEAP_MB: '(\d+)'/.exec(paso)?.[1]) > 8192, '«Tipos» es el tsc ENTERO con swap (las tandas son el respaldo si muere por memoria): el tope de heap pasa la RAM del runner');
  assert.doesNotMatch(codigo.replace(paso, ''), /TIPOS_TANDAS/, 'las tandas son sólo del paso «Tipos»: ningún otro paso las hereda');
});

test('el tsc de respaldo (tipos-respaldo.yml): CADA NOCHE, barato, sólo lectura, el tsc ENTERO (sin tandas) con swap — y no corre por push ni toca el camino a producción', () => {
  const wf = readFileSync(join(REPO, '.github', 'workflows', 'tipos-respaldo.yml'), 'utf8').replace(/\r\n/g, '\n');
  const codigo = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  // 4/11/2026: de semanal a CADA NOCHE, si entró algo a main desde el último veredicto (lo corre tests/semanal-tests-ci.test.ts).
  assert.match(codigo, /schedule:\s*\n\s+- cron: '\d+ \d+ \* \* \*'\n/, 'una vez por día, a una hora fija');
  assert.equal((codigo.match(/- cron:/g) ?? []).length, 1, 'un solo horario');
  assert.doesNotMatch(codigo, /^\s{2}(push|pull_request)\b/m, 'nunca por push ni por pull request: los minutos del mes son 2.000');
  assert.match(codigo, /permissions:\s*\n\s+contents: read/, 'sólo lectura');
  assert.doesNotMatch(codigo, /contents: write|git push|--force|gh pr|gh api -X/, 'no escribe nada');
  assert.ok(Number(/timeout-minutes:\s*(\d+)/.exec(codigo)?.[1]) <= 30, 'techo duro de 30 minutos: si se cuelga no se come el mes');
  // Qué decide ese primer paso (main contra el último veredicto) lo CORRE tests/semanal-tests-ci.test.ts con un gh de mentira.
  assert.doesNotMatch(codigo, /TIPOS_TANDAS|TIPOS_RAICES/, 'es el tsc ENTERO: sin tandas ni raíces (el de las tandas ya corre en cada subida)');
  assert.ok(Number(/TIPOS_HEAP_MB: '(\d+)'/.exec(codigo)?.[1]) > 8192, 'el tope de heap pasa de la RAM del runner (7,9 GB): hay swap');
  const orden = ['swapon', 'npx next typegen', 'node scripts/tipos-ci.mjs'].map((x) => codigo.indexOf(x));
  assert.ok(orden.every((i) => i >= 0), `los tres pasos están: ${orden}`);
  assert.ok(orden[1] < orden[2] && orden[0] < orden[2], 'los tipos de las rutas y el swap van ANTES del tsc');
  assert.match(codigo, /exit \$c/, 'el exit del paso es el de tipos-ci: un rojo avisa');
  const pasos = (codigo.split('\n    steps:\n')[1] ?? '').split('\n      - ').filter(Boolean);
  assert.ok(pasos.length >= 6, `los pasos: ${pasos.length}`);
  assert.match(pasos[0], /¿Hubo cambios desde el último veredicto\?/, 'el primero es el que mira si hubo cambios');
  assert.deepEqual(pasos.slice(1).filter((p) => !p.includes("if: steps.cambios.outputs.correr == 'si'")), [], 'todo paso que gasta minutos lleva el `if` de «hubo cambios»: sin cambios en la semana se factura 1 minuto');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura): 14 roturas, 14 rojas — dos salieron verdes en la primera pasada y se reforzaron.
//   el driver (7): un reparto que no es contiguo → 1 · lo semántico que se chequea aunque haya sintaxis rota → 1 · cada tanda que chequea todo → 1 · salir 1 en vez de 2 como el tsc → 1 · la memoria escrita en KiB → 1 ·
//     sin skipLibCheck en el reparto → 1 (verde la primera vez: `getSemanticDiagnostics` ya salta los .d.ts, así que sólo cambia el REPARTO; ahora se afirma que se reparten los 8 fuentes y ningún .d.ts) ·
//     sin los diagnósticos de opciones y globales → 1 (verde la primera vez: ninguna fixture tenía un error de OPCIONES del programa; ahora una con moduleResolution bundler y module commonjs).
//   el medidor (5): sin tandas-4 → 2 · «NO alcanza» que nunca se dice → 1 · los tests partidos que incluyen todo → 1 · el medidor que no borra sus tsconfig → 1 · el piso leído en KiB → 1.
//   el workflow de medición (2): que también corra en integracion → 1 · que pueda escribir → 1.
//   SEGUNDA MEDICIÓN, las palancas sobre el piso (23, 21/10 noche; cinco salieron verdes la primera vez: tres porque el patrón del test no incluía «raices» sin tilde, una porque el «modo» del log salía de lo que el experimento declara y no de los argumentos que pasó, una porque ningún caso
//     tenía una cobertura distinta): las raíces sin los ambientes → 1 · un declare global/module que no es ambiente → 1 · un script que no es ambiente → 1 · un .d.ts que no es ambiente → 1 · los .d.ts en el reparto → 1 · --raices que no se lee → 1 · el peso que ignora el costo → 2 ·
//     el promedio de un archivo nuevo → 1 · el tamaño que no desempata → 1 · un costo negativo que resta → 1 · leerPesos que acepta cualquier cosa → 1 · --costos-out que no escribe → 1 · el costo como contador acumulado → 1 · as const sin desenvolver → 1 · export default → 1 · aplicar sin permiso → 1 ·
//     sin restaurar → 2 · los balanceados que no leen los pesos → 1 · tandas-1 que no escribe los costos → 1 · la cobertura que no se compara → 1 · el tsconfig de types que no se borra → 1 · el workflow con tandas-1 después de quien lo lee → 1 · con un experimento que no existe → 1.
//   las tandas encendidas en integracion.yml (3, 21/10 tarde): 3 en vez de 4 → 1 · el env: sin declarar → 1 · un valor que no es un número → 1.
//   (tests/tipos-ci.test.ts: las tandas, 8 roturas más — ver su pie.)
//   LA COBERTURA DE LOS «EXTRAS» (21/10 tarde: lo que el programa trae por import y ninguna tanda toma como raíz — 16 .mjs, 10 .json y un .ts de node_modules en el repo real): 12 roturas, 12 rojas, DOS salieron verdes en la primera pasada:
//     los extras que no se suman a lo que chequea la tanda → 1 · lo de node_modules que no se chequea → 1 (el tsc de verdad SÍ lo chequea: medido) · los .json que cuentan como código → 1 · los .js/.mjs que no cuentan → 1 · los extras que no se imprimen → 1 ·
//     el bloque sin la fila → 1 · los «chequeados» que ya incluyen los extras → 1 · el medidor que no lee los EXTRA → 1 · que los cuenta repetidos → 1 · que los ignora → 1 ·
//     un archivo que es raíz de OTRA tanda y cuenta como extra → 1 (verde la primera vez: ninguna raíz importaba a otra; ahora c.ts importa b.ts) ·
//     un .d.ts que no cuenta como código → 1 (verde la primera vez Y ERA UN BUG REAL: con `skipLibCheck: false` el tsc chequea los .d.ts y las tandas los dejaban sin chequear; ahora hay un caso con un error en un .d.ts).
//   la tercera medición (medir-tipos.yml): sin tandas-4-raices → 1 · sin tandas-1 → 1.
//   EL ORDEN DEL PROGRAMA, --orden, declaration, argumentos y el respaldo semanal (21/10 tarde, revisión del Cerebro: 23 roturas, 23 rojas; 4 salieron verdes la primera vez y se reforzaron):
//     repartir por nombre en el modo entero → 2 · las candidatas de --raices por nombre → 1 · ordenarPorPrograma que no ordena → 1 y que pone lo desconocido primero → 1 · ordenDelPrograma que no lee el archivo → 1, que lee uno de OTRO proyecto → 1, que no lo escribe → 1 ·
//     declaration → 1 y composite → 1 que no frenan al driver · un argumento desconocido que se ignora → 1 y uno sin valor → 1 · --orden que no llega al driver → 1 (verde la primera vez: ningún test miraba el archivo; ahora el CLI lo escribe y la segunda tanda lo LEE) ·
//     el respaldo semanal que corre por push → 1, todos los días → 1, con tandas → 1, sin swap → 1, con permiso de escritura → 1 · tipos-ci que no pasa --orden → 1 y que no borra la carpeta → 1 (tests/tipos-ci.test.ts) · el aviso de OOM/matado/sin veredicto que no dice los errores reales → 3 (verdes la primera vez: el test juntaba el log y la anotación).
// =============================================================================

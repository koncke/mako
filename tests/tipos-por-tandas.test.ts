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
import { bloqueEstadisticas, chequearTanda, leerTanda, repartir } from '../scripts/tipos-por-tandas.mjs';
import { leerEstadisticas, tandasPedidas } from '../scripts/tipos-ci.mjs';
import { experimentos, leerProceso, resumenDeMedicion, tsconfigsPartidos } from '../scripts/medir-tipos.mjs';

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
const correr = (dir: string, args: string[]) => spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', timeout: 120_000 });
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
});

// ---------------------------------------------------------------------------------------------------------------------------------
// El medidor (scripts/medir-tipos.mjs): lo que se corre UNA vez en Actions para elegir el arreglo con un número
// ---------------------------------------------------------------------------------------------------------------------------------

test('leerProceso lee lo que sale de un proceso del tsc o de una tanda, y la curva y los puntos calientes', () => {
  const salida = [
    'CURVA tanda=1/1 chequeados=500 vivo_mb=2100', 'CALIENTE ms=4200 lib/nutricion.ts', 'CALIENTE ms=900 app/crm/actions.ts',
    'Tanda:                  1/3', 'Files:                  7723', 'Files checked:          1800', 'Types:                  2077874', 'Instantiations:         7254272',
    'Base memory used:       1887436K', 'Memory used:            3250000K', 'Max RSS:                3400 MB', 'Parse time:             14.20s', 'Bind time:              6.10s', 'Check time:             40.50s', '',
  ].join('\n');
  const p = leerProceso(salida);
  assert.equal(p.vivoMb, 3099);
  assert.equal(p.baseMb, 1800);
  assert.equal(p.rssMb, 3400);
  assert.equal(p.archivos, 7723);
  assert.equal(p.chequeados, 1800);
  assert.equal(p.chequeoS, 40.5);
  assert.deepEqual(p.curva, ['CURVA tanda=1/1 chequeados=500 vivo_mb=2100']);
  assert.equal(p.calientes.length, 2);
  const sinNada = leerProceso('FATAL ERROR: Reached heap limit\n');
  assert.equal(sinNada.vivoMb, null, 'un proceso que murió no tiene memoria viva: n/d, no 0');
  assert.equal(sinNada.baseMb, null);
});

test('experimentos y tsconfig partidos: las siete mediciones, y los dos programas que separan tests/ del resto', () => {
  const nombres = experimentos().map((e) => e.nombre);
  assert.deepEqual(nombres, ['tsc-real', 'tandas-1', 'tandas-2', 'tandas-3', 'tandas-4', 'partido-resto', 'partido-tests']);
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
  const sinDatos = resumenDeMedicion([{ nombre: 'tandas-1', K: 1, nota: '', procesos: [{ ...proc(0, null), vivoMb: null }] }], 6144).md;
  assert.match(sinDatos, /\| tandas-1 \| 1 \| ok \| n\/d \| n\/d \|/, 'sin medir se dice n/d, nunca 0');
});

test('DE PUNTA A PUNTA: medir-tipos corre los siete experimentos sobre un proyecto, deja una línea MEDIDA-TIPOS por proceso y limpia sus tsconfig', () => {
  const dir = proyecto(VARIAS_CARPETAS);
  try {
    const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'medir-tipos.mjs')], { cwd: REPO, encoding: 'utf8', timeout: 300_000, env: { ...process.env, MEDIR_TIPOS_PROYECTO: dir, GITHUB_STEP_SUMMARY: join(dir, 'resumen.md') } });
    assert.equal(r.status, 0, `${r.stdout}\n${r.stderr}`);
    const lineas = r.stdout.split('\n').filter((l) => l.startsWith('MEDIDA-TIPOS '));
    assert.equal(lineas.length, 1 + 1 + 2 + 3 + 4 + 1 + 1, 'uno por proceso: 1 + 1 + 2 + 3 + 4 + 1 + 1');
    assert.ok(lineas.every((l) => /vivo_mb=\d+/.test(l)), `todos miden la memoria viva:\n${lineas.join('\n')}`);
    assert.ok(lineas.every((l) => /estado=ok(\(con errores de tipos\))? /.test(l)), 'el proyecto tiene errores de tipos y eso no frena la medición: se anotan como ok');
    assert.ok(lineas.some((l) => /estado=ok\(con errores de tipos\)/.test(l)), 'y los procesos que chequean un archivo con error lo dicen');
    assert.match(r.stdout, /CALIENTE ms=\d+ /, 'los puntos calientes del chequeo entero');
    assert.match(r.stdout, /\| partido-tests \| 1 \|/, 'la tabla del resumen');
    assert.deepEqual(spawnSync('git', ['status', '--short', '--', 'tsconfig.medir-resto.json', 'tsconfig.medir-tests.json'], { cwd: dir, encoding: 'utf8' }).stdout, '', 'no deja los tsconfig partidos');
    for (const f of ['tsconfig.medir-resto.json', 'tsconfig.medir-tests.json']) assert.equal(spawnSync(process.execPath, ['-e', `process.exit(require('fs').existsSync(${JSON.stringify(join(dir, f))}) ? 1 : 0)`]).status, 0, `${f} se borró`);
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
});

test('el paso «Tipos» de integracion.yml pide las TANDAS que se midieron (4) y las entiende tipos-ci; y sigue sin tocar nada fuera del paso', () => {
  const wf = readFileSync(join(REPO, '.github', 'workflows', 'integracion.yml'), 'utf8').replace(/\r\n/g, '\n');
  const codigo = wf.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
  const paso = /- name: Tipos\n([\s\S]*?)(?=\n      - name: )/.exec(codigo)?.[1] ?? '';
  const pedido = /env:\s*\n\s+TIPOS_TANDAS: '(\d+)'/.exec(paso)?.[1];
  assert.ok(pedido, `el paso Tipos declara TIPOS_TANDAS en su env:\n${paso}`);
  assert.equal(tandasPedidas({ TIPOS_TANDAS: pedido }), 4, 'tipos-ci lo lee como 4 tandas: con 3 el pico (3.685 MB, 60 % del tope) queda justo y se pasa en una o dos semanas');
  assert.match(paso, /node scripts\/tipos-ci\.mjs/, 'sigue corriendo el script que dice qué pasó');
  assert.match(paso, /exit \$c/, 'y propaga su exit');
  assert.doesNotMatch(codigo.replace(paso, ''), /TIPOS_TANDAS/, 'las tandas son sólo del paso «Tipos»: ningún otro paso las hereda');
});

// =============================================================================
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026; se rompe UNA pieza, se corren estas pruebas, se restaura): 14 roturas, 14 rojas — dos salieron verdes en la primera pasada y se reforzaron.
//   el driver (7): un reparto que no es contiguo → 1 · lo semántico que se chequea aunque haya sintaxis rota → 1 · cada tanda que chequea todo → 1 · salir 1 en vez de 2 como el tsc → 1 · la memoria escrita en KiB → 1 ·
//     sin skipLibCheck en el reparto → 1 (verde la primera vez: `getSemanticDiagnostics` ya salta los .d.ts, así que sólo cambia el REPARTO; ahora se afirma que se reparten los 8 fuentes y ningún .d.ts) ·
//     sin los diagnósticos de opciones y globales → 1 (verde la primera vez: ninguna fixture tenía un error de OPCIONES del programa; ahora una con moduleResolution bundler y module commonjs).
//   el medidor (5): sin tandas-4 → 2 · «NO alcanza» que nunca se dice → 1 · los tests partidos que incluyen todo → 1 · el medidor que no borra sus tsconfig → 1 · el piso leído en KiB → 1.
//   el workflow de medición (2): que también corra en integracion → 1 · que pueda escribir → 1.
//   las tandas encendidas en integracion.yml (3, 21/10 tarde): 3 en vez de 4 → 1 · el env: sin declarar → 1 · un valor que no es un número → 1.
//   (tests/tipos-ci.test.ts: las tandas, 8 roturas más — ver su pie.)
// =============================================================================

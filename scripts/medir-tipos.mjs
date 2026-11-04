#!/usr/bin/env node
// =============================================================================
// medir-tipos.mjs — mide EN ACTIONS cómo se reparte la memoria del chequeo de tipos, para elegir el arreglo de fondo con un número
// =============================================================================
// POR QUÉ (21/10/2026): el paso «Tipos» pasó de ~2 GB a 5,06 GB de memoria viva en ocho días (run 203: `vivo_mb=5062` de 6.144, 7.723 archivos, 2,08 M de tipos, 7,25 M de instanciaciones). Hay arreglos de fondo
// posibles y cada uno se decide con UN número que esta PC no puede dar (hacen falta ≥ 7 GB libres y hay 1 con ~14 chats abiertos):
//   A. REPARTIR EL CHEQUEO EN TANDAS (scripts/tipos-por-tandas.mjs): cada proceso crea el programa entero —ese es el piso— y chequea sólo un pedazo. PRIMERA MEDICIÓN (run 39603272529): 2 tandas 4.102 MB,
//      3 tandas 3.685, 4 tandas 3.535 (contra 5.065 del tsc entero); el piso, 2.406 MB, es el 47 % del pico y no baja con más tandas.
//   B. PARTIR EL PROGRAMA en `tests/` y el resto: NO alcanza (el programa de los tests carga el 96 % de los archivos: 4.894 MB).
//   C. BAJAR EL PISO (la segunda medición): lo único que dura, porque crece con el repo. Tres palancas, cada una un experimento:
//        · `types-node`: `types: ['node']` en vez de los 30 `@types/*` que entran solos (¿cuánto del piso son tipos globales que nadie pidió?);
//        · `sin-literales`: los LITERALES GRANDES de datos (los cursos son `.ts`: objetos de decenas de KB) reemplazados por `{} as any` — cuánto del piso son datos y no código;
//        · `*-raices`: el programa de cada tanda con SÓLO sus archivos como raíces (más los ambientes), en vez de los 7,7 mil: el piso baja a lo que esa tanda necesita de verdad.
//   D. BALANCEAR las tandas por COSTO medido y no por bytes (`*-balanceadas`): la tanda 3 de 4 tenía 4,0 M de las 7,3 M de instanciaciones.
//   (E. Un runner con más RAM: plata de Martín. Sólo si estas no alcanzan.)
//
// Corre las mediciones UNA tras otra (la RAM del runner no da para dos) y deja: una línea `MEDIDA-TIPOS …` por proceso en el log, y un resumen en Markdown (GITHUB_STEP_SUMMARY). No falla por errores de tipos
// ni por un OOM: lo que se mide es justamente eso. `tandas-1` va PRIMERO porque escribe el costo por archivo que usan los `*-balanceadas`.
// ⚠️ `sin-literales` MODIFICA archivos del proyecto (los restaura al terminar): sólo corre en CI (o con MEDIR_TIPOS_PERMITIR_STUBS=1); en un checkout de trabajo no.
// Uso: node scripts/medir-tipos.mjs [--solo tsc-real,tandas-1,tandas-3,…]   (sin --solo corre TODO: ~50 min; el workflow elige los que hacen falta)
// =============================================================================

import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, tmpdir, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clasificar, leerEstadisticas, miles, topeDeHeapMb } from './tipos-ci.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
/** El proyecto que se mide: el repo (default) o, en las pruebas, uno de mentira (MEDIR_TIPOS_PROYECTO). Los scripts y el tsc son siempre los del repo. */
const PROYECTO = process.env.MEDIR_TIPOS_PROYECTO ?? RAIZ;
const TANDAS = join(RAIZ, 'scripts', 'tipos-por-tandas.mjs');
const TSC = join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc');
const require = createRequire(import.meta.url);
/** El costo por archivo (tipos creados al chequearlo) que escribe `tandas-1` y leen los `*-balanceadas`. */
const RUTA_COSTOS = join(tmpdir(), `medir-tipos-costos-${process.pid}.json`);

/** Lo que importa de la salida de UN proceso (del tsc o de una tanda). Puro: lo prueba un test. */
export function leerProceso(salida) {
  const e = leerEstadisticas(salida);
  const num = (nombre) => { const m = new RegExp(`^${nombre}:\\s+([\\d.]+)`, 'mi').exec(salida); return m ? Number(m[1]) : null; };
  const baseK = num('Base memory used');
  return {
    vivoMb: e.vivoMb,
    baseMb: baseK == null ? null : Math.round((baseK * 1000) / 1048576),
    rssMb: num('Max RSS'),
    archivos: e.archivos,
    raices: num('Root files'),
    chequeados: num('Files checked'),
    extras: [...salida.matchAll(/^EXTRA (.+)$/gm)].map((m) => m[1]),
    tipos: e.tipos,
    instanciaciones: e.instanciaciones,
    parseS: num('Parse time'),
    bindS: num('Bind time'),
    chequeoS: e.chequeoS,
    curva: [...salida.matchAll(/^CURVA .*$/gm)].map((m) => m[0]),
    calientes: [...salida.matchAll(/^CALIENTE .*$/gm)].map((m) => m[0]),
  };
}

/**
 * Los experimentos, EN EL ORDEN en que corren: nombre, cuántas tandas, qué tsconfig, y qué se prueba. `tsc-real` es el chequeo de siempre (la referencia: tiene que dar lo que da el paso «Tipos»).
 * `medir`: pide la curva y los puntos calientes, y escribe el costo por archivo. `raices`: el programa de cada tanda sólo con sus raíces. `pesos`: reparte por costo medido. `stub`: reemplaza los literales
 * grandes (modifica archivos: sólo en CI).
 * @returns {{ nombre: string, K: number, config: string, real?: boolean, medir?: boolean, raices?: boolean, pesos?: boolean, stub?: boolean, nota: string }[]}
 */
export function experimentos() {
  return [
    { nombre: 'tsc-real', K: 1, config: 'tsconfig.json', real: true, nota: 'el tsc de siempre (referencia: tiene que dar ~lo del paso «Tipos»)' },
    { nombre: 'tandas-1', K: 1, config: 'tsconfig.json', medir: true, nota: 'el chequeo entero con el driver por tandas (1/1): curva de memoria, los 25 archivos más lentos y el costo por archivo' },
    { nombre: 'tandas-2', K: 2, config: 'tsconfig.json', nota: '2 tandas' },
    { nombre: 'tandas-3', K: 3, config: 'tsconfig.json', nota: '3 tandas' },
    { nombre: 'tandas-4', K: 4, config: 'tsconfig.json', nota: '4 tandas (el respaldo de punta.yml)' },
    { nombre: 'partido-resto', K: 1, config: 'tsconfig.medir-resto.json', nota: 'SIN tests/ (app, lib, scripts…): el programa partido, mitad 1' },
    { nombre: 'partido-tests', K: 1, config: 'tsconfig.medir-tests.json', nota: 'SÓLO tests/ (con todo lo que importan): el programa partido, mitad 2' },
    { nombre: 'types-node', K: 1, config: 'tsconfig.medir-types.json', nota: "`types: ['node']`: sin los 30 @types/* que entran solos — el piso, ¿baja?" },
    { nombre: 'sin-literales', K: 1, config: 'tsconfig.json', stub: true, nota: 'los literales grandes de datos (≥ 20 KB) reemplazados por `{} as any`: cuánto del piso son datos' },
    { nombre: 'tandas-4-balanceadas', K: 4, config: 'tsconfig.json', pesos: true, nota: '4 tandas repartidas por COSTO medido (tandas-1) y no por bytes' },
    { nombre: 'tandas-4-raices', K: 4, config: 'tsconfig.json', raices: true, nota: '4 tandas, el programa de cada una sólo con SUS raíces (+ los ambientes)' },
    { nombre: 'tandas-4-raices-balanceadas', K: 4, config: 'tsconfig.json', raices: true, pesos: true, nota: '4 tandas: raíces propias Y reparto por costo' },
    { nombre: 'tandas-3-raices-balanceadas', K: 3, config: 'tsconfig.json', raices: true, pesos: true, nota: '3 tandas: raíces propias Y reparto por costo (¿alcanza con una menos?)' },
  ];
}

/** Los dos tsconfig del experimento B: extienden el del repo y sólo cambian qué archivos son «raíz». */
export function tsconfigsPartidos() {
  const base = ['next-env.d.ts', '.next/types/**/*.ts', '.next/dev/types/**/*.ts'];
  return {
    'tsconfig.medir-resto.json': { extends: './tsconfig.json', include: [...base, '**/*.ts', '**/*.tsx', '**/*.mts'], exclude: ['node_modules', 'tests'] },
    'tsconfig.medir-tests.json': { extends: './tsconfig.json', include: [...base, 'tests/**/*.ts', '**/*.d.ts'], exclude: ['node_modules'] },
  };
}

/** Todos los tsconfig que el medidor escribe (y borra al terminar): los partidos y el de `types: ['node']`. */
export function tsconfigsDeMedicion() {
  return { ...tsconfigsPartidos(), 'tsconfig.medir-types.json': { extends: './tsconfig.json', compilerOptions: { types: ['node'] } } };
}

// ---------------------------------------------------------------------------------------------------------------------------------
// «sin-literales»: cuánto del piso son DATOS
// ---------------------------------------------------------------------------------------------------------------------------------

/**
 * Reemplaza los literales GRANDES (objeto o arreglo, de `minChars` o más) que inicializan una variable de primer nivel, o que son un `export default`, por `{} as any` / `[] as any`. Un `as const`, un
 * `satisfies` o unos paréntesis alrededor del literal se llevan puestos (`{…} as const` → `{} as any`, que sí es válido). Lo que NO toca: un literal dentro de una llamada (`Object.freeze({…})`,
 * `defineX({…})`) ni los que no son de primer nivel. Puro (no escribe nada).
 * @param {any} ts
 * @param {string} texto
 * @param {string} nombre
 * @param {number} [minChars]
 * @returns {{ texto: string, literales: number, caracteres: number }}
 */
export function sinLiteralesGrandes(ts, texto, nombre, minChars = 20000) {
  const sf = ts.createSourceFile(nombre, texto, ts.ScriptTarget.Latest, true, /\.tsx$/.test(nombre) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  /** @type {[number, number, string][]} */
  const cortes = [];
  const desenvolver = (n) => {
    let x = n;
    while (ts.isAsExpression(x) || ts.isParenthesizedExpression(x) || ts.isTypeAssertionExpression(x) || (ts.isSatisfiesExpression && ts.isSatisfiesExpression(x))) x = x.expression;
    return x;
  };
  const proponer = (expr) => {
    const lit = desenvolver(expr);
    if (!ts.isObjectLiteralExpression(lit) && !ts.isArrayLiteralExpression(lit)) return;
    const ini = expr.getStart(sf);
    const fin = expr.getEnd();
    if (fin - ini >= minChars) cortes.push([ini, fin, ts.isArrayLiteralExpression(lit) ? '[] as any' : '{} as any']);
  };
  for (const st of sf.statements) {
    if (ts.isVariableStatement(st)) { for (const d of st.declarationList.declarations) if (d.initializer) proponer(d.initializer); }
    else if (ts.isExportAssignment(st)) proponer(st.expression);
  }
  let salida = texto;
  let caracteres = 0;
  for (const [ini, fin, por] of cortes.sort((a, b) => b[0] - a[0])) {
    salida = salida.slice(0, ini) + por + salida.slice(fin);
    caracteres += fin - ini - por.length;
  }
  return { texto: salida, literales: cortes.length, caracteres };
}

/** Los .ts/.tsx del proyecto (sin node_modules, .git ni .next), para recorrerlos. */
function fuentesDelProyecto(dir) {
  /** @type {string[]} */
  const salida = [];
  const andar = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name === '.next') continue;
      const ruta = join(d, e.name);
      if (e.isDirectory()) andar(ruta);
      else if (/\.(?:ts|tsx|mts)$/.test(e.name) && !/\.d\.[cm]?ts$/.test(e.name)) salida.push(ruta);
    }
  };
  andar(dir);
  return salida;
}

/**
 * Aplica `sinLiteralesGrandes` a todos los fuentes del proyecto, EN EL LUGAR, guardando el original para devolverlo. ⚠️ Modifica archivos: sólo corre en CI o con MEDIR_TIPOS_PERMITIR_STUBS=1.
 * @param {string} proyecto
 * @param {any} ts
 * @param {number} [minChars]
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ archivos: number, literales: number, caracteres: number, restaurar: () => void } | null} null si no se permite
 */
export function aplicarSinLiteralesGrandes(proyecto, ts, minChars = 20000, env = process.env) {
  if (!env.CI && env.MEDIR_TIPOS_PERMITIR_STUBS !== '1') return null;
  /** @type {Map<string, string>} */
  const originales = new Map();
  let literales = 0;
  let caracteres = 0;
  const restaurar = () => { for (const [ruta, texto] of originales) { try { writeFileSync(ruta, texto); } catch { /* ya no está */ } } originales.clear(); };
  try {
    for (const ruta of fuentesDelProyecto(proyecto)) {
      const texto = readFileSync(ruta, 'utf8');
      if (texto.length < minChars) continue;
      const r = sinLiteralesGrandes(ts, texto, ruta, minChars);
      if (!r.literales) continue;
      originales.set(ruta, texto);
      writeFileSync(ruta, r.texto);
      literales += r.literales;
      caracteres += r.caracteres;
    }
  } catch (e) { restaurar(); throw e; }
  return { archivos: originales.size, literales, caracteres, restaurar };
}

/**
 * El resumen en Markdown y una lectura mecánica de los números (NO decide: el criterio es «el pico por proceso, con tope de 6.144, no pasa del ~60 %»). Puro.
 * @param {{ nombre: string, K: number, nota: string, procesos: { i: number, estado: string, segundos: number, vivoMb: number | null, baseMb: number | null, rssMb: number | null, chequeados: number | null, archivos: number | null, extras?: string[] }[] }[]} resultados
 * @param {number} topeMb
 */
export function resumenDeMedicion(resultados, topeMb) {
  const max = (xs) => xs.reduce((a, x) => (x == null ? a : a == null || x > a ? x : a), /** @type {number | null} */ (null));
  const filas = resultados.map((r) => {
    const estados = [...new Set(r.procesos.map((p) => p.estado))].join('/');
    const pico = max(r.procesos.map((p) => p.vivoMb));
    const piso = max(r.procesos.map((p) => p.baseMb));
    const segundos = r.procesos.reduce((a, p) => a + p.segundos, 0);
    // Los chequeados de cada tanda (su pedazo) más los EXTRA que cada una trae por import sin ser raíz de nadie, contados UNA vez aunque dos tandas los chequeen (por nombre).
    const chequeados = r.procesos.every((p) => p.chequeados != null)
      ? r.procesos.reduce((a, p) => a + (p.chequeados ?? 0), 0) + new Set(r.procesos.flatMap((p) => p.extras ?? [])).size
      : null;
    return { ...r, estados, pico, piso, segundos, chequeados };
  });
  const pct = (n) => (n == null ? 'n/d' : `${Math.round((n / topeMb) * 100)} %`);
  const md = [
    `**Medición de la memoria del chequeo de tipos** · tope ${miles(topeMb)} MB · RAM ${miles(totalmem() / 1048576)} MB · ${cpus().length} CPU`,
    '',
    '| experimento | tandas | estado | pico vivo (MB) | % del tope | piso: programa atado (MB) | segundos (suma) |',
    '|---|---|---|---|---|---|---|',
    ...filas.map((f) => `| ${f.nombre} | ${f.K} | ${f.estados} | ${f.pico == null ? 'n/d' : miles(f.pico)} | ${pct(f.pico)} | ${f.piso == null ? 'n/d' : miles(f.piso)} | ${Math.round(f.segundos)} |`),
    '',
  ];
  const completo = filas.find((f) => f.nombre === 'tandas-1') ?? filas.find((f) => f.nombre === 'tsc-real');
  const lecturas = [];
  const menos = (a, b) => `${a > b ? '+' : '−'}${miles(Math.abs(a - b))} MB (${a > b ? '+' : '−'}${Math.round((Math.abs(a - b) / b) * 100)} %)`;
  if (completo?.pico != null) {
    for (const f of filas.filter((x) => /^tandas-\d+$/.test(x.nombre) && x.K > 1 && x.pico != null)) {
      lecturas.push(`- ${f.K} tandas: pico ${miles(f.pico ?? 0)} MB (${pct(f.pico)} del tope) contra ${miles(completo.pico)} MB del chequeo entero → ${Math.round((1 - (f.pico ?? 0) / completo.pico) * 100)} % menos; el tiempo suma ${Math.round(f.segundos)} s contra ${Math.round(completo.segundos)} s.`);
    }
    const resto = filas.find((f) => f.nombre === 'partido-resto');
    const tests = filas.find((f) => f.nombre === 'partido-tests');
    if (resto?.pico != null && tests?.pico != null) {
      lecturas.push(`- Partir en tests/ y el resto: picos ${miles(resto.pico)} y ${miles(tests.pico)} MB (el mayor, ${pct(Math.max(resto.pico, tests.pico))} del tope) contra ${miles(completo.pico)} MB: ${Math.max(resto.pico, tests.pico) > 0.85 * completo.pico ? 'NO alcanza (el programa de los tests arrastra casi todo)' : 'sí baja el pico'}.`);
    }
    if (completo.piso != null) lecturas.push(`- El piso (programa creado y atado, sin chequear un archivo) es ${miles(completo.piso)} MB: ${Math.round((completo.piso / completo.pico) * 100)} % del pico. Ninguna tanda puede pedir menos que eso, salvo con --raices.`);
    // Las palancas sobre el piso, contra el chequeo entero (mismo K=1): el piso y el pico.
    for (const nombre of ['types-node', 'sin-literales']) {
      const f = filas.find((x) => x.nombre === nombre);
      if (f?.pico != null && f.piso != null && completo.piso != null) lecturas.push(`- \`${nombre}\`: piso ${miles(f.piso)} MB (${menos(f.piso, completo.piso)} contra ${miles(completo.piso)}), pico ${miles(f.pico)} MB (${menos(f.pico, completo.pico)}).`);
    }
  }
  // Las variantes de tandas, contra la misma cantidad de tandas por bytes de la misma corrida (si está) y contra el criterio.
  for (const f of filas.filter((x) => /^tandas-(\d+)-/.test(x.nombre) && x.pico != null)) {
    const plano = filas.find((x) => x.nombre === `tandas-${f.K}`);
    const cobertura = completo?.chequeados != null && f.chequeados != null ? (f.chequeados === completo.chequeados ? `cobertura ✔ (${miles(f.chequeados)} archivos chequeados, los mismos que el chequeo entero)` : `⚠️ COBERTURA DISTINTA: ${miles(f.chequeados)} archivos chequeados contra ${miles(completo.chequeados)} del chequeo entero`) : '';
    lecturas.push(`- \`${f.nombre}\`: pico ${miles(f.pico ?? 0)} MB (${pct(f.pico)} del tope)${plano?.pico != null ? `, ${menos(f.pico ?? 0, plano.pico)} contra ${f.K} tandas por bytes (${miles(plano.pico)})` : ''}; piso por tanda hasta ${f.piso == null ? 'n/d' : miles(f.piso)} MB; ${Math.round(f.segundos)} s en total. ${cobertura}`.trim());
  }
  if (lecturas.length) md.push('**Lectura mecánica**', '', ...lecturas, '');
  return { md: md.join('\n'), filas };
}

/** `orden`: el archivo donde la primera tanda de un experimento por raíces deja el orden del programa entero y las demás lo leen (como en tipos-ci). */
function correr(exp, i, topeMb, orden = null) {
  const extra = [];
  if (exp.medir) extra.push('--medir', '--costos-out', RUTA_COSTOS);
  if (exp.raices) extra.push('--raices', ...(orden ? ['--orden', orden] : []));
  if (exp.pesos) extra.push('--pesos', RUTA_COSTOS);
  const args = exp.real
    ? [`--max-old-space-size=${topeMb}`, '--expose-gc', TSC, '-p', exp.config, '--noEmit', '--extendedDiagnostics']
    : [`--max-old-space-size=${topeMb}`, '--expose-gc', TANDAS, '-p', exp.config, '--tanda', `${i}/${exp.K}`, ...extra];
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: PROYECTO, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: 25 * 60 * 1000 });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const c = clasificar({ status: r.error ? null : r.status, signal: r.signal, salida });
  const segundos = (Date.now() - t0) / 1000;
  const p = leerProceso(salida);
  const estado = c.estado === 'errores' ? 'ok(con errores de tipos)' : c.estado;
  // El modo sale de los argumentos que de verdad se pasaron (no de lo que el experimento declara): si falta uno, el log lo dice.
  const modo = exp.real ? 'tsc' : [extra.includes('--raices') ? 'raices' : null, extra.includes('--pesos') ? 'pesos' : null].filter(Boolean).join('+') || 'bytes';
  process.stdout.write(`MEDIDA-TIPOS exp=${exp.nombre} tanda=${i}/${exp.K} modo=${modo} estado=${estado} segundos=${Math.round(segundos)} vivo_mb=${p.vivoMb ?? 'n/d'} base_mb=${p.baseMb ?? 'n/d'} rss_mb=${p.rssMb ?? 'n/d'} archivos=${p.archivos ?? 'n/d'} raices=${p.raices ?? 'n/d'} chequeados=${p.chequeados ?? 'n/d'} extras=${p.extras.length} tipos=${p.tipos ?? 'n/d'} instanciaciones=${p.instanciaciones ?? 'n/d'} parse_s=${p.parseS ?? 'n/d'} bind_s=${p.bindS ?? 'n/d'} chequeo_s=${p.chequeoS ?? 'n/d'}\n`);
  for (const l of [...p.curva, ...p.calientes]) process.stdout.write(`${l}\n`);
  for (const e of p.extras.slice(0, 40)) process.stdout.write(`EXTRA ${e}\n`);
  if (c.estado === 'sin-memoria' || c.estado === 'matado' || c.estado === 'sin-chequear') process.stdout.write(`  (cola de la salida) ${salida.slice(-600).replace(/\n/g, ' ⏎ ')}\n`);
  return { i, estado, segundos, vivoMb: p.vivoMb, baseMb: p.baseMb, rssMb: p.rssMb, chequeados: p.chequeados, archivos: p.archivos, extras: p.extras };
}

function main(argv) {
  const solo = argv.includes('--solo') ? new Set((argv[argv.indexOf('--solo') + 1] ?? '').split(',')) : null;
  const topeMb = topeDeHeapMb({ totalMb: totalmem() / 1048576, env: process.env });
  process.stdout.write(`medir-tipos: ${cpus().length} CPU, ${miles(totalmem() / 1048576)} MB de RAM · tope de heap ${miles(topeMb)} MB\n`);
  const configs = tsconfigsDeMedicion();
  for (const [nombre, contenido] of Object.entries(configs)) writeFileSync(join(PROYECTO, nombre), JSON.stringify(contenido, null, 2));
  const resultados = [];
  const carpetaOrden = mkdtempSync(join(tmpdir(), 'medir-tipos-orden-'));
  try {
    for (const exp of experimentos()) {
      if (solo && !solo.has(exp.nombre)) continue;
      process.stdout.write(`\n=== ${exp.nombre}: ${exp.nota} ===\n`);
      if (exp.pesos && !existsSync(RUTA_COSTOS)) { process.stdout.write('  (salteado: necesita los costos por archivo que escribe tandas-1, y tandas-1 no corrió o no los escribió)\n'); continue; }
      let stub = null;
      if (exp.stub) {
        stub = aplicarSinLiteralesGrandes(PROYECTO, require('typescript'));
        if (!stub) { process.stdout.write('  (salteado: modifica archivos del proyecto y sólo corre en CI o con MEDIR_TIPOS_PERMITIR_STUBS=1)\n'); continue; }
        process.stdout.write(`STUBS archivos=${stub.archivos} literales=${stub.literales} caracteres_quitados=${stub.caracteres}\n`);
      }
      try {
        const procesos = [];
        for (let i = 1; i <= exp.K; i++) procesos.push(correr(exp, i, topeMb, exp.raices ? join(carpetaOrden, `${exp.nombre}.json`) : null));
        resultados.push({ nombre: exp.nombre, K: exp.K, nota: exp.nota, procesos });
      } finally { stub?.restaurar(); }
    }
  } finally {
    for (const nombre of Object.keys(configs)) rmSync(join(PROYECTO, nombre), { force: true });
    rmSync(RUTA_COSTOS, { force: true });
    rmSync(carpetaOrden, { recursive: true, force: true });
  }
  const { md } = resumenDeMedicion(resultados, topeMb);
  process.stdout.write(`\n${md}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) { try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`); } catch { /* el log ya lo dijo */ } }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));

#!/usr/bin/env node
// =============================================================================
// medir-tipos.mjs — mide EN ACTIONS cómo se reparte la memoria del chequeo de tipos, para elegir el arreglo de fondo con un número
// =============================================================================
// POR QUÉ (21/10/2026): el paso «Tipos» pasó de ~2 GB a 5,06 GB de memoria viva en ocho días (run 203: `vivo_mb=5062` de 6.144, 7.723 archivos, 2,08 M de tipos, 7,25 M de instanciaciones). Hay tres arreglos de fondo
// posibles y cada uno se decide con UN número que esta PC no puede dar (hacen falta ≥ 7 GB libres y hay 1 con ~14 chats abiertos):
//   A. REPARTIR EL CHEQUEO EN TANDAS (scripts/tipos-por-tandas.mjs): cada proceso crea el programa entero —ese es el piso— y chequea sólo un pedazo. Sirve si `base_mb` (programa atado, sin chequear nada) es
//      bastante menor que `vivo_mb` completo, y si los tipos que cada tanda instancia no se solapan casi todos. Se mide para K = 2, 3 y 4.
//   B. PARTIR EL PROGRAMA en `tests/` y el resto (dos tsconfig, dos pasos): sirve sólo si el programa de los tests NO arrastra casi todo el resto (los hubs de lib/ los importan 500 tests). Se mide.
//   C. BUSCAR QUÉ INFLA LOS TIPOS: los 25 archivos que más tardan en chequearse (con una sola tanda) y la curva de memoria cada ~500 archivos dicen si es un puñado de archivos o volumen parejo.
//   (D. Un runner con más RAM: plata de Martín. Sólo si estas tres no alcanzan.)
//
// Corre las mediciones UNA tras otra (la RAM del runner no da para dos) y deja: una línea `MEDIDA-TIPOS …` por proceso en el log, y un resumen en Markdown (GITHUB_STEP_SUMMARY). No falla por errores de tipos
// ni por un OOM: lo que se mide es justamente eso. Tarda ~15 min (se corre UNA vez, desde .github/workflows/medir-tipos.yml).
// Uso: node scripts/medir-tipos.mjs [--solo tsc-real,tandas-1,tandas-3,…]
// =============================================================================

import { spawnSync } from 'node:child_process';
import { appendFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clasificar, leerEstadisticas, miles, topeDeHeapMb } from './tipos-ci.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
/** El proyecto que se mide: el repo (default) o, en las pruebas, uno de mentira (MEDIR_TIPOS_PROYECTO). Los scripts y el tsc son siempre los del repo. */
const PROYECTO = process.env.MEDIR_TIPOS_PROYECTO ?? RAIZ;
const TANDAS = join(RAIZ, 'scripts', 'tipos-por-tandas.mjs');
const TSC = join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc');

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
    chequeados: num('Files checked'),
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
 * Los experimentos: nombre, cuántas tandas, qué tsconfig, y si pide la curva y los puntos calientes. `tsc-real` es el chequeo de siempre (la referencia: tiene que dar lo que da el paso «Tipos»).
 * @returns {{ nombre: string, K: number, config: string, real?: boolean, medir?: boolean, nota: string }[]}
 */
export function experimentos() {
  return [
    { nombre: 'tsc-real', K: 1, config: 'tsconfig.json', real: true, nota: 'el tsc de siempre (referencia: tiene que dar ~lo del paso «Tipos»)' },
    { nombre: 'tandas-1', K: 1, config: 'tsconfig.json', medir: true, nota: 'el chequeo entero con el driver por tandas (1/1): curva de memoria y los 25 archivos más lentos' },
    { nombre: 'tandas-2', K: 2, config: 'tsconfig.json', nota: '2 tandas' },
    { nombre: 'tandas-3', K: 3, config: 'tsconfig.json', nota: '3 tandas' },
    { nombre: 'tandas-4', K: 4, config: 'tsconfig.json', nota: '4 tandas' },
    { nombre: 'partido-resto', K: 1, config: 'tsconfig.medir-resto.json', nota: 'SIN tests/ (app, lib, scripts…): el programa partido, mitad 1' },
    { nombre: 'partido-tests', K: 1, config: 'tsconfig.medir-tests.json', nota: 'SÓLO tests/ (con todo lo que importan): el programa partido, mitad 2' },
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

/**
 * El resumen en Markdown y una lectura mecánica de los números (NO decide: el criterio es «el pico por proceso, con tope de 6.144, no pasa del ~60 %»). Puro.
 * @param {{ nombre: string, K: number, nota: string, procesos: { i: number, estado: string, segundos: number, vivoMb: number | null, baseMb: number | null, rssMb: number | null, chequeados: number | null, archivos: number | null }[] }[]} resultados
 * @param {number} topeMb
 */
export function resumenDeMedicion(resultados, topeMb) {
  const max = (xs) => xs.reduce((a, x) => (x == null ? a : a == null || x > a ? x : a), /** @type {number | null} */ (null));
  const filas = resultados.map((r) => {
    const estados = [...new Set(r.procesos.map((p) => p.estado))].join('/');
    const pico = max(r.procesos.map((p) => p.vivoMb));
    const piso = max(r.procesos.map((p) => p.baseMb));
    const segundos = r.procesos.reduce((a, p) => a + p.segundos, 0);
    return { ...r, estados, pico, piso, segundos };
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
  if (completo?.pico != null) {
    for (const f of filas.filter((x) => /^tandas-\d+$/.test(x.nombre) && x.K > 1 && x.pico != null)) {
      lecturas.push(`- ${f.K} tandas: pico ${miles(f.pico ?? 0)} MB (${pct(f.pico)} del tope) contra ${miles(completo.pico)} MB del chequeo entero → ${Math.round((1 - (f.pico ?? 0) / completo.pico) * 100)} % menos; el tiempo suma ${Math.round(f.segundos)} s contra ${Math.round(completo.segundos)} s.`);
    }
    const resto = filas.find((f) => f.nombre === 'partido-resto');
    const tests = filas.find((f) => f.nombre === 'partido-tests');
    if (resto?.pico != null && tests?.pico != null) {
      lecturas.push(`- Partir en tests/ y el resto: picos ${miles(resto.pico)} y ${miles(tests.pico)} MB (el mayor, ${pct(Math.max(resto.pico, tests.pico))} del tope) contra ${miles(completo.pico)} MB: ${Math.max(resto.pico, tests.pico) > 0.85 * completo.pico ? 'NO alcanza (el programa de los tests arrastra casi todo)' : 'sí baja el pico'}.`);
    }
    if (completo.piso != null) lecturas.push(`- El piso (programa creado y atado, sin chequear un archivo) es ${miles(completo.piso)} MB: ${Math.round((completo.piso / completo.pico) * 100)} % del pico. Ninguna tanda puede pedir menos que eso.`);
  }
  if (lecturas.length) md.push('**Lectura mecánica**', '', ...lecturas, '');
  return { md: md.join('\n'), filas };
}

function correr(exp, i, topeMb) {
  const args = exp.real
    ? [`--max-old-space-size=${topeMb}`, '--expose-gc', TSC, '-p', exp.config, '--noEmit', '--extendedDiagnostics']
    : [`--max-old-space-size=${topeMb}`, '--expose-gc', TANDAS, '-p', exp.config, '--tanda', `${i}/${exp.K}`, ...(exp.medir ? ['--medir'] : [])];
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { cwd: PROYECTO, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, timeout: 25 * 60 * 1000 });
  const salida = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const c = clasificar({ status: r.error ? null : r.status, signal: r.signal, salida });
  const segundos = (Date.now() - t0) / 1000;
  const p = leerProceso(salida);
  const estado = c.estado === 'errores' ? 'ok(con errores de tipos)' : c.estado;
  process.stdout.write(`MEDIDA-TIPOS exp=${exp.nombre} tanda=${i}/${exp.K} estado=${estado} segundos=${Math.round(segundos)} vivo_mb=${p.vivoMb ?? 'n/d'} base_mb=${p.baseMb ?? 'n/d'} rss_mb=${p.rssMb ?? 'n/d'} archivos=${p.archivos ?? 'n/d'} chequeados=${p.chequeados ?? 'n/d'} tipos=${p.tipos ?? 'n/d'} instanciaciones=${p.instanciaciones ?? 'n/d'} parse_s=${p.parseS ?? 'n/d'} bind_s=${p.bindS ?? 'n/d'} chequeo_s=${p.chequeoS ?? 'n/d'}\n`);
  for (const l of [...p.curva, ...p.calientes]) process.stdout.write(`${l}\n`);
  if (c.estado === 'sin-memoria' || c.estado === 'matado' || c.estado === 'sin-chequear') process.stdout.write(`  (cola de la salida) ${salida.slice(-600).replace(/\n/g, ' ⏎ ')}\n`);
  return { i, estado, segundos, vivoMb: p.vivoMb, baseMb: p.baseMb, rssMb: p.rssMb, chequeados: p.chequeados, archivos: p.archivos };
}

function main(argv) {
  const solo = argv.includes('--solo') ? new Set((argv[argv.indexOf('--solo') + 1] ?? '').split(',')) : null;
  const topeMb = topeDeHeapMb({ totalMb: totalmem() / 1048576, env: process.env });
  process.stdout.write(`medir-tipos: ${cpus().length} CPU, ${miles(totalmem() / 1048576)} MB de RAM · tope de heap ${miles(topeMb)} MB\n`);
  const partidos = tsconfigsPartidos();
  for (const [nombre, contenido] of Object.entries(partidos)) writeFileSync(join(PROYECTO, nombre), JSON.stringify(contenido, null, 2));
  const resultados = [];
  try {
    for (const exp of experimentos()) {
      if (solo && !solo.has(exp.nombre)) continue;
      process.stdout.write(`\n=== ${exp.nombre}: ${exp.nota} ===\n`);
      const procesos = [];
      for (let i = 1; i <= exp.K; i++) procesos.push(correr(exp, i, topeMb));
      resultados.push({ nombre: exp.nombre, K: exp.K, nota: exp.nota, procesos });
    }
  } finally {
    for (const nombre of Object.keys(partidos)) rmSync(join(PROYECTO, nombre), { force: true });
  }
  const { md } = resumenDeMedicion(resultados, topeMb);
  process.stdout.write(`\n${md}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) { try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`); } catch { /* el log ya lo dijo */ } }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2)));

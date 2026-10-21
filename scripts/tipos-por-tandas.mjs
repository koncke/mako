#!/usr/bin/env node
// =============================================================================
// tipos-por-tandas.mjs — el chequeo de tipos COMPLETO, repartido en tandas: cada tanda en su proceso, con su propio techo de memoria
// =============================================================================
// POR QUÉ EXISTE (21/10/2026): el paso «Tipos» de Actions pasó de ~2 GB a 5,06 GB de memoria VIVA en ocho días (2.048 MB el 13/10 → run 203: `vivo_mb=5062`, 82 % del tope de 6.144, 7.723 archivos, 2,08 M de
// tipos, 7,25 M de instanciaciones). El runner tiene 7,9 GB: subir el tope otra vez no es un plan, es esperar al próximo OOM (el tope ya subió cuatro veces en una semana). El tsc guarda en memoria TODO lo que
// instancia mientras chequea los 7.723 archivos; lo que sí se puede repartir es el chequeo.
//
// LA IDEA: el `tsc` de la línea de comandos crea UN programa y chequea TODOS sus archivos con UN `TypeChecker`, que no suelta nada de lo que cacheó. Pero un programa se puede crear entero (parsear y atar los
// 7.723 archivos: ese es el piso de memoria, no se puede repartir) y chequear sólo UN pedazo de sus archivos: `program.getSemanticDiagnostics(archivo)` instancia sólo los tipos que ese archivo necesita.
// Así, la tanda i de K crea el programa completo y chequea el i-ésimo pedazo (contiguo en el orden de las rutas, balanceado por tamaño de fuente: los archivos de una carpeta comparten imports, y ahí se
// reutilizan los tipos). Las tandas corren de a UNA (la RAM del runner no da para dos), y la unión de lo que dicen es lo que diría el tsc: cada archivo se chequea en exactamente una tanda.
//
// ⚠️ LO QUE ESTO NO ES: no es el tsc ni lo reemplaza en la PC. Usa la API pública de TypeScript (`createProgram`, `getSemanticDiagnostics`) y reproduce el orden de `tsc`: primero las opciones/sintaxis/globales (si hay
// alguno, no se chequea más: igual que el tsc), y sólo si no hay, lo semántico. tests/tipos-por-tandas.test.ts compara, sobre un proyecto con errores en varias tandas, que la unión de las tandas da LAS MISMAS líneas
// que el tsc de verdad.
//
// Uso: node --max-old-space-size=4096 --expose-gc scripts/tipos-por-tandas.mjs [-p tsconfig.json] [--tanda 1/3] [--medir]
//   --tanda i/K   la tanda i (desde 1) de K (default 1/1: el chequeo entero en un proceso, como el tsc)
//   --medir       además imprime la memoria viva cada ~500 archivos chequeados y los 25 archivos que más tardaron en chequearse (dónde se va el tiempo y los tipos)
// Salida: los errores, uno por línea, con el formato del tsc (`ruta(línea,col): error TSnnnn: …`), y al final un bloque con el estilo de `--extendedDiagnostics` (el mismo «Memory used» que lee
// scripts/tipos-ci.mjs) más `Base memory used` (programa creado y atado, sin chequear nada), `Tanda`, `Files checked`. Exit 0 sin errores, 2 con errores (como el tsc).
// =============================================================================

import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);

/**
 * Parte una lista ORDENADA de archivos en `tandas` pedazos contiguos de peso parecido (la tanda de cada archivo se decide por el centro de su peso acumulado). Puro: lo prueba un test.
 * @param {{ nombre: string, peso: number }[]} items
 * @param {number} tandas
 * @returns {string[][]}
 */
export function repartir(items, tandas) {
  const total = items.reduce((a, x) => a + x.peso, 0) || 1;
  const salida = Array.from({ length: tandas }, () => /** @type {string[]} */ ([]));
  let acumulado = 0;
  for (const it of items) {
    const i = Math.min(tandas - 1, Math.floor(((acumulado + it.peso / 2) / total) * tandas));
    salida[i].push(it.nombre);
    acumulado += it.peso;
  }
  return salida;
}

/** `1/3` → { i: 1, K: 3 } (null si no es una tanda válida). */
export function leerTanda(texto) {
  const m = /^(\d+)\/(\d+)$/.exec(texto ?? '');
  if (!m) return null;
  const i = Number(m[1]);
  const K = Number(m[2]);
  return i >= 1 && K >= 1 && i <= K ? { i, K } : null;
}

const mb = (bytes) => Math.round(bytes / 1048576);

/**
 * Crea el programa del tsconfig y chequea SU tanda. `ts` se inyecta en las pruebas; `gc` es `global.gc` si el proceso corre con --expose-gc.
 * @param {{ ts: any, config: string, tanda?: { i: number, K: number }, medir?: boolean, gc?: (() => void) | undefined }} p
 * @returns {{ lineas: string[], errores: number, estadisticas: Record<string, number | null>, curva: string[], calientes: string[], archivosDeLaTanda: string[] }}
 */
export function chequearTanda({ ts, config, tanda = { i: 1, K: 1 }, medir = false, gc }) {
  const t0 = Date.now();
  const anfitrion = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n')); } };
  const parseado = ts.getParsedCommandLineOfConfigFile(resolve(config), {}, anfitrion);
  if (!parseado) throw new Error(`no pude leer ${config}`);
  const programa = ts.createProgram({
    rootNames: parseado.fileNames,
    options: parseado.options,
    projectReferences: parseado.projectReferences,
    configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(parseado),
  });
  const tPrograma = Date.now();
  const formato = { getCurrentDirectory: () => ts.sys.getCurrentDirectory(), getCanonicalFileName: (f) => f, getNewLine: () => '\n' };
  const comoLineas = (diagnosticos) => ts.sortAndDeduplicateDiagnostics(diagnosticos).map((d) => ts.formatDiagnostic(d, formato).replace(/\n$/, ''));

  // El mismo orden que `tsc` (emitFilesAndReportErrors): configuración y sintaxis; sólo si no hay, opciones y globales; sólo si tampoco hay, lo semántico.
  // ⚠️ Los errores de CONFIGURACIÓN (una opción mal escrita) no cortan nada: el tsc los cuenta como «base» y sigue con lo demás. Los de sintaxis, opciones y globales sí: si hay alguno, no se chequea lo semántico.
  /** @type {any[]} */
  const todos = [...ts.getConfigFileParsingDiagnostics(parseado)];
  const base = todos.length;
  todos.push(...programa.getSyntacticDiagnostics());
  programa.getTypeChecker();     // ata TODOS los archivos: el piso de memoria de cualquier tanda
  if (todos.length === base) {
    todos.push(...programa.getOptionsDiagnostics(), ...programa.getGlobalDiagnostics());
  }
  gc?.();
  const baseMb = mb(process.memoryUsage().heapUsed);
  const tAtado = Date.now();

  const saltea = (sf) => (parseado.options.skipLibCheck && sf.isDeclarationFile) || (parseado.options.skipDefaultLibCheck && sf.hasNoDefaultLib);
  const candidatos = programa.getSourceFiles().filter((sf) => !saltea(sf)).sort((a, b) => (a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0));
  const reparto = repartir(candidatos.map((sf) => ({ nombre: sf.fileName, peso: sf.text.length + 1 })), tanda.K);
  const propios = new Set(reparto[tanda.i - 1]);
  const aChequear = candidatos.filter((sf) => propios.has(sf.fileName));

  const curva = [];
  const tiempos = [];
  if (todos.length === base) {
    let n = 0;
    for (const sf of aChequear) {
      const t = Date.now();
      todos.push(...programa.getSemanticDiagnostics(sf));
      if (medir) {
        tiempos.push([Date.now() - t, sf.fileName]);
        if (++n % 500 === 0) { gc?.(); curva.push(`CURVA tanda=${tanda.i}/${tanda.K} chequeados=${n} vivo_mb=${mb(process.memoryUsage().heapUsed)}`); }
      }
    }
  }
  const tChequeo = Date.now();
  gc?.();
  const vivoBytes = process.memoryUsage().heapUsed;
  const lineas = comoLineas(todos);
  const num = (nombre) => (typeof programa[nombre] === 'function' ? programa[nombre]() : null);
  const estadisticas = {
    files: programa.getSourceFiles().length,
    types: num('getTypeCount'),
    instantiations: num('getInstantiationCount'),
    symbols: num('getSymbolCount'),
    identifiers: num('getIdentifierCount'),
    baseMb,
    vivoMb: mb(vivoBytes),
    checked: aChequear.length,
    candidatos: candidatos.length,
    parseS: (tPrograma - t0) / 1000,
    bindS: (tAtado - tPrograma) / 1000,
    checkS: (tChequeo - tAtado) / 1000,
    totalS: (Date.now() - t0) / 1000,
    maxRssMb: mb(process.resourceUsage().maxRSS * 1024),
  };
  const calientes = tiempos.sort((a, b) => b[0] - a[0]).slice(0, 25).map(([ms, f]) => `CALIENTE ms=${ms} ${f}`);
  return { lineas, errores: lineas.filter((l) => /error TS\d+/.test(l)).length, estadisticas, curva, calientes, archivosDeLaTanda: aChequear.map((sf) => sf.fileName) };
}

/** El bloque final, con el estilo de `--extendedDiagnostics` (lo lee leerEstadisticas de scripts/tipos-ci.mjs). Puro. */
export function bloqueEstadisticas(e, tanda) {
  const fila = (nombre, valor) => `${`${nombre}:`.padEnd(24)}${valor}`;
  return [
    fila('Tanda', `${tanda.i}/${tanda.K}`),
    fila('Files', e.files),
    fila('Files checked', e.checked),
    ...(e.symbols == null ? [] : [fila('Symbols', e.symbols)]),
    ...(e.types == null ? [] : [fila('Types', e.types)]),
    ...(e.instantiations == null ? [] : [fila('Instantiations', e.instantiations)]),
    fila('Base memory used', `${Math.round(e.baseMb * 1048576 / 1000)}K`),
    fila('Memory used', `${Math.round(e.vivoMb * 1048576 / 1000)}K`),
    fila('Max RSS', `${e.maxRssMb} MB`),
    fila('Parse time', `${e.parseS.toFixed(2)}s`),
    fila('Bind time', `${e.bindS.toFixed(2)}s`),
    fila('Check time', `${e.checkS.toFixed(2)}s`),
    fila('Total time', `${e.totalS.toFixed(2)}s`),
  ];
}

function main(argv) {
  const ts = require('typescript');
  const pos = (nombres) => { const i = argv.findIndex((a) => nombres.includes(a)); return i >= 0 ? argv[i + 1] : undefined; };
  const config = pos(['-p', '--project']) ?? 'tsconfig.json';
  const tanda = leerTanda(pos(['--tanda']) ?? '1/1');
  if (!tanda) { process.stderr.write('  [tipos-por-tandas] --tanda tiene que ser i/K (p. ej. 1/3)\n'); return 2; }
  const r = chequearTanda({ ts, config, tanda, medir: argv.includes('--medir'), gc: typeof globalThis.gc === 'function' ? globalThis.gc : undefined });
  if (r.lineas.length) process.stdout.write(`${r.lineas.join('\n')}\n`);
  for (const l of [...r.curva, ...r.calientes]) process.stdout.write(`${l}\n`);
  process.stdout.write(`${bloqueEstadisticas(r.estadisticas, tanda).join('\n')}\n`);
  return r.lineas.length > 0 ? 2 : 0;     // 2 = lo que el tsc devuelve con errores (DiagnosticsPresent_OutputsGenerated), también con noEmit
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { process.stderr.write(`  [tipos-por-tandas] ${e?.stack ?? e}\n`); process.exit(3); }
}

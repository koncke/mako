#!/usr/bin/env node
// =============================================================================
// tipos-por-tandas.mjs — el chequeo de tipos COMPLETO, repartido en tandas: cada tanda en su proceso, con su propio techo de memoria
// =============================================================================
// POR QUÉ EXISTE (21/10/2026): el paso «Tipos» de Actions pasó de ~2 GB a 5,06 GB de memoria VIVA en ocho días (2.048 MB el 13/10 → run 203: `vivo_mb=5062`, 82 % del tope de 6.144, 7.723 archivos, 2,08 M de
// tipos, 7,25 M de instanciaciones). El runner tiene 7,9 GB: subir el tope otra vez no es un plan, es esperar al próximo OOM (el tope ya subió cuatro veces en una semana). El tsc guarda en memoria TODO lo que
// instancia mientras chequea los 7.723 archivos; lo que sí se puede repartir es el chequeo.
//
// LA IDEA: el `tsc` de la línea de comandos crea UN programa y chequea TODOS sus archivos con UN `TypeChecker`, que no suelta nada de lo que cacheó. Pero un programa se puede crear entero (parsear y atar los
// 7.723 archivos: ese es el piso de memoria) y chequear sólo UN pedazo de sus archivos: `program.getSemanticDiagnostics(archivo)` instancia sólo los tipos que ese archivo necesita.
// Así, la tanda i de K crea el programa completo y chequea el i-ésimo pedazo (contiguo en el orden de las rutas, balanceado por tamaño de fuente: los archivos de una carpeta comparten imports, y ahí se
// reutilizan los tipos). Las tandas corren de a UNA (la RAM del runner no da para dos), y la unión de lo que dicen es lo que diría el tsc: cada archivo se chequea en exactamente una tanda.
//
// DOS PALANCAS MÁS (medidas en Actions con medir-tipos.yml, 21/10/2026: el piso, 2.406 MB, era el 47 % del pico y las tandas no lo bajan):
//   · `--raices`: el programa de la tanda se crea sólo con SUS archivos como raíces (más los ambientes) en vez de los 7.7 mil: tsc carga lo que esos archivos importan y NADA más. El piso baja a lo que la tanda
//     necesita de verdad. Lo que NO se puede perder: los `.d.ts`, los archivos con `declare module` / `declare global` y los que son «scripts» (sin import ni export) se agregan SIEMPRE como raíces, porque
//     alteran los tipos de archivos que no los importan (el caso de TipTap de scripts/tsc-acotado.mjs). Un archivo que se importa pero no es raíz de ninguna tanda NO se chequea: en este repo no hay (el include es
//     `**/*.ts`), y el medidor cuenta los archivos chequeados de todas las tandas contra los del tsc entero para que no pase en silencio.
//   · `--pesos <json>`: el reparto por COSTO medido (tipos creados al chequear cada archivo, de `--medir --costos-out`) y no por tamaño de fuente: la tanda 3 de 4 tenía 4,0 M de las 7,3 M de instanciaciones.
//
// ⚠️ LO QUE ESTO NO ES: no es el tsc ni lo reemplaza en la PC. Usa la API pública de TypeScript (`createProgram`, `getSemanticDiagnostics`) y reproduce el orden de `tsc`: primero las opciones/sintaxis/globales (si hay
// alguno, no se chequea más: igual que el tsc), y sólo si no hay, lo semántico. tests/tipos-por-tandas.test.ts compara, sobre un proyecto con errores en varias tandas, que la unión de las tandas da LAS MISMAS líneas
// que el tsc de verdad (también con --raices y --pesos, y con un `declare global` que otro archivo necesita sin importarlo).
//
// Uso: node --max-old-space-size=4096 --expose-gc scripts/tipos-por-tandas.mjs [-p tsconfig.json] [--tanda 1/3] [--raices] [--pesos costos.json] [--medir [--costos-out costos.json]]
//   --tanda i/K       la tanda i (desde 1) de K (default 1/1: el chequeo entero en un proceso, como el tsc)
//   --raices          el programa de la tanda sólo con sus raíces (ver arriba)
//   --pesos <json>    reparte por costo (el archivo que escribe --costos-out); un archivo que no está en el json pesa el promedio
//   --medir           además imprime la memoria viva cada ~500 archivos chequeados y los 25 archivos que más tardaron en chequearse (dónde se va el tiempo y los tipos)
//   --costos-out <j>  (con --medir) escribe cuántos tipos creó el chequeo de cada archivo: es el peso del reparto por costo
// Salida: los errores, uno por línea, con el formato del tsc (`ruta(línea,col): error TSnnnn: …`), y al final un bloque con el estilo de `--extendedDiagnostics` (el mismo «Memory used» que lee
// scripts/tipos-ci.mjs) más `Base memory used` (programa creado y atado, sin chequear nada), `Tanda`, `Files checked`. Exit 0 sin errores, 2 con errores (como el tsc).
// =============================================================================

import { createRequire } from 'node:module';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
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

/** Los bytes de fuente que valen lo mismo que un tipo creado al chequear, en el peso de un archivo (el tamaño desempata los archivos que no crean nada). */
export const BYTES_POR_PESO = 300;

/**
 * El peso de un archivo en el reparto. Sin `pesos`: su tamaño. Con `pesos` (el json de `--costos-out`): los tipos que creó su chequeo MÁS su tamaño a razón de un tipo cada 300 bytes (así
 * un archivo que no crea nada no pesa 0); un archivo que no está en el json (uno nuevo) pesa el promedio de los que sí. Puro.
 * @param {string} relativo ruta relativa al cwd, con `/`
 * @param {number} bytes
 * @param {{ archivos: Record<string, number>, promedio: number } | null} pesos
 */
export function pesoDe(relativo, bytes, pesos) {
  if (!pesos) return bytes + 1;
  const tipos = pesos.archivos[relativo];
  return (Number.isFinite(tipos) ? Math.max(0, tipos) : pesos.promedio) + bytes / BYTES_POR_PESO + 1;
}

/** Lee el json de `--costos-out` ({ version, archivos: { ruta: tiposCreados } }) y le suma el promedio. Tira si no tiene la forma. */
export function leerPesos(texto) {
  const j = JSON.parse(texto);
  if (!j || j.version !== 1 || typeof j.archivos !== 'object' || j.archivos === null) throw new Error('el archivo de pesos no es el de --costos-out (version 1)');
  const valores = Object.values(j.archivos).filter((x) => typeof x === 'number' && Number.isFinite(x));
  return { archivos: /** @type {Record<string, number>} */ (j.archivos), promedio: valores.length ? valores.reduce((a, x) => a + x, 0) / valores.length : 0 };
}

/**
 * ¿Este archivo tiene que ser raíz de TODA tanda aunque no sea de su pedazo? Los `.d.ts` (globales y `declare module`), los que agregan tipos a otros (`declare module` / `declare global`) y los
 * «scripts» (sin import ni export: sus declaraciones son globales) cambian los tipos de archivos que no los importan, así que un programa sin ellos da errores que el tsc no da (o se calla los que sí). Puro.
 * @param {string} nombre
 * @param {string} texto
 */
export function esRaizAmbiente(nombre, texto) {
  if (/\.d\.[cm]?ts$/.test(nombre)) return true;
  if (/^\s*declare\s+(?:module|global)\b/m.test(texto)) return true;
  return !/^\s*(?:import|export)\b/m.test(texto);
}

const mb = (bytes) => Math.round(bytes / 1048576);
const posix = (p) => p.replace(/\\/g, '/');

/**
 * Crea el programa del tsconfig y chequea SU tanda. `ts` se inyecta en las pruebas; `gc` es `global.gc` si el proceso corre con --expose-gc.
 * @param {{ ts: any, config: string, tanda?: { i: number, K: number }, medir?: boolean, gc?: (() => void) | undefined, raices?: boolean, pesos?: { archivos: Record<string, number>, promedio: number } | null, costosOut?: string | null }} p
 * @returns {{ lineas: string[], errores: number, estadisticas: Record<string, number | null>, curva: string[], calientes: string[], archivosDeLaTanda: string[], raices: number, extras: string[] }}
 */
export function chequearTanda({ ts, config, tanda = { i: 1, K: 1 }, medir = false, gc, raices = false, pesos = null, costosOut = null }) {
  const t0 = Date.now();
  const anfitrion = { ...ts.sys, onUnRecoverableConfigFileDiagnostic: (d) => { throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n')); } };
  const parseado = ts.getParsedCommandLineOfConfigFile(resolve(config), {}, anfitrion);
  if (!parseado) throw new Error(`no pude leer ${config}`);
  const cwd = ts.sys.getCurrentDirectory();
  const saltaNombre = (nombre) => parseado.options.skipLibCheck && /\.d\.[cm]?ts$/.test(nombre);
  /** Lo que el tsc puede reportar al chequear un archivo: código (TS y JS —un JS «plano» también da unos pocos errores—), no JSON. Un `.d.ts` SÍ cuenta: con `skipLibCheck: false` el tsc lo chequea;
   *  con `skipLibCheck: true` lo saltean `saltaNombre` (raíces) y `saltea` (programa), no esta regla. */
  const esCodigo = (nombre) => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(nombre);
  const todasLasRaices = new Set(parseado.fileNames);

  // Con --raices el reparto se decide ANTES de crear el programa (con lo que dice el tsconfig y el disco), idéntico en todas las tandas; sin ellas, del programa entero, como siempre.
  /** @type {string[] | null} */
  let rootNames = null;
  /** @type {Set<string> | null} */
  let propiosPorRaiz = null;
  if (raices) {
    const candidatos = parseado.fileNames.filter((f) => !saltaNombre(f) && esCodigo(f)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const reparto = repartir(candidatos.map((f) => ({ nombre: f, peso: pesoDe(posix(relative(cwd, f)), (() => { try { return statSync(f).size; } catch { return 0; } })(), pesos) })), tanda.K);
    propiosPorRaiz = new Set(reparto[tanda.i - 1]);
    const ambientes = parseado.fileNames.filter((f) => { if (propiosPorRaiz?.has(f)) return false; const t = ts.sys.readFile(f); return t != null && esRaizAmbiente(f, t); });
    rootNames = [...propiosPorRaiz, ...ambientes];
  }

  const programa = ts.createProgram({
    rootNames: rootNames ?? parseado.fileNames,
    options: parseado.options,
    projectReferences: parseado.projectReferences,
    configFileParsingDiagnostics: ts.getConfigFileParsingDiagnostics(parseado),
  });
  const tPrograma = Date.now();
  const formato = { getCurrentDirectory: () => cwd, getCanonicalFileName: (f) => f, getNewLine: () => '\n' };
  const comoLineas = (diagnosticos) => ts.sortAndDeduplicateDiagnostics(diagnosticos).map((d) => ts.formatDiagnostic(d, formato).replace(/\n$/, ''));

  // El mismo orden que `tsc` (emitFilesAndReportErrors): configuración y sintaxis; sólo si no hay, opciones y globales; sólo si tampoco hay, lo semántico.
  // ⚠️ Los errores de CONFIGURACIÓN (una opción mal escrita) no cortan nada: el tsc los cuenta como «base» y sigue con lo demás. Los de sintaxis, opciones y globales sí: si hay alguno, no se chequea lo semántico.
  /** @type {any[]} */
  const todos = [...ts.getConfigFileParsingDiagnostics(parseado)];
  const base = todos.length;
  todos.push(...programa.getSyntacticDiagnostics());
  programa.getTypeChecker();     // ata TODOS los archivos del programa: el piso de memoria de la tanda
  if (todos.length === base) {
    todos.push(...programa.getOptionsDiagnostics(), ...programa.getGlobalDiagnostics());
  }
  gc?.();
  const baseMb = mb(process.memoryUsage().heapUsed);
  const tAtado = Date.now();

  const saltea = (sf) => (parseado.options.skipLibCheck && sf.isDeclarationFile) || (parseado.options.skipDefaultLibCheck && sf.hasNoDefaultLib);
  /** Un archivo del programa del que el tsc sí reportaría errores: código, no una declaración saltada. ⚠️ SIN excluir lo de node_modules: un `.ts` de un paquete (main: index.ts) el tsc SÍ lo chequea y reporta sus errores
   *  (medido el 21/10/2026 con el tsc de verdad); lo que no entra al programa son los .js de node_modules (maxNodeModuleJsDepth 0), y esos no están acá. */
  const chequeable = (sf) => !saltea(sf) && esCodigo(sf.fileName);
  /** @type {any[]} */
  let aChequear;
  let candidatosN;
  /** @type {any[]} */
  let extras = [];
  if (propiosPorRaiz) {
    aChequear = [...propiosPorRaiz].sort().map((n) => programa.getSourceFile(n)).filter(Boolean);
    candidatosN = propiosPorRaiz.size;
    // ⚠️ Los archivos que el programa trae por IMPORT pero que no son raíz de NINGUNA tanda (un .mjs de scripts/ que un test importa, un .ts fuera del `include`, un .ts de un paquete) no están en el reparto de
    // nadie: sin esto el tsc entero los chequea y las tandas no (medido el 21/10/2026: 27 archivos sin tanda, 16 .mjs, 10 .json y un .ts de node_modules). Cada tanda chequea los que SU programa trae; si dos
    // tandas los traen, se chequean dos veces (los errores salen una vez: se deduplican), que es barato porque son pocos. Un .json no da errores al chequear: no cuenta.
    extras = programa.getSourceFiles().filter((sf) => !todasLasRaices.has(sf.fileName) && chequeable(sf)).sort((a, b) => (a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0));
    aChequear = [...aChequear, ...extras];
  } else {
    const candidatos = programa.getSourceFiles().filter((sf) => chequeable(sf)).sort((a, b) => (a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0));
    const reparto = repartir(candidatos.map((sf) => ({ nombre: sf.fileName, peso: pesoDe(posix(relative(cwd, sf.fileName)), sf.text.length, pesos) })), tanda.K);
    const propios = new Set(reparto[tanda.i - 1]);
    aChequear = candidatos.filter((sf) => propios.has(sf.fileName));
    candidatosN = candidatos.length;
  }

  const curva = [];
  const tiempos = [];
  /** @type {Record<string, number>} */
  const costos = {};
  const tipos = () => (typeof programa.getTypeCount === 'function' ? programa.getTypeCount() : 0);
  if (todos.length === base) {
    let n = 0;
    for (const sf of aChequear) {
      const t = Date.now();
      const antes = medir ? tipos() : 0;
      todos.push(...programa.getSemanticDiagnostics(sf));
      if (medir) {
        tiempos.push([Date.now() - t, sf.fileName]);
        costos[posix(relative(cwd, sf.fileName))] = tipos() - antes;
        if (++n % 500 === 0) { gc?.(); curva.push(`CURVA tanda=${tanda.i}/${tanda.K} chequeados=${n} vivo_mb=${mb(process.memoryUsage().heapUsed)}`); }
      }
    }
  }
  const tChequeo = Date.now();
  gc?.();
  const vivoBytes = process.memoryUsage().heapUsed;
  if (medir && costosOut) writeFileSync(costosOut, JSON.stringify({ version: 1, archivos: costos }));
  const lineas = comoLineas(todos);
  const num = (nombre) => (typeof programa[nombre] === 'function' ? programa[nombre]() : null);
  const estadisticas = {
    files: programa.getSourceFiles().length,
    roots: rootNames ? rootNames.length : parseado.fileNames.length,
    types: num('getTypeCount'),
    instantiations: num('getInstantiationCount'),
    symbols: num('getSymbolCount'),
    identifiers: num('getIdentifierCount'),
    baseMb,
    vivoMb: mb(vivoBytes),
    checked: aChequear.length - extras.length,
    extras: extras.length,
    candidatos: candidatosN,
    parseS: (tPrograma - t0) / 1000,
    bindS: (tAtado - tPrograma) / 1000,
    checkS: (tChequeo - tAtado) / 1000,
    totalS: (Date.now() - t0) / 1000,
    maxRssMb: mb(process.resourceUsage().maxRSS * 1024),
  };
  const calientes = tiempos.sort((a, b) => b[0] - a[0]).slice(0, 25).map(([ms, f]) => `CALIENTE ms=${ms} ${f}`);
  return { lineas, errores: lineas.filter((l) => /error TS\d+/.test(l)).length, estadisticas, curva, calientes, archivosDeLaTanda: aChequear.map((sf) => sf.fileName), raices: estadisticas.roots, extras: extras.map((sf) => posix(relative(cwd, sf.fileName))) };
}

/** El bloque final, con el estilo de `--extendedDiagnostics` (lo lee leerEstadisticas de scripts/tipos-ci.mjs). Puro. */
export function bloqueEstadisticas(e, tanda) {
  const fila = (nombre, valor) => `${`${nombre}:`.padEnd(24)}${valor}`;
  return [
    fila('Tanda', `${tanda.i}/${tanda.K}`),
    fila('Files', e.files),
    ...(e.roots == null ? [] : [fila('Root files', e.roots)]),
    fila('Files checked', e.checked),
    ...(e.extras ? [fila('Extra files checked', e.extras)] : []),
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
  const archivoPesos = pos(['--pesos']);
  const pesos = archivoPesos ? leerPesos(readFileSync(archivoPesos, 'utf8')) : null;
  const r = chequearTanda({
    ts, config, tanda, medir: argv.includes('--medir'), gc: typeof globalThis.gc === 'function' ? globalThis.gc : undefined,
    raices: argv.includes('--raices'), pesos, costosOut: pos(['--costos-out']) ?? null,
  });
  if (r.lineas.length) process.stdout.write(`${r.lineas.join('\n')}\n`);
  for (const l of [...r.curva, ...r.calientes]) process.stdout.write(`${l}\n`);
  for (const e of r.extras.slice(0, 200)) process.stdout.write(`EXTRA ${e}\n`);
  process.stdout.write(`${bloqueEstadisticas(r.estadisticas, tanda).join('\n')}\n`);
  return r.lineas.length > 0 ? 2 : 0;     // 2 = lo que el tsc devuelve con errores (DiagnosticsPresent_OutputsGenerated), también con noEmit
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { process.stderr.write(`  [tipos-por-tandas] ${e?.stack ?? e}\n`); process.exit(3); }
}

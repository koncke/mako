// =============================================================================
// reporter-tiempos.mjs — cuánto tarda cada ARCHIVO de test, sin tocar el reporte de siempre
// =============================================================================
// Pedido del 4/11/2026 («Por qué tardaba horas», docs/hallazgos-infra.md → «Sin hacer»: «Tabla por test (rojos, falsas
// alarmas, tiempo)»). Para sacar un test de la fase que frena hay que saber cuánto tarda EN EL RUNNER, no en la PC: la
// trampa de las cuatro corridas de `grupo-leandro-2910` (LENTOS_FUERA_DE_LA_FASE_RAPIDA en tests-afectados.mjs).
//
// Es un reporter de `node --test` que va AL LADO del spec, no en su lugar: el spec sigue saliendo por stdout igual que
// siempre (tests-afectados.mjs lo lee con regex: «ℹ tests N», «✖ …», «test at …»), y éste no imprime nada. Escribe
// AGREGANDO a un archivo (`MAKO_TIEMPOS_TESTS`), porque una corrida son varias tandas y cada una es otro proceso de node:
// con `--test-reporter-destination=<archivo>` cada tanda pisaría a la anterior.
//
// Qué mide, comprobado con node 22 y 24 el 4/11/2026:
//   · Con un proceso por archivo (lo de siempre), node emite un `test:complete` de nesting 0 cuyo `name` es el archivo:
//     es el tiempo ENTERO del archivo, con el arranque de tsx y lo que corre al cargar. Ése es el número que importa.
//   · Con `--test-isolation=none` (las barredoras compartidas) ese evento no existe: queda la SUMA de sus casos de arriba,
//     sin la carga. Se marca «casos» para que nadie lo compare con un «archivo».
//
// Uso:  MAKO_TIEMPOS_TESTS=tiempos.tsv node --test --test-reporter=spec --test-reporter-destination=stdout \
//         --test-reporter=./scripts/reporter-tiempos.mjs --test-reporter-destination=stdout tests/x.test.ts
// Cada línea: `<ms>\t<archivo>\t<archivo|casos>\t<verde|rojo>`. La tabla la arma scripts/tiempos-tests.mjs.
// =============================================================================

import { appendFileSync } from 'node:fs';
import path from 'node:path';

const relativa = (f) => path.relative(process.cwd(), f).replace(/\\/g, '/');

/** El evento es el envoltorio del ARCHIVO (no un caso): su nombre es la ruta del archivo, tal como se le pasó a node. */
export function esDelArchivo(ev) {
  const d = ev.data ?? {};
  if (ev.type !== 'test:complete' || d.nesting !== 0 || !d.file || !d.name) return false;
  const nombre = String(d.name).replace(/\\/g, '/');
  const archivo = String(d.file).replace(/\\/g, '/');
  return archivo === nombre || archivo.endsWith('/' + nombre.replace(/^\.\//, ''));
}

/** Junta los eventos y devuelve las líneas del TSV. Puro: lo prueba tests/reporter-tiempos.test.ts sin correr node. */
export function lineasDeTiempos(eventos) {
  const archivo = new Map();   // archivo → { ms, rojo }
  const casos = new Map();     // archivo → { ms, rojo } (suma de los casos de arriba)
  for (const ev of eventos) {
    const d = ev.data ?? {};
    if (!d.file) continue;
    const f = relativa(d.file);
    const ms = Number(d.details?.duration_ms) || 0;
    const rojo = d.details?.passed === false || ev.type === 'test:fail';
    if (esDelArchivo(ev)) { archivo.set(f, { ms, rojo: rojo || archivo.get(f)?.rojo === true }); continue; }
    if (d.nesting !== 0 || (ev.type !== 'test:pass' && ev.type !== 'test:fail')) continue;
    const c = casos.get(f) ?? { ms: 0, rojo: false };
    casos.set(f, { ms: c.ms + ms, rojo: c.rojo || rojo });
  }
  const salida = [];
  for (const [f, v] of archivo) salida.push(`${Math.round(v.ms)}\t${f}\tarchivo\t${v.rojo || casos.get(f)?.rojo ? 'rojo' : 'verde'}`);
  for (const [f, v] of casos) if (!archivo.has(f)) salida.push(`${Math.round(v.ms)}\t${f}\tcasos\t${v.rojo ? 'rojo' : 'verde'}`);
  return salida;
}

export default async function* tiempos(source) {
  const destino = process.env.MAKO_TIEMPOS_TESTS;
  const eventos = [];
  for await (const ev of source) {
    if (ev.type === 'test:complete' || ev.type === 'test:pass' || ev.type === 'test:fail') eventos.push({ type: ev.type, data: { file: ev.data?.file, name: ev.data?.name, nesting: ev.data?.nesting, details: { duration_ms: ev.data?.details?.duration_ms, passed: ev.data?.details?.passed } } });
  }
  if (!destino) return;
  const lineas = lineasDeTiempos(eventos);
  // Un reporter que tira se lleva puesto el `node --test` entero: el tiempo es un dato de más, nunca un rojo.
  try { if (lineas.length) appendFileSync(destino, lineas.join('\n') + '\n'); } catch (e) { process.stderr.write(`  [reporter-tiempos] no pude escribir ${destino}: ${e?.message ?? e}\n`); }
}

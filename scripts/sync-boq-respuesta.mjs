// =============================================================================
// sync-boq-respuesta — el lector de la respuesta de BOQ, también en la extensión
// =============================================================================
// `lib/flow-boq-respuesta.ts` decide si Google realmente creó el video o no. Lo
// necesita el SERVICE WORKER, que es quien recibe la respuesta — y la extensión no
// puede importar de `lib/`.
//
// ⚠️ ES EL MÓDULO QUE DECIDE SI SE AFIRMA UN ÉXITO, y ya mintió una vez: mirando
// `res.ok` (HTTP 200) el popup dijo «Listo, lo verás en tu Flow» sobre un pedido que
// no creó nada. Dos versiones distintas de este archivo significa que la que corre
// no es la que se probó, y lo que se pierde en el desfase es exactamente eso: la
// diferencia entre «pasó» y «te dije que pasó».
//
// Misma solución y misma guarda que `sync-operaciones` y `sync-boq-patch`: se
// GENERA, y el pre-push falla si quedó viejo.
//
//   node --import tsx scripts/sync-boq-respuesta.mjs            → escribe
//   node --import tsx scripts/sync-boq-respuesta.mjs --check    → falla si quedó viejo
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const FUENTE = 'lib/flow-boq-respuesta.ts';
const DESTINO = 'extension/boq-respuesta.js';

/** Ver la nota de CRLF en sync-operaciones.mjs: se normaliza para DECIDIR. */
const sinCR = (s) => s.replace(/\r\n/g, '\n');

/**
 * El `.ts` sin los tipos.
 *
 * ⚠️ No es un transpilador: es un borrado de anotaciones sobre un archivo que se
 * escribió a propósito para poder copiarse — sin genéricos, sin enums, sin `as`, y
 * con una sola firma anotada.
 *
 * El borrado del `type` es POR LÍNEAS y no con un `[\s\S]*?;`: la unión de acá tiene
 * punto y coma ADENTRO de cada miembro (`{ ok: true; rpcid: string; … }`), así que
 * el no-codicioso cortaría en el primero y dejaría medio tipo en el `.js`.
 */
function sinTipos(ts) {
  const lineas = sinCR(ts).split('\n');
  const out = [];
  let enTipo = false;
  for (const l of lineas) {
    if (!enTipo && /^export type \w+ =/.test(l)) { enTipo = true; }
    if (enTipo) { if (l.trimEnd().endsWith(';')) enTipo = false; continue; }
    out.push(l);
  }
  return out.join('\n')
    .replace(
      'export function leerRespuestaBoq(texto: string, rpcidEsperado?: string): LecturaBoq {',
      'export function leerRespuestaBoq(texto, rpcidEsperado) {',
    )
    .replace(
      'function msDelBackend(t: string): string {',
      'function msDelBackend(t) {',
    );
}

const js = sinTipos(readFileSync(FUENTE, 'utf8'));

// La guarda del borrado: si quedó una anotación, el `.js` no carga y el service
// worker muere entero al importarlo. Mejor fallar acá, con el nombre del archivo.
for (const sospecha of [': string', ': LecturaBoq', 'export type']) {
  if (js.includes(sospecha)) {
    console.error(`\n  X Quedó «${sospecha}» en el JS generado desde ${FUENTE}.`);
    console.error('    El borrado de tipos es literal: si la firma cambió, cambiá el reemplazo.\n');
    process.exit(1);
  }
}

const cuerpo = `// =============================================================================
// GENERADO por scripts/sync-boq-respuesta.mjs desde ${FUENTE} — NO EDITAR A MANO
// =============================================================================
// El pre-push falla si quedó viejo. Este módulo decide si se le dice a alguien que
// su video está en camino: dos versiones distintas es la diferencia entre «pasó» y
// «te dije que pasó».
// =============================================================================

${js.replace(/^\/\/ =+\n(\/\/.*\n)*\/\/ =+\n/, '').trimStart()}`;

if (CHECK) {
  if (!existsSync(DESTINO)) {
    console.error(`\n  X ${DESTINO} no existe. Corré: node --import tsx scripts/sync-boq-respuesta.mjs\n`);
    process.exit(1);
  }
  if (sinCR(readFileSync(DESTINO, 'utf8')) !== sinCR(cuerpo)) {
    console.error(`\n  X ${DESTINO} quedó viejo respecto de ${FUENTE}.`);
    console.error('    Decide si se afirma un éxito: la versión que corre tiene que ser la');
    console.error('    que se probó.\n');
    console.error('    Corré: node --import tsx scripts/sync-boq-respuesta.mjs\n');
    process.exit(1);
  }
  console.log(`  ✓ ${DESTINO} al día`);
  process.exit(0);
}

writeFileSync(DESTINO, cuerpo);
console.log(`✅ ${DESTINO}`);

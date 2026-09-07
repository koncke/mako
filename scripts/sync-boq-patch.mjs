// =============================================================================
// sync-boq-patch — el parcheador del cuerpo de BOQ, también en la extensión
// =============================================================================
// `lib/flow-boq-patch.ts` escribe el prompt adentro del cuerpo form-urlencoded que
// se le copió a Flow. Lo necesita el SERVICE WORKER de la extensión, que es el que
// arma el pedido a repetir — y la extensión no puede importar de `lib/`.
//
// Misma solución que el catálogo de operaciones, misma guarda: se GENERA, y el
// pre-push falla si quedó viejo. Acá el desfase es caro de una forma concreta: este
// módulo decide el cuerpo de un pedido que GASTA CRÉDITOS del cliente. Dos versiones
// distintas del parcheador significa que la que corre no es la que se probó.
//
// ⚠️ Y ES SÓLO LÓGICA DE STRINGS. Nada de `chrome.*`, nada de red: por eso se puede
// copiar tal cual y por eso el test diferencial puede correr las dos.
//
//   node --import tsx scripts/sync-boq-patch.mjs            → escribe
//   node --import tsx scripts/sync-boq-patch.mjs --check    → falla si quedó viejo
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CHECK = process.argv.includes('--check');
const FUENTE = 'lib/flow-boq-patch.ts';
const DESTINO = 'extension/boq-patch.js';

/** Ver la nota de CRLF en sync-operaciones.mjs: se normaliza para DECIDIR. */
const sinCR = (s) => s.replace(/\r\n/g, '\n');

/**
 * El `.ts` sin los tipos.
 *
 * ⚠️ No es un transpilador: es un borrado de anotaciones sobre un archivo que se
 * escribió a propósito para poder copiarse (sin genéricos, sin enums, sin `as`).
 * `tests/flow-boq-patch-paridad.test.ts` comprueba que las dos contesten lo mismo,
 * que es lo que hace segura esta simplificación.
 */
function sinTipos(ts) {
  return ts
    // `export type X = …;` y `type X = …;` — bloques enteros
    .replace(/^export type [\s\S]*?;\n/gm, '')
    .replace(/^type [\s\S]*?;\n/gm, '')
    // anotaciones de parámetros y de retorno
    .replace(/: readonly \[string, \(t: string\) => string\]\[\]/g, '')
    .replace(/\(t: string\)/g, '(t)')
    .replace(/\(texto: string, nombre: string\)/g, '(texto, nombre)')
    .replace(/\(cuerpo: string, texto: string\)/g, '(cuerpo, texto)')
    .replace(/\(texto: string, tope = 2000\)/g, '(texto, tope = 2000)')
    .replace(/\(cuerpo: string, viejo: string, nuevo: string\)/g, '(cuerpo, viejo, nuevo)')
    .replace(/\(cuerpo: string, atVivo: string\)/g, '(cuerpo, atVivo)')
    .replace(/\(cuerpo: string, tokenVivo: string\): \{ cuerpo: string; cuantos: number \}/g, '(cuerpo, tokenVivo)')
    .replace(/\): string \| null \{/g, ') {')
    .replace(/\): string\[\] \{/g, ') {')
    .replace(/\): string \{/g, ') {')
    .replace(/\): Reemplazo \{/g, ') {')
    .replace(/: readonly string\[\] =/g, ' =')
    .replace(/^(const|let) (\w+) = 0;$/gm, '$1 $2 = 0;')
    .replace(/let cuantas = 0;/g, 'let cuantas = 0;')
    .replace(/let i = /g, 'let i = ')
    .replace(/const buscar = codificar\(viejo, donde\);/g, 'const buscar = codificar(viejo, donde);');
}

const ts = readFileSync(FUENTE, 'utf8');
const cuerpo = `// =============================================================================
// GENERADO por scripts/sync-boq-patch.mjs desde ${FUENTE} — NO EDITAR A MANO
// =============================================================================
// El pre-push falla si quedó viejo. El desfase acá es caro de una forma concreta:
// este módulo decide el cuerpo de un pedido que GASTA CRÉDITOS del cliente, así que
// dos versiones distintas significa que la que corre no es la que se probó.
// =============================================================================

${sinTipos(ts).replace(/^\/\/ =+\n(\/\/.*\n)*\/\/ =+\n/, '').trimStart()}`;

if (CHECK) {
  if (!existsSync(DESTINO)) {
    console.error(`\n  X ${DESTINO} no existe. Corré: node --import tsx scripts/sync-boq-patch.mjs\n`);
    process.exit(1);
  }
  if (sinCR(readFileSync(DESTINO, 'utf8')) !== sinCR(cuerpo)) {
    console.error(`\n  X ${DESTINO} quedó viejo respecto de ${FUENTE}.`);
    console.error('    Decide el cuerpo de un pedido que gasta créditos del cliente: la');
    console.error('    versión que corre tiene que ser la que se probó.\n');
    console.error('    Corré: node --import tsx scripts/sync-boq-patch.mjs\n');
    process.exit(1);
  }
  console.log(`  ✓ ${DESTINO} al día`);
  process.exit(0);
}

writeFileSync(DESTINO, cuerpo);
console.log(`✅ ${DESTINO}`);

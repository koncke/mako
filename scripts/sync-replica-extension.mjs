// =============================================================================
// sync-replica-extension — «Replicar esta página», también en la extensión (9/11/2026)
// =============================================================================
// `lib/editor-landing/replica-extension-script.ts` arma la función que saca la foto de la copia idéntica en la pestaña
// real de la persona, con las MISMAS piezas que el lector (copia-identica-script.ts). La extensión no puede importar de
// `lib/` ni bajar código de afuera (Manifest V3): se GENERA `extension/replica-leer.js`, y el pre-push falla si quedó
// viejo. Dos versiones distintas es una copia que en la ventana del lector sale bien y en la extensión sale distinta, sin
// que nada lo diga — y cada cambio acá es una versión nueva de la extensión.
//
// A diferencia de sync-boq-respuesta, el fuente no se lee como texto: se IMPORTA (con tsx) y se usa el string que exporta.
// No hay tipos que borrar a mano.
//
//   node --import tsx scripts/sync-replica-extension.mjs            → escribe
//   node --import tsx scripts/sync-replica-extension.mjs --check    → falla si quedó viejo
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { archivoDeLaExtension } from '../lib/editor-landing/replica-extension-script.ts';

const CHECK = process.argv.includes('--check');
const FUENTE = 'lib/editor-landing/replica-extension-script.ts';
const DESTINO = 'extension/replica-leer.js';

/** Ver la nota de CRLF en sync-operaciones.mjs: se normaliza para DECIDIR. */
const sinCR = (s) => s.replace(/\r\n/g, '\n');

const cuerpo = archivoDeLaExtension();

// Las guardas del contenido, antes de escribir nada: un backtick, un `${` o una barra-asterisco rompen el archivo o los
// tests de la extensión (que quitan comentarios con una regex); un `fetch(` sería la pestaña pidiendo a la red.
for (const [sospecha, por] of [['`', 'un backtick'], ['${', 'un signo de pesos con llave'], ['/*', 'una barra-asterisco'], ['fetch(', 'un pedido a la red']]) {
  if (cuerpo.includes(sospecha)) {
    console.error(`\n  X Quedó ${por} en el JS generado desde ${FUENTE}.`);
    console.error('    Lo que corre en la pestaña es JavaScript plano y no pide nada a la red.\n');
    process.exit(1);
  }
}

if (CHECK) {
  if (!existsSync(DESTINO)) {
    console.error(`\n  X ${DESTINO} no existe. Corré: node --import tsx scripts/sync-replica-extension.mjs\n`);
    process.exit(1);
  }
  if (sinCR(readFileSync(DESTINO, 'utf8')) !== sinCR(cuerpo)) {
    console.error(`\n  X ${DESTINO} quedó viejo respecto de ${FUENTE}.`);
    console.error('    La foto que saca la extensión tiene que ser la misma que la del lector.\n');
    console.error('    Corré: node --import tsx scripts/sync-replica-extension.mjs');
    console.error('    (y después subí la versión de la extensión y regenerá el zip: node scripts/zip-extension.mjs)\n');
    process.exit(1);
  }
  console.log(`  ✓ ${DESTINO} al día`);
  process.exit(0);
}

writeFileSync(DESTINO, cuerpo);
console.log(`✅ ${DESTINO}`);

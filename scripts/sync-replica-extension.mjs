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
//
// ⚠️ El --check contesta sobre lo que se PUBLICA, no sobre el disco (AGENTS.md, «Una guarda del pre-push contesta sobre lo
// que se publica»): arma el archivo desde los fuentes de HEAD (los dos .ts, copiados a una carpeta temporal e importados de
// ahí) y lo compara con el de HEAD. Así un fuente a medio editar por la sesión vecina no frena el push de nadie.
// =============================================================================

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHECK = process.argv.includes('--check');
const FUENTE = 'lib/editor-landing/replica-extension-script.ts';
const DESTINO = 'extension/replica-leer.js';

/** Ver la nota de CRLF en sync-operaciones.mjs: se normaliza para DECIDIR. */
const sinCR = (s) => s.replace(/\r\n/g, '\n');

const FUENTES = ['lib/editor-landing/replica-extension-script.ts', 'lib/editor-landing/copia-identica-script.ts'];
const deHEAD = (ruta) => {
  try { return execFileSync('git', ['show', `HEAD:${ruta}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; }
};

/** El archivo armado desde los fuentes del disco (al generar) o de HEAD (al chequear). */
async function armar(desdeHEAD) {
  if (!desdeHEAD) return (await import('../lib/editor-landing/replica-extension-script.ts')).archivoDeLaExtension();
  const dir = mkdtempSync(join(tmpdir(), 'sync-replica-'));
  try {
    for (const f of FUENTES) {
      const t = deHEAD(f);
      if (t == null) return null;
      writeFileSync(join(dir, f.split('/').pop()), t);
    }
    return (await import(pathToFileURL(join(dir, 'replica-extension-script.ts')).href)).archivoDeLaExtension();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

let cuerpo = await armar(CHECK);
// Sin git o sin los fuentes en HEAD (un clon a medio armar): se mira el disco, que es lo único que hay.
if (cuerpo == null) cuerpo = await armar(false);

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
  const destino = deHEAD(DESTINO) ?? (existsSync(DESTINO) ? readFileSync(DESTINO, 'utf8') : null);
  if (destino == null) {
    console.error(`\n  X ${DESTINO} no existe. Corré: node --import tsx scripts/sync-replica-extension.mjs\n`);
    process.exit(1);
  }
  if (sinCR(destino) !== sinCR(cuerpo)) {
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

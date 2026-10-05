#!/usr/bin/env node
// =============================================================================
// Los artefactos del replay: copiar rrweb a `public/replay/<v>/`
// =============================================================================
// EL ARTEFACTO QUE SE DISTRIBUYE NO ES EL FUENTE. Es la misma razón por la que
// existen `scripts/zip-extension.mjs` y `scripts/generar-plugin.mjs`: el grabador
// lo baja el navegador de un VISITANTE de la landing de un cliente, desde una ruta
// nuestra. Si `node_modules` tiene una versión y `public/` otra, el que graba es
// el de `public/` — y no hay ningún error que lo diga.
//
// POR QUÉ SE SIRVE DESDE NOSOTROS Y NO DESDE UN CDN: el snippet ya está pegado en
// la página del cliente y no se puede repegar por cada arreglo. Con la ruta propia
// y versionada (`/replay/1/r.js`), subir la versión es un deploy nuestro y nadie
// toca nada. Y no dependemos de que un CDN de terceros siga sirviendo el archivo
// que probamos — el Pixel de un cliente no puede quedar atado a eso.
//
// Correr:  node scripts/replay-libs.mjs          (copia)
//          node scripts/replay-libs.mjs --check  (falla si quedó viejo; pre-push)
//
// ⚠️ EL `--check` LEE EL DISCO Y NO HEAD, a propósito, y es la excepción a la regla
// de las otras guardas: lo que importa acá es que el archivo que Vercel va a servir
// esté al día con el `node_modules` del que sale, y las dos cosas son del disco. No
// puede frenar a la sesión vecina por trabajo sin commitear, porque no mira commits.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

/** La versión de la ruta. Tiene que coincidir con REPLAY_LIB_VERSION del contrato. */
const VERSION = 1;

/** Qué se copia y de dónde. El `global` es lo que el consumidor espera en window. */
const ARTEFACTOS = [
  {
    de: 'node_modules/rrweb/dist/record/rrweb-record.min.js',
    a: `public/replay/${VERSION}/r.js`,
    global: 'rrwebRecord',
    quien: 'el grabador — lo baja el navegador del VISITANTE, así que su peso lo paga él',
  },
  {
    de: 'node_modules/rrweb-player/dist/rrweb-player.umd.min.cjs',
    a: `public/replay/${VERSION}/player.js`,
    global: 'rrwebPlayer',
    quien: 'el reproductor — corre en MaKo, así que su peso lo pagamos nosotros',
  },
  {
    de: 'node_modules/rrweb-player/dist/style.min.css',
    a: `public/replay/${VERSION}/player.css`,
    global: null,
    quien: 'los estilos del reproductor',
  },
];

const huella = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);

const check = process.argv.includes('--check');
let viejos = 0;

for (const art of ARTEFACTOS) {
  const origen = join(raiz, art.de);
  if (!existsSync(origen)) {
    console.error(`✖ falta ${art.de} — ¿corriste \`npm install\`?`);
    process.exit(1);
  }
  const bytes = readFileSync(origen);

  // ⚠️ El global se comprueba sobre el CONTENIDO, no sobre el nombre del archivo:
  // rrweb cambió de nombre de bundle entre versiones, y copiar el equivocado deja
  // un archivo que baja perfecto y no define nada. El síntoma sería «no graba», sin
  // un error en ningún lado.
  if (art.global && !bytes.includes(art.global)) {
    console.error(`✖ ${art.de} no menciona \`${art.global}\`: es el bundle equivocado.`);
    process.exit(1);
  }

  const destino = join(raiz, art.a);
  const actual = existsSync(destino) ? readFileSync(destino) : null;
  const igual = actual != null && actual.equals(bytes);

  if (check) {
    if (!igual) {
      viejos++;
      console.error(`✖ ${art.a} está viejo (o no existe).`);
      console.error(`   ${art.quien}`);
      console.error(`   disco: ${actual ? huella(actual) : '(no está)'} · node_modules: ${huella(bytes)}`);
    } else {
      console.log(`  ✓ ${art.a} al día (${huella(bytes)}, ${bytes.length} B)`);
    }
    continue;
  }

  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, bytes);
  console.log(`${igual ? '  =' : '  ↻'} ${art.a} — ${bytes.length} B (${huella(bytes)})`);
}

if (check && viejos) {
  console.error(`\n  ✖ ${viejos} artefacto(s) del replay sin regenerar.`);
  console.error('    Corré: node scripts/replay-libs.mjs  y commiteá public/replay/.\n');
  process.exit(1);
}
if (check) console.log('✓ artefactos del replay al día.');

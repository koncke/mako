#!/usr/bin/env node
// =============================================================================
// Los artefactos del replay: rrweb (y su envoltorio) en `public/replay/<v>/`
// =============================================================================
// EL ARTEFACTO QUE SE DISTRIBUYE NO ES EL FUENTE. Es la misma razón por la que
// existen `scripts/zip-extension.mjs` y `scripts/generar-plugin.mjs`: el grabador
// lo baja el navegador de un VISITANTE de la landing de un cliente, desde una ruta
// nuestra. Si `node_modules` tiene una versión y `public/` otra, el que graba es
// el de `public/` — y no hay ningún error que lo diga.
//
// POR QUÉ SE SIRVE DESDE NOSOTROS Y NO DESDE UN CDN: el snippet ya está pegado en
// la página del cliente y no se puede repegar por cada arreglo. Con la ruta propia
// y versionada (`/replay/<v>/r.js`, y la `v` la contesta el servidor en cada
// pageview), cambiar el archivo que baja es un deploy nuestro y nadie toca nada. Y
// no dependemos de que un CDN de terceros siga sirviendo el archivo que probamos.
//
// ⚠️ LO QUE SE ARREGLA ASÍ ES SÓLO LO QUE VIVE EN r.js. El lote, el piso, el beacon
// y la cola están en el snippet pegado (lib/landing-token.ts); r.js trae rrweb y,
// desde la v2, un envoltorio (`scripts/replay-envoltorio.js`) que trabaja desde
// afuera sobre lo único que el snippet llama: `window.rrwebRecord(opciones)`.
//
// LAS VERSIONES DEL GRABADOR, y ninguna se reescribe:
//   · v1 — rrweb pelado, byte a byte. Publicada el 05/10/2026 y en la caché de los
//          visitantes: cambiarle el contenido es un cambio que llega cuando quiere.
//   · v2 — el mismo rrweb + el envoltorio (sin el comentario del source map, que
//          apuntaría a un archivo que no se publica, y sin los comentarios de
//          línea del envoltorio, que los paga la descarga del visitante).
// El reproductor (player.js/.css) sigue en la 1: tiene su propia versión
// (REPLAY_PLAYER_VERSION, lib/replay-reproductor.ts) y no cambió.
//
// Correr:  node scripts/replay-libs.mjs          (genera, leyendo el disco)
//          node scripts/replay-libs.mjs --check  (falla si quedó viejo; pre-push)
//
// ⚠️ EL `--check` CONTESTA SOBRE LO QUE SE PUBLICA, que es HEAD. Hasta la v1 leía el
// disco, y era defendible: la única entrada era `node_modules`. Con la v2 hay un
// FUENTE versionado (el envoltorio) que otra sesión puede estar editando en el
// mismo clon, y leído del disco su trabajo a medias frenaría tu push — el candado
// sin llave que AGENTS.md prohíbe. Así que en `--check` el envoltorio, el contrato
// y los archivos de `public/replay/` se leen de HEAD (`git show`); `node_modules`
// sigue siendo del disco, porque no está en git y es lo que instala el lockfile.
// Si no hay git (un tarball, un CI sin .git), cae al disco y lo dice.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

const RRWEB = 'node_modules/rrweb/dist/record/rrweb-record.min.js';
const ENVOLTORIO = 'scripts/replay-envoltorio.js';
const CONTRATO = 'lib/replay-contrato.ts';

// ⚠️ SE COMPARA SIN LOS SALTOS DE WINDOWS, Y ES LA REGLA DE LA CASA. Con
// `core.autocrlf=true`, git le mete CRLF a estos bundles al hacer checkout: medido
// el 05/10/2026, `r.js` pesa 63.925 B en el clon y 63.930 en un worktree recién
// creado — cinco saltos convertidos. Comparando bytes exactos, este guard frena el
// push sobre un archivo IDÉNTICO. El `.gitattributes` le pide a git que no toque
// `public/replay/**`; esto cubre a los que ya estaban guardados, y al envoltorio,
// que es fuente y llega en CRLF a un worktree. Se normaliza para DECIDIR, y sobre
// la ENTRADA antes de transformarla (la lección de `sync-boq-patch`).
const sinCR = (b) => Buffer.from(b.toString('latin1').split('\r\n').join('\n'), 'latin1');

/**
 * La v2: rrweb + el envoltorio.
 *
 * Todo en latin1, que mapea byte a byte: el bundle de rrweb no se decodifica ni se
 * recodifica, así que lo que queda delante del envoltorio son SUS bytes.
 */
function armarV2(rrweb, envoltorio) {
  // El `//# sourceMappingURL` de rrweb sale: en el medio del archivo no sirve, y al
  // abrir las herramientas del navegador pediría un .map que no publicamos.
  const lib = sinCR(rrweb).toString('latin1').replace(/\n\/\/# sourceMappingURL=[^\n]*\n?$/, '\n');
  // ⚠️ SÓLO los comentarios de LÍNEA ENTERA. Uno al final de una línea de código
  // podría estar dentro de un string; el envoltorio no los usa, y así el recorte no
  // necesita entender JavaScript.
  const env = sinCR(envoltorio).toString('latin1')
    .split('\n')
    .filter((l) => l.trim() !== '' && !/^\s*\/\//.test(l))
    .join('\n');
  return Buffer.from((lib.endsWith('\n') ? lib : lib + '\n') + env + '\n', 'latin1');
}

/**
 * Qué se publica, de dónde sale, y qué tiene que mencionar adentro.
 *
 * ⚠️ El global se comprueba sobre el CONTENIDO, no sobre el nombre del archivo:
 * rrweb cambió de nombre de bundle entre versiones, y copiar el equivocado deja
 * un archivo que baja perfecto y no define nada. El síntoma sería «no graba», sin
 * un error en ningún lado. En la v2 se pide además la marca del envoltorio.
 */
//
// ⚠️ Y CADA VERSIÓN PUBLICADA LLEVA SU HUELLA (`publicada`: sha256 sin CR, 12 hex), y
// es la regla de «una versión publicada es inmutable» escrita donde se puede romper.
// Sin ella, un `npm update rrweb` o un cambio en el envoltorio hacen que este script
// —y el `--check` del pre-push, que lo pide— REESCRIBAN la v1 o la v2 en su lugar:
// los visitantes que la tienen en caché siguen con la vieja, los nuevos bajan la
// nueva, y la versión que se probó ya no existe. Si lo que se arma hoy no da la
// huella, el script se niega. Lo que corresponde es una entrada NUEVA (`/replay/3/`,
// REPLAY_LIB_VERSION = 3), y que la vieja deje de armarse de fuentes que cambiaron:
// su `armar` pasa a ser el archivo publicado (`(dep, fuente, publicado) => publicado(...)`).
const ARTEFACTOS = [
  {
    a: 'public/replay/1/r.js',
    grabador: 1,
    publicada: 'bf8fa2f53188',
    debeTener: ['rrwebRecord'],
    armar: (dep) => dep(RRWEB),
    quien: 'el grabador v1 — lo baja el navegador del VISITANTE, así que su peso lo paga él',
  },
  {
    a: 'public/replay/2/r.js',
    grabador: 2,
    // Fijada el 08/10/2026, antes del primer deploy: hasta que se despliegue, un
    // cambio del envoltorio puede actualizarla A MANO acá. Después, no.
    publicada: 'c5234232d1ac',
    debeTener: ['rrwebRecord', 'mkoEnvoltorio', 'inlineStylesheet = false'],
    armar: (dep, fuente) => armarV2(dep(RRWEB), fuente(ENVOLTORIO)),
    quien: 'el grabador v2 (rrweb + scripts/replay-envoltorio.js) — también lo baja el VISITANTE',
  },
  {
    a: 'public/replay/1/player.js',
    publicada: '9015abec2bf3',
    debeTener: ['rrwebPlayer'],
    armar: (dep) => dep('node_modules/rrweb-player/dist/rrweb-player.umd.min.cjs'),
    quien: 'el reproductor — corre en MaKo, así que su peso lo pagamos nosotros',
  },
  {
    a: 'public/replay/1/player.css',
    publicada: 'ce5e96298e20',
    debeTener: [],
    armar: (dep) => dep('node_modules/rrweb-player/dist/style.min.css'),
    quien: 'los estilos del reproductor',
  },
];

const huella = (b) => createHash('sha256').update(b).digest('hex').slice(0, 12);
const check = process.argv.includes('--check');

/** Lee un archivo de HEAD. `null` si no está en el commit; `undefined` si no hay git. */
function deHead(ruta) {
  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: raiz, stdio: 'ignore' });
  } catch {
    return undefined;
  }
  try {
    return execFileSync('git', ['show', `HEAD:${ruta}`], { cwd: raiz, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

const delDisco = (ruta) => {
  const p = join(raiz, ruta);
  return existsSync(p) ? readFileSync(p) : null;
};

let sinGit = false;
/** Lo VERSIONADO: en --check sale de HEAD, generando sale del disco. */
const versionado = (ruta) => {
  if (!check) return delDisco(ruta);
  const h = deHead(ruta);
  if (h === undefined) { sinGit = true; return delDisco(ruta); }
  return h;
};

/** Las dependencias: siempre del disco (`node_modules` no está en git). */
const dep = (ruta) => {
  const p = join(raiz, ruta);
  if (!existsSync(p)) {
    console.error(`✖ falta ${ruta} — ¿corriste \`npm install\`?`);
    process.exit(1);
  }
  return readFileSync(p);
};

const fuente = (ruta) => {
  const b = versionado(ruta);
  if (!b) {
    console.error(`✖ falta ${ruta}${check ? ' en HEAD' : ''}: es el fuente de un artefacto del replay.`);
    process.exit(1);
  }
  return b;
};

/** El archivo ya publicado, para la versión vieja que dejó de armarse de fuentes. */
const publicado = (ruta) => {
  const b = versionado(ruta);
  if (!b) {
    console.error(`✖ falta ${ruta}${check ? ' en HEAD' : ''}: es una versión publicada.`);
    process.exit(1);
  }
  return b;
};

let viejos = 0;

for (const art of ARTEFACTOS) {
  const bytes = art.armar(dep, fuente, publicado);
  for (const marca of art.debeTener) {
    if (!bytes.includes(marca)) {
      console.error(`✖ ${art.a} no menciona \`${marca}\`: se armó con el bundle o el fuente equivocado.`);
      process.exit(1);
    }
  }
  // La huella se toma sin CR: es la misma en el clon, en un worktree y en HEAD.
  if (art.publicada && huella(sinCR(bytes)) !== art.publicada) {
    console.error(`✖ ${art.a} es una versión PUBLICADA (huella ${art.publicada}) y lo que se arma hoy da ${huella(sinCR(bytes))}.`);
    console.error('   Cambió lo que la arma (rrweb en node_modules, o el envoltorio). Una versión publicada no se');
    console.error('   reescribe: está en la caché de los visitantes. Arma la siguiente como una entrada nueva');
    console.error('   y deja ésta leyendo su archivo publicado (ver el comentario de ARTEFACTOS).');
    process.exit(1);
  }

  const actual = versionado(art.a);
  const igual = actual != null && sinCR(actual).equals(sinCR(bytes));

  if (check) {
    if (!igual) {
      viejos++;
      console.error(`✖ ${art.a} está viejo (o no está)${sinGit ? '' : ' en HEAD'}.`);
      console.error(`   ${art.quien}`);
      console.error(`   publicado: ${actual ? huella(actual) : '(no está)'} · armado: ${huella(bytes)}`);
    } else {
      console.log(`  ✓ ${art.a} al día (${huella(bytes)}, ${bytes.length} B)`);
    }
    continue;
  }

  const destino = join(raiz, art.a);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, bytes);
  console.log(`${igual ? '  =' : '  ↻'} ${art.a} — ${bytes.length} B (${huella(bytes)})`);
}

// ⚠️ LA VERSIÓN QUE EL SERVIDOR ANUNCIA TIENE QUE EXISTIR COMO ARCHIVO. El pageview
// contesta `rec.v = REPLAY_LIB_VERSION` y el snippet baja `/replay/<v>/r.js`: subir
// el número sin el archivo da un 404, el snippet lo toma como «no bajó» y deja de
// grabar en TODAS las páginas, sin un error en ningún lado que lo diga.
const contrato = versionado(CONTRATO);
const m = contrato && /export const REPLAY_LIB_VERSION = (\d+);/.exec(sinCR(contrato).toString('latin1'));
if (!m) {
  console.error(`✖ no encontré REPLAY_LIB_VERSION en ${CONTRATO}: este script lo lee con una regex.`);
  process.exit(1);
}
const anunciada = Number(m[1]);
if (!ARTEFACTOS.some((a) => a.grabador === anunciada)) {
  console.error(`✖ ${CONTRATO} anuncia REPLAY_LIB_VERSION = ${anunciada} y acá no hay un r.js para esa versión.`);
  process.exit(1);
}

if (sinGit) console.log('  (sin git: comparé contra el disco, no contra HEAD)');
if (check && viejos) {
  console.error(`\n  ✖ ${viejos} artefacto(s) del replay sin regenerar.`);
  console.error('    Corre: node scripts/replay-libs.mjs  y commitea public/replay/.\n');
  process.exit(1);
}
if (check) console.log(`✓ artefactos del replay al día (el servidor anuncia el grabador v${anunciada}).`);

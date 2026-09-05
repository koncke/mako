// Empaqueta extension/ en public/mako-puente.zip, que es lo que el cliente baja.
//
// El zip se COMMITEA para que Vercel lo sirva estático (armarlo al vuelo en una
// función serverless obliga a leer del filesystem, que en el bundle no es
// confiable). Y por eso mismo puede quedar viejo: `--check` falla si la
// extensión cambió y nadie regeneró el zip, igual que la guarda de plugin/.
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';

const RAIZ = process.cwd();
const ORIGEN = resolve(RAIZ, 'extension');
// ⚠️ La ruta del ZIP no vive acá: cuelga de la version, y la version se lee con
// `leer()` —que en `--check` lee de HEAD y no del disco—. Está más abajo, apenas
// después de esa lectura.
const HUELLA = resolve(RAIZ, 'public/mako-puente.sha');
// La versión que se está sirviendo, como módulo importable desde la app. Se
// GENERA acá y no se escribe a mano: copiada, se queda vieja el día que alguien
// suba el manifest y no la toque, y el síntoma sería un aviso de «hay versión
// nueva» que no se apaga nunca (o peor: uno que nunca aparece).
const VERSION_TS = resolve(RAIZ, 'lib/extension-version.ts');


const CHEQUEO = process.argv.includes('--check');

/**
 * ⚠️ EN MODO `--check` LA EXTENSIÓN SE LEE DE **HEAD**, NO DEL DISCO.
 *
 * La guarda de abajo ya aplicaba esta lección a las SALIDAS (el zip, la huella y
 * `extension-version.ts` tienen que estar commiteados) y se la había salteado a la
 * ENTRADA: la huella se calculaba con `readdirSync`/`readFileSync` sobre `extension/`.
 *
 * Con eso, cualquier edición a medio hacer de OTRA sesión bloquea el push de todos: el
 * 30/08/2026 una sesión no pudo pushear trabajo del portal de cursos porque la otra tenía
 * `background.js`, `content.js` e `injected.js` modificados sin commitear. Y era la misma
 * trampa que el verificador del catálogo de cursos ya había cometido —bloqueó a la sesión
 * vecina el 29/08— con la misma cura: preguntar por lo que se PUBLICA, no por lo que hay
 * en el disco de quien pushea. Sesiones en paralelo sobre un mismo clon es lo normal acá.
 *
 * Generando (sin `--check`) sí se lee el disco: ahí el que corre el script es el autor de
 * la extensión y lo que quiere empaquetar es lo que acaba de escribir.
 */
const deHead = (ruta) => execSync(`git show HEAD:${ruta}`, { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
const listarHead = () => execSync('git ls-tree HEAD extension/ --name-only', { encoding: 'utf8' })
  .split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^extension\//, ''))
  .filter((f) => f && !f.startsWith('.')).sort();

const leer = (f) => (CHEQUEO ? deHead(`extension/${f}`) : readFileSync(resolve(ORIGEN, f)));

const version = JSON.parse(leer('manifest.json').toString('utf8')).version;

/**
 * ⚠️ EL NOMBRE DEL ARCHIVO LLEVA LA VERSION, y no es cosmetico.
 *
 * Con un nombre fijo, todo lo que hay entre el repo y la carpeta que Chrome carga
 * puede quedarse viejo sin que nada lo diga: el cache del navegador, el del CDN, y
 * sobre todo la carpeta de Descargas — si ya existe `mako-puente.zip`, Chrome guarda
 * la nueva como `mako-puente (1).zip` y la carpeta descomprimida de antes sigue ahi,
 * con el mismo nombre. La persona carga la vieja y no tiene forma de saberlo.
 *
 * Este repo ya pago esa forma exacta: un cliente estuvo horas corriendo una copia de
 * la extension de dos horas antes.
 *
 * Con la version en el nombre las tres se caen solas: cada version es una URL
 * distinta —asi que ningun cache puede servir la anterior—, el archivo dice cual es
 * sin abrirlo, y como el zip trae los archivos SUELTOS en la raiz, la carpeta que
 * queda al descomprimir hereda el nombre: `mako-puente-0.40.0`. El paso de
 * «elegi la carpeta» deja de ser ambiguo, que es donde mas gente se perdio.
 *
 * ⚠️ Y se borra la anterior en la misma corrida: dos zips en `public/` es volver a
 * tener dos candidatos, que es el problema con otro nombre.
 */
const NOMBRE_ZIP = (v) => `mako-puente-${v}.zip`;
const ZIP = resolve(RAIZ, `public/${NOMBRE_ZIP(version)}`);

const moduloVersion = `// GENERADO por scripts/zip-extension.mjs — no editar a mano.
//
// La versión que hay dentro de public/mako-puente.zip, o sea la que un cliente se
// lleva si lo descarga hoy. La pantalla la compara con la que el navegador tiene
// instalada para avisar cuando quedó vieja.
//
// Sin \`server-only\`: la lee un client component.
export const EXTENSION_VERSION = '${version}';
`;

const archivos = CHEQUEO ? listarHead() : readdirSync(ORIGEN).filter((f) => !f.startsWith('.')).sort();

// La huella se calcula sobre el CONTENIDO, no sobre el zip: un zip trae
// timestamps y no es reproducible byte a byte, así que compararlo consigo mismo
// daría distinto en cada corrida.
const h = createHash('sha256');
for (const f of archivos) {
  h.update(f);
  h.update(leer(f));
}
const huella = h.digest('hex');

if (CHEQUEO) {
  const guardada = existsSync(HUELLA) ? readFileSync(HUELLA, 'utf8').trim() : '';
  if (guardada !== huella) {
    console.error('\n  ✖ public/mako-puente.zip quedó viejo: la extensión cambió.');
    console.error('    Corré: node scripts/zip-extension.mjs\n');
    process.exit(1);
  }
  // ⚠️ Sin los `\r`: `moduloVersion` se arma con `\n` y git deja el archivo en CRLF al
  //    sacarlo, así que la comparación exacta pasa SOLO en el clon donde el script corrió
  //    alguna vez. Es el cuarto guard de esta familia con el mismo bug — los otros tres
  //    son sync-contrato-detalle, sync-gramatica-doc y generar-plugin.
  const sinCR = (s) => s.replace(/\r\n/g, '\n');
  const tsGuardado = existsSync(VERSION_TS) ? readFileSync(VERSION_TS, 'utf8') : '';
  if (sinCR(tsGuardado) !== sinCR(moduloVersion)) {
    console.error('\n  ✖ lib/extension-version.ts no coincide con el manifest.');
    console.error('    Corré: node scripts/zip-extension.mjs\n');
    process.exit(1);
  }
  // ⚠️ Y que esté al día EN DISCO no alcanza: lo que se despliega es el COMMIT.
  //
  // Costó una tarde: `lib/extension-version.ts` lo genera este script, quedó
  // correcto en disco —así que este chequeo pasaba— pero nunca se agregó a
  // ningún commit. Producción siguió sirviendo `0.6.0` mientras el cliente tenía
  // `0.10.0`, y la pantalla le decía «tu extensión quedó vieja: tienes la 0.10.0
  // y la actual es la 0.6.0». Un aviso absurdo que además hace desconfiar de
  // todos los demás avisos.
  //
  // Es el mismo modo de falla que el catálogo de cursos: un guard que mira el
  // ÁRBOL cuando lo que se publica es el commit.
  const sinCommitear = execSync('git status --porcelain -- lib/extension-version.ts public/mako-puente*.zip public/mako-puente.sha', { encoding: 'utf8' }).trim();
  if (sinCommitear) {
    console.error('\n  ✖ Lo generado de la extensión NO está en el commit:');
    for (const l of sinCommitear.split('\n')) console.error(`      ${l.trim()}`);
    console.error('\n    Se despliega el COMMIT, no el disco. Agregalos:');
    console.error('      git add -A lib/extension-version.ts public/mako-puente.sha public/mako-puente*.zip\n');
    process.exit(1);
  }

  console.log(`  ✓ public/${NOMBRE_ZIP(version)} al día`);
  process.exit(0);
}

/**
 * El manifest del PAQUETE, que no es el de desarrollo.
 *
 * Saca los matches de `localhost`: existen para probar contra el server local y
 * no tienen ningún uso para un cliente. Un permiso sin uso visible es de los
 * motivos más comunes de rechazo en la revisión de la Chrome Web Store, y acá
 * además sería cierto que no se usa.
 */
function manifestParaPaquete(crudo) {
  const m = JSON.parse(crudo);
  for (const cs of m.content_scripts ?? []) {
    cs.matches = (cs.matches ?? []).filter((x) => !x.includes('localhost'));
  }
  m.content_scripts = (m.content_scripts ?? []).filter((cs) => cs.matches.length > 0);
  return JSON.stringify(m, null, 2) + '\n';
}

const zip = new JSZip();
for (const f of archivos) {
  const buf = readFileSync(resolve(ORIGEN, f));
  zip.file(f, f === 'manifest.json' ? manifestParaPaquete(buf.toString('utf8')) : buf);
}
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(ZIP, buf);
writeFileSync(HUELLA, `${huella}\n`);
writeFileSync(VERSION_TS, moduloVersion);
// Las de versiones anteriores se van: dos zips en public/ son dos candidatos.
for (const viejo of readdirSync(resolve(RAIZ, 'public')).filter((f) => /^mako-puente-.*\.zip$/.test(f))) {
  if (viejo === NOMBRE_ZIP(version)) continue;
  rmSync(resolve(RAIZ, 'public', viejo));
  console.log(`   · borrado public/${viejo}`);
}
console.log(`✅ public/${NOMBRE_ZIP(version)} (${archivos.length} archivos, ${(buf.length / 1024).toFixed(1)} KB)`);

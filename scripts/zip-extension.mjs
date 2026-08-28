// Empaqueta extension/ en public/mako-puente.zip, que es lo que el cliente baja.
//
// El zip se COMMITEA para que Vercel lo sirva estático (armarlo al vuelo en una
// función serverless obliga a leer del filesystem, que en el bundle no es
// confiable). Y por eso mismo puede quedar viejo: `--check` falla si la
// extensión cambió y nadie regeneró el zip, igual que la guarda de plugin/.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';

const RAIZ = process.cwd();
const ORIGEN = resolve(RAIZ, 'extension');
const ZIP = resolve(RAIZ, 'public/mako-puente.zip');
const HUELLA = resolve(RAIZ, 'public/mako-puente.sha');
// La versión que se está sirviendo, como módulo importable desde la app. Se
// GENERA acá y no se escribe a mano: copiada, se queda vieja el día que alguien
// suba el manifest y no la toque, y el síntoma sería un aviso de «hay versión
// nueva» que no se apaga nunca (o peor: uno que nunca aparece).
const VERSION_TS = resolve(RAIZ, 'lib/extension-version.ts');

const version = JSON.parse(readFileSync(resolve(ORIGEN, 'manifest.json'), 'utf8')).version;

const moduloVersion = `// GENERADO por scripts/zip-extension.mjs — no editar a mano.
//
// La versión que hay dentro de public/mako-puente.zip, o sea la que un cliente se
// lleva si lo descarga hoy. La pantalla la compara con la que el navegador tiene
// instalada para avisar cuando quedó vieja.
//
// Sin \`server-only\`: la lee un client component.
export const EXTENSION_VERSION = '${version}';
`;

const archivos = readdirSync(ORIGEN).filter((f) => !f.startsWith('.')).sort();

// La huella se calcula sobre el CONTENIDO, no sobre el zip: un zip trae
// timestamps y no es reproducible byte a byte, así que compararlo consigo mismo
// daría distinto en cada corrida.
const h = createHash('sha256');
for (const f of archivos) {
  h.update(f);
  h.update(readFileSync(resolve(ORIGEN, f)));
}
const huella = h.digest('hex');

if (process.argv.includes('--check')) {
  const guardada = existsSync(HUELLA) ? readFileSync(HUELLA, 'utf8').trim() : '';
  if (guardada !== huella) {
    console.error('\n  ✖ public/mako-puente.zip quedó viejo: la extensión cambió.');
    console.error('    Corré: node scripts/zip-extension.mjs\n');
    process.exit(1);
  }
  const tsGuardado = existsSync(VERSION_TS) ? readFileSync(VERSION_TS, 'utf8') : '';
  if (tsGuardado !== moduloVersion) {
    console.error('\n  ✖ lib/extension-version.ts no coincide con el manifest.');
    console.error('    Corré: node scripts/zip-extension.mjs\n');
    process.exit(1);
  }
  console.log('  ✓ public/mako-puente.zip al día');
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
console.log(`✅ public/mako-puente.zip (${archivos.length} archivos, ${(buf.length / 1024).toFixed(1)} KB)`);

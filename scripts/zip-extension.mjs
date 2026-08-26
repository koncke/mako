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
  console.log('  ✓ public/mako-puente.zip al día');
  process.exit(0);
}

const zip = new JSZip();
for (const f of archivos) zip.file(f, readFileSync(resolve(ORIGEN, f)));
const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
writeFileSync(ZIP, buf);
writeFileSync(HUELLA, `${huella}\n`);
console.log(`✅ public/mako-puente.zip (${archivos.length} archivos, ${(buf.length / 1024).toFixed(1)} KB)`);

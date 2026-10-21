// =============================================================================
// publicar-binarios — arma «MaKo en tu computadora» para Windows y Mac y lo sube al bucket privado `ia-pc`
// =============================================================================
// Uso, desde la raíz de este repo:
//   npx tsx --conditions=react-server scripts/ia-pc/publicar-binarios.mts [--env <.env.local>]            ← en seco
//   npx tsx --conditions=react-server scripts/ia-pc/publicar-binarios.mts --aplicar [--env <.env.local>]  ← sube
//
// Un ejecutable de un archivo por sistema (Bun compila para los tres desde esta PC), comprimido: el de Windows mide 118
// MB y comprimido 41, y Supabase corta en 50 por archivo (medido el 21/10/2026). El instalador
// (/api/ia-pc/instalar) baja de acá con una URL firmada de 10 minutos y lo descomprime en la PC del cliente.
// ⚠️ ESCRIBE en el storage de .env.local (PRODUCCIÓN) sólo con --aplicar. Reemplaza los de la MISMA versión.
// =============================================================================
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: arg('--env') ?? path.join(process.cwd(), '.env.local'), quiet: true });
const APLICAR = process.argv.includes('--aplicar');

const { VERSION_PC, archivoDelPrograma, marcarDeVentana, subsistemaPe } = await imp('lib/ia-pc-reglas.ts');
const programa = path.join(REPO, 'scripts', 'ia-pc', 'mako-pc.mjs');
const vPrograma = /export const VERSION = '([^']+)'/.exec(readFileSync(programa, 'utf8'))?.[1];
if (vPrograma !== VERSION_PC) { console.error(`⛔ el programa dice ${vPrograma} y lib/ia-pc-reglas.ts dice ${VERSION_PC}: tienen que ser iguales.`); process.exit(1); }

const BUN = 'bun@1.2.21';
const OBJETIVOS = [
  { archivo: 'windows-x64', target: 'bun-windows-x64', salida: 'mako-pc.exe' },
  { archivo: 'mac-arm64', target: 'bun-darwin-arm64', salida: 'mako-pc-mac-arm64' },
  { archivo: 'mac-x64', target: 'bun-darwin-x64', salida: 'mako-pc-mac-x64' },
] as const;
const dir = mkdtempSync(path.join(tmpdir(), 'mako-pc-binarios-'));
console.log(`${APLICAR ? 'APLICAR' : 'EN SECO'} · versión ${VERSION_PC} · en ${dir}`);
const armados: Array<{ nombre: string; datos: Buffer }> = [];
for (const o of OBJETIVOS) {
  const salida = path.join(dir, o.salida);
  execFileSync('npx', ['--yes', BUN, 'build', programa, '--compile', `--target=${o.target}`, '--outfile', salida], { stdio: 'inherit', shell: process.platform === 'win32' });
  let bytes: Uint8Array = readFileSync(salida);
  if (o.archivo === 'windows-x64') {
    // DE VENTANA, no de consola: arrancado al iniciar sesión, uno de consola abre una ventana negra (lib/ia-pc-reglas.ts).
    bytes = marcarDeVentana(bytes);
    if (subsistemaPe(bytes) !== 2) { console.error('⛔ el ejecutable de Windows no quedó «de ventana»'); process.exit(1); }
    writeFileSync(salida, bytes);
    console.log('  windows-x64: marcado «de ventana» (subsistema 2)');
  }
  const datos = gzipSync(bytes, { level: 9 });
  const nombre = archivoDelPrograma(o.archivo);
  console.log(`  ${nombre}: ${Math.round(statSync(salida).size / 1e6)} MB → ${Math.round(datos.length / 1e6)} MB comprimido`);
  if (datos.length > 50e6) { console.error(`⛔ ${nombre} pasa los 50 MB de Supabase`); process.exit(1); }
  armados.push({ nombre, datos });
}
if (!APLICAR) { console.log('En seco: no se subió nada. Con --aplicar se suben.'); process.exit(0); }

const { getSupabaseServer } = await imp('lib/supabase.ts');
const storage = getSupabaseServer().storage;
const { data: buckets } = await storage.listBuckets();
if (!buckets?.some((b: { name: string }) => b.name === 'ia-pc')) {
  const { error } = await storage.createBucket('ia-pc', { public: false });
  if (error) { console.error(`⛔ no pude crear el bucket: ${error.message}`); process.exit(1); }
  console.log('  bucket `ia-pc` creado (privado)');
}
for (const a of armados) {
  const { error } = await storage.from('ia-pc').upload(a.nombre, a.datos, { contentType: 'application/gzip', upsert: true });
  console.log(error ? `  ⛔ ${a.nombre}: ${error.message}` : `  ✓ ${a.nombre} subido`);
}
process.exit(0);

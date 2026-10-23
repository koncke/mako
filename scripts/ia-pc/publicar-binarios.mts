// =============================================================================
// publicar-binarios — arma «MaKo en tu computadora» para Windows y Mac y lo sube al bucket privado `ia-pc`
// =============================================================================
// Uso, desde la raíz de un worktree de origin/main (la versión que sube es la de ESE código, VERSION_PC):
//   npx tsx --conditions=react-server scripts/ia-pc/publicar-binarios.mts --env <.env.local>            ← en seco
//   npx tsx --conditions=react-server scripts/ia-pc/publicar-binarios.mts --aplicar --env <.env.local>  ← sube
// Un worktree no trae `.env.local`: va el del clon (C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/
// dashboard-marketing/.env.local). Sin `--env` y sin `.env.local` en la carpeta, el script lo dice y sale.
// La firma de Windows (cuando Martín tenga el certificado de SSL.com) sale de %USERPROFILE%\.mako-firma.env
// o de `--firma <ruta>`: los pasos en docs/plan-instalador-escritorio.md › Firmar. Sin ese archivo, sube sin firmar.
//
// Un ejecutable de un archivo por sistema (Bun compila para los tres desde esta PC), comprimido: el de Windows mide 118
// MB y comprimido 41, y Supabase corta en 50 por archivo (medido el 21/10/2026). El instalador
// (/api/ia-pc/instalar) baja de acá con una URL firmada de 10 minutos y lo descomprime en la PC del cliente.
// ⚠️ ESCRIBE en el storage de .env.local (PRODUCCIÓN) sólo con --aplicar. Reemplaza los de la MISMA versión.
//
// IA1 (22/10/2026): la 0.3.2 se desplegó sin sus ejecutables y el instalador contestaba «No pude preparar la descarga» con
// un 200, a todo cliente nuevo. Por eso, en seco, el script MIRA el bucket (sólo lectura) y dice qué falta; y al aplicar
// no termina hasta FIRMAR cada archivo subido, que es lo mismo que hace el instalador: «subido» no es «se puede bajar».
// =============================================================================
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { gzipSync } from 'node:zlib';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const arg = (n: string) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
const ENV = arg('--env') ?? path.join(process.cwd(), '.env.local');
if (!existsSync(ENV)) {
  console.error(`⛔ no está ${ENV}: un worktree no trae .env.local. Pásale el del clon con --env <ruta>.`);
  process.exit(1);
}
(dotenv.default ?? dotenv).config({ path: ENV, quiet: true });
const APLICAR = process.argv.includes('--aplicar');
// La FIRMA de Windows (SSL.com eSigner, scripts/ia-pc/firmar-windows.mjs). Las claves van en un archivo FUERA de OneDrive
// (--firma <ruta>, si no %USERPROFILE%\.mako-firma.env): el .env.local del clon está en el Escritorio, que OneDrive sube.
// Sin ese archivo se arma sin firmar, como hasta la 0.4.2; a medio cargar, o con las claves en el .env.local, no se arma.
const { firmaDeEstaPc, firmarExe, peFirmado } = await import(pathToFileURL(path.join(REPO, 'scripts', 'ia-pc', 'firmar-windows.mjs')).href);
const ARCHIVO_FIRMA = arg('--firma') ?? path.join(homedir(), '.mako-firma.env');
let FIRMA: { herramienta: string } | null = null;
try {
  FIRMA = firmaDeEstaPc({ envLocal: readFileSync(ENV, 'utf8'), rutaFirma: ARCHIVO_FIRMA, pedida: arg('--firma') != null, parse: (dotenv.default ?? dotenv).parse });
} catch (e) { console.error(`⛔ ${(e as Error).message}`); process.exit(1); }
// Cada archivo firmado gasta una firma del plan de eSigner: en seco no se firma, salvo con --probar-firma (y si falla, al
// aplicar se corta ANTES de subir nada).
const FIRMAR = FIRMA != null && (APLICAR || process.argv.includes('--probar-firma'));
/** Firma un .exe en su lugar (o corta todo, ANTES de subir nada, sin las claves en el mensaje). */
const firmar = (archivo: string): Uint8Array => {
  try { return firmarExe(FIRMA, archivo); } catch (e) { console.error(`⛔ ${(e as Error).message}`); process.exit(1); }
};
// La de la Mac (Developer ID + notarización con rcodesign, scripts/ia-pc/firmar-mac.mjs): activa cuando el certificado de Apple
// está en %USERPROFILE%\.mako-firma-mac. Sin él, la app sin firmar de la 0.4.2. Como la de Windows: en seco, sólo con --probar-firma.
const { entradasDeLaApp, firmaMacDeEstaPc, firmarAppMac, machoUniversal } = await import(pathToFileURL(path.join(REPO, 'scripts', 'ia-pc', 'firmar-mac.mjs')).href);
let FIRMA_MAC: { carpeta: string } | null = null;
try {
  FIRMA_MAC = firmaMacDeEstaPc({ rutaFirma: ARCHIVO_FIRMA, parse: (dotenv.default ?? dotenv).parse });
} catch (e) { console.error(`⛔ ${(e as Error).message}`); process.exit(1); }
const FIRMAR_MAC = FIRMA_MAC != null && (APLICAR || process.argv.includes('--probar-firma'));

const { VERSION_PC, archivoDelInstalador, archivoDelInstaladorMac, archivoDelPrograma, faltanEnElBucket, infoPlistDeLaAppMac, lanzadorDeLaAppMac, marcarDeVentana, nombreDelInstalador, subsistemaPe } = await imp('lib/ia-pc-reglas.ts');
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
console.log(FIRMAR ? `  Windows: se firma con SSL.com eSigner (${FIRMA!.herramienta}; gasta 2 firmas)` : FIRMA ? '  Windows: la firma está cargada; en seco no se firma (--probar-firma para probarla)' : `  Windows: SIN firmar (no está ${ARCHIVO_FIRMA}; docs/plan-instalador-escritorio.md › Firmar)`);
console.log(FIRMAR_MAC ? `  Mac: se firma y se notariza (Developer ID, ${FIRMA_MAC!.carpeta})` : FIRMA_MAC ? '  Mac: la firma está cargada; en seco no se firma (--probar-firma para probarla)' : '  Mac: SIN firmar (falta el certificado de Apple; docs/plan-instalador-escritorio.md › Firmar la Mac)');
const armados: Array<{ nombre: string; datos: Buffer; tipo?: string }> = [];
/** Los programas sin comprimir, para MaKo.app (la Mac). */
const crudos: Record<string, Uint8Array> = {};
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
    // La firma va DESPUÉS de marcarlo (cubre la cabecera: tocarla después la rompe) y ANTES de Inno, que lo mete en el setup.
    if (FIRMAR) {
      bytes = firmar(salida);
      if (subsistemaPe(bytes) !== 2) { console.error('⛔ firmado, el ejecutable de Windows dejó de ser «de ventana»'); process.exit(1); }
      console.log('  windows-x64: firmado (SSL.com)');
    }
  }
  crudos[o.archivo] = bytes;
  const datos = gzipSync(bytes, { level: 9 });
  const nombre = archivoDelPrograma(o.archivo);
  console.log(`  ${nombre}: ${Math.round(statSync(salida).size / 1e6)} MB → ${Math.round(datos.length / 1e6)} MB comprimido`);
  if (datos.length > 50e6) { console.error(`⛔ ${nombre} pasa los 50 MB de Supabase`); process.exit(1); }
  armados.push({ nombre, datos });
}
// El instalador CON ASISTENTE de Windows (0.4.0, installer/windows/mako.iss), con el programa de recién: Inno Setup 6 en esta
// PC (winget install --id JRSoftware.InnoSetup -e --scope user). Sin comprimir: Inno ya comprime.
const ISCC = process.env.ISCC ?? path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Inno Setup 6', 'ISCC.exe');
if (!existsSync(ISCC)) { console.error(`⛔ falta Inno Setup 6 (${ISCC}): winget install --id JRSoftware.InnoSetup -e --scope user`); process.exit(1); }
execFileSync(ISCC, ['/Q', `/DAppVersion=${VERSION_PC}`, `/DPrograma=${path.join(dir, 'mako-pc.exe')}`, `/O${dir}`, path.join(REPO, 'installer', 'windows', 'mako.iss')], { stdio: 'inherit' });
const rutaDelSetup = path.join(dir, nombreDelInstalador());
if (FIRMAR) { firmar(rutaDelSetup); console.log(`  ${archivoDelInstalador()}: firmado (SSL.com)`); }
const setup = readFileSync(rutaDelSetup);
if (subsistemaPe(setup) !== 2) { console.error('⛔ el instalador no es un ejecutable de Windows con ventana'); process.exit(1); }
// Con firma, NINGÚN .exe sube sin ella (lo que se baja es esto, no lo que dijo la herramienta).
if (FIRMAR && !(peFirmado(crudos['windows-x64']) && peFirmado(setup))) { console.error('⛔ con la firma cargada, un .exe quedó sin firmar'); process.exit(1); }
console.log(`  ${archivoDelInstalador()}: ${Math.round(setup.length / 1e6)} MB (el instalador con asistente)`);
if (setup.length > 50e6) { console.error(`⛔ ${archivoDelInstalador()} pasa los 50 MB de Supabase`); process.exit(1); }
armados.push({ nombre: archivoDelInstalador(), datos: setup, tipo: 'application/octet-stream' });
// MaKo.app para la Mac (0.4.2): un .zip «hecho en Unix» (scripts/ia-pc/zip-unix.mjs) con el lanzador y los dos programas, con
// sus permisos: sin ellos, el Archive Utility de la Mac la deja sin poder abrirse.
const { zipConPermisos } = await import(pathToFileURL(path.join(REPO, 'scripts', 'ia-pc', 'zip-unix.mjs')).href);
let appMac: Buffer;
if (FIRMAR_MAC) {
  // FIRMADA: el ejecutable de la app es UN universal (Intel y Apple) del programa, no el guion (la firma de un guion vive en
  // atributos que el .zip no guarda). Se firma, se notariza y se engrapa ANTES de zipearla; si algo falla, no sube nada.
  const app = path.join(dir, 'mac', 'MaKo.app');
  mkdirSync(path.join(app, 'Contents', 'MacOS'), { recursive: true });
  writeFileSync(path.join(app, 'Contents', 'Info.plist'), infoPlistDeLaAppMac());
  writeFileSync(path.join(app, 'Contents', 'MacOS', 'MaKo'), machoUniversal([crudos['mac-x64'], crudos['mac-arm64']]));
  try { firmarAppMac(FIRMA_MAC, app); } catch (e) { console.error(`⛔ ${(e as Error).message}`); process.exit(1); }
  appMac = zipConPermisos(entradasDeLaApp(app));
  console.log('  Mac: MaKo.app firmada, notarizada y engrapada (Developer ID)');
} else {
  appMac = zipConPermisos([
    { nombre: 'MaKo.app', dir: true },
    { nombre: 'MaKo.app/Contents', dir: true },
    { nombre: 'MaKo.app/Contents/Info.plist', datos: infoPlistDeLaAppMac(), modo: 0o644 },
    { nombre: 'MaKo.app/Contents/MacOS', dir: true },
    { nombre: 'MaKo.app/Contents/MacOS/MaKo', datos: lanzadorDeLaAppMac(), modo: 0o755 },
    { nombre: 'MaKo.app/Contents/Resources', dir: true },
    { nombre: 'MaKo.app/Contents/Resources/mako-pc-arm64', datos: crudos['mac-arm64'], modo: 0o755 },
    { nombre: 'MaKo.app/Contents/Resources/mako-pc-x64', datos: crudos['mac-x64'], modo: 0o755 },
  ]);
}
console.log(`  ${archivoDelInstaladorMac()}: ${Math.round(appMac.length / 1e6)} MB (MaKo.app para la Mac)`);
if (appMac.length > 50e6) { console.error(`⛔ ${archivoDelInstaladorMac()} pasa los 50 MB de Supabase`); process.exit(1); }
armados.push({ nombre: archivoDelInstaladorMac(), datos: appMac, tipo: 'application/zip' });
const { getSupabaseServer } = await imp('lib/supabase.ts');
const storage = getSupabaseServer().storage;
// Lo que hay hoy en el bucket (sólo lectura): en seco se dice qué falta; al aplicar, qué se reemplaza.
const { data: listado, error: errLista } = await storage.from('ia-pc').list('', { limit: 1000 });
if (errLista) console.log(`  (no pude mirar el bucket: ${errLista.message})`);
else {
  const { faltan, versiones } = faltanEnElBucket((listado ?? []).map((f: { name: string }) => f.name));
  console.log(`  en el bucket hoy: ${versiones.length ? versiones.join(', ') : 'nada'} · de la ${VERSION_PC} ${faltan.length ? `faltan ${faltan.length}: ${faltan.join(', ')}` : `están los ${armados.length} (se reemplazan)`}`);
}
/**
 * Sube y firma. Devuelve el código de salida. ⚠️ Sin `process.exit()` después de los pedidos: en Windows, Node revienta
 * así después de varios `fetch` («Assertion failed … async.c line 94», 0xC0000409; medido en el seco del 22/10) y el
 * código de salida miente. Se deja `process.exitCode` y el proceso termina solo (con un reloj de respaldo, abajo).
 */
async function subir(): Promise<number> {
  if (!APLICAR) { console.log('En seco: no se subió nada. Con --aplicar se suben.'); return 0; }
  const { data: buckets } = await storage.listBuckets();
  if (!buckets?.some((b: { name: string }) => b.name === 'ia-pc')) {
    const { error } = await storage.createBucket('ia-pc', { public: false });
    if (error) { console.error(`⛔ no pude crear el bucket: ${error.message}`); return 1; }
    console.log('  bucket `ia-pc` creado (privado)');
  }
  let mal = 0;
  for (const a of armados) {
    const { error } = await storage.from('ia-pc').upload(a.nombre, a.datos, { contentType: a.tipo ?? 'application/gzip', upsert: true });
    if (error) mal++;
    console.log(error ? `  ⛔ ${a.nombre}: ${error.message}` : `  ✓ ${a.nombre} subido`);
  }
  // «Subido» no es «se puede bajar»: se firma cada uno, como hace el instalador (app/api/ia-pc/instalar/route.ts).
  for (const a of armados) {
    const { data, error } = await storage.from('ia-pc').createSignedUrl(a.nombre, 60);
    if (error || !data?.signedUrl) mal++;
    console.log(error || !data?.signedUrl ? `  ⛔ ${a.nombre} no firma: ${error?.message ?? 'sin URL'}` : `  ✓ ${a.nombre} firma bien`);
  }
  console.log(mal ? `⛔ ${mal} cosas fallaron: el instalador de la ${VERSION_PC} NO anda todavía.` : `✓ La ${VERSION_PC} está completa: el instalador ya puede bajarla.`);
  return mal ? 1 : 0;
}
process.exitCode = await subir();
setTimeout(() => process.exit(), 10_000).unref();

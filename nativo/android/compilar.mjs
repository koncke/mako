// =============================================================================
// compilar — arma el .aab firmado de la app de Android, sin preguntar nada en la consola (3/11/2026)
// =============================================================================
// Es lo que hace `bubblewrap build`, pero sus preguntas (dónde bajar el JDK, la contraseña) no se pueden contestar sin una persona. Uso, desde
// nativo/android, con el proyecto ya generado (`node generar.mjs`):
//
//   node compilar.mjs --acepto-terminos-android-sdk
//
// ⚠️ ESE FLAG ES DE MARTÍN: instalar el SDK de Android es aceptar sus términos (developer.android.com/studio/terms). Sin el flag, no baja nada.
// ⚠️ PIDE UNA VENTANA DE RAM: Gradle, unos 2 GB durante 5 a 10 minutos. Baja el JDK 17 y el SDK a ~/.bubblewrap la primera vez (unos 600 MB).
// ⚠️ LA CLAVE DE SUBIDA NUNCA VA AL REPO: vive en ~/.mako-tiendas, junto con su contraseña, y no sale por pantalla. Se crea una vez; si ya está, se
//    usa ésa. Martín guarda una copia: con Play App Signing, perderla no es fatal (Google rota la de subida), pero son días de trámite.
// =============================================================================

import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ACA = dirname(fileURLToPath(import.meta.url));
const RAIZ_REPO = resolve(ACA, '..', '..');
const CLAVES = process.env.MAKO_TIENDAS_CLAVES || join(homedir(), '.mako-tiendas');
const BW = join(homedir(), '.bubblewrap');
const JDK_URL = 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse';
const SDK_URL = 'https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip';
const PLATAFORMA = 'platforms;android-36';
const BUILD_TOOLS = 'build-tools;36.0.0';
const ALIAS = 'mako-upload';

function salir(m) { console.error(`⛔ ${m}`); process.exit(1); }

if (!process.argv.includes('--acepto-terminos-android-sdk')) salir('Falta --acepto-terminos-android-sdk: esa aceptación es de Martín.');
if (!existsSync(join(ACA, 'gradlew.bat'))) salir('Falta el proyecto: corre primero `node generar.mjs`.');
if (resolve(CLAVES).toLowerCase().startsWith(RAIZ_REPO.toLowerCase())) salir('La clave de firma no puede vivir adentro del repo.');

async function bajarYAbrir(url, destino) {
  mkdirSync(destino, { recursive: true });
  const zip = join(destino, 'bajado.zip');
  console.log(`Bajando ${url}…`);
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) salir(`No pude bajar ${url}: ${r.status}`);
  writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
  console.log(`  ${Math.round(readFileSync(zip).length / 1e6)} MB`);
  execFileSync('C:/Windows/System32/tar.exe', ['-xf', zip, '-C', destino], { stdio: 'inherit' });
  rmSync(zip);
}

// ── El JDK 17 y el SDK ───────────────────────────────────────────────────────
const dirJdk = join(BW, 'jdk');
if (!existsSync(dirJdk) || !readdirSync(dirJdk).some((d) => d.startsWith('jdk-17'))) await bajarYAbrir(JDK_URL, dirJdk);
const JAVA_HOME = join(dirJdk, readdirSync(dirJdk).find((d) => d.startsWith('jdk-17')));
const java = (b) => join(JAVA_HOME, 'bin', `${b}.exe`);

const ANDROID_HOME = join(BW, 'android_sdk');
const sdkmanager = join(ANDROID_HOME, 'cmdline-tools', 'bin', 'sdkmanager.bat');
if (!existsSync(sdkmanager)) await bajarYAbrir(SDK_URL, ANDROID_HOME);
const entorno = { ...process.env, JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT: ANDROID_HOME };
const sdk = (args, input) => execFileSync('cmd.exe', ['/c', sdkmanager, `--sdk_root=${ANDROID_HOME}`, ...args], { env: entorno, input, stdio: [input ? 'pipe' : 'inherit', 'inherit', 'inherit'] });
sdk(['--licenses'], 'y\n'.repeat(20));
if (!existsSync(join(ANDROID_HOME, 'platforms', 'android-36'))) sdk(['platform-tools', PLATAFORMA, BUILD_TOOLS]);

// ── La clave de subida ───────────────────────────────────────────────────────
mkdirSync(CLAVES, { recursive: true });
const keystore = join(CLAVES, 'upload.keystore');
const archivoClave = join(CLAVES, 'upload.keystore.password.txt');
if (!existsSync(keystore)) {
  const pass = randomBytes(24).toString('base64url');
  writeFileSync(archivoClave, `${pass}\n`, { mode: 0o600 });
  execFileSync(java('keytool'), ['-genkeypair', '-v', '-keystore', keystore, '-alias', ALIAS, '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000',
    '-storepass', pass, '-keypass', pass, '-dname', 'CN=MaKo, O=MaKo, C=AR'], { env: entorno, stdio: 'ignore' });
  console.log(`Clave de subida nueva en ${keystore}. Su contraseña, en ${archivoClave}.`);
}
const pass = readFileSync(archivoClave, 'utf8').trim();
const huella = /SHA256:\s*([0-9A-F:]{95})/.exec(execFileSync(java('keytool'), ['-list', '-v', '-keystore', keystore, '-alias', ALIAS, '-storepass', pass], { env: entorno, encoding: 'utf8' }))?.[1];

// ── Gradle ───────────────────────────────────────────────────────────────────
writeFileSync(join(ACA, 'local.properties'), `sdk.dir=${ANDROID_HOME.replace(/\\/g, '/')}\n`);
execFileSync('cmd.exe', ['/c', join(ACA, 'gradlew.bat'), 'bundleRelease', '--no-daemon', '--console=plain', '-Dorg.gradle.jvmargs=-Xmx1536m'], { cwd: ACA, env: entorno, stdio: 'inherit' });

const crudo = join(ACA, 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab');
if (!existsSync(crudo)) salir('Gradle terminó y no está el .aab.');
const firmado = join(ACA, 'mako-1.0.0.aab');
copyFileSync(crudo, firmado);
execFileSync(java('jarsigner'), ['-sigalg', 'SHA256withRSA', '-digestalg', 'SHA-256', '-keystore', keystore, '-storepass', pass, firmado, ALIAS], { env: entorno, stdio: 'ignore' });
execFileSync(java('jarsigner'), ['-verify', firmado], { env: entorno, stdio: 'ignore' });
const copia = join(CLAVES, 'mako-1.0.0.aab');
copyFileSync(firmado, copia);
console.log(`\n✓ ${copia}\n  Huella de la clave de subida (va a public/.well-known/assetlinks.json con scripts/tiendas-asociar.mjs):\n  ${huella}`);

// =============================================================================
// Las apps de las tiendas (nativo/): el mismo id, lo que pide cada tienda, y la clave de firma fuera del repo (23/10/2026)
// =============================================================================
// Plan: docs/tiendas-play-appstore.md. Cómo se arman: nativo/README.md. Lo que fija este archivo es lo que una tienda
// rechaza o lo que no se arregla después:
//   1. el id `com.holamako.app` en Android, en iOS y en Codemagic (T2: publicado, no se cambia nunca);
//   2. Android abre /inicio de hola-mako.com con el push delegado, y la clave de firma y lo compilado no van al repo;
//   3. iOS: sólo iPhone, los permisos con su porqué, sin cifrado propio, los dominios asociados y el push, la pantalla sin
//      conexión, y el ícono de 1024 sin transparencia (Apple lo rechaza con alfa);
//   4. `nativo/` no entra al chequeo de tipos ni al lint de la app (son proyectos aparte, con su propio package.json).
//
// Correr: node --import tsx --test tests/tiendas-nativo.test.ts
//
// ⚠️ PROBADO ROMPIENDOLO (23/10/2026): ver el pie del archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const leer = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
const ID = 'com.holamako.app';
const twa = JSON.parse(leer('nativo/android/twa-manifest.json'));
const cap = JSON.parse(leer('nativo/ios/capacitor.config.json'));
const pbx = leer('nativo/ios/ios/App/App.xcodeproj/project.pbxproj');
const plist = leer('nativo/ios/ios/App/App/Info.plist');

test('compilar: sin la aceptación de Martín no baja nada, y la clave no vive en el repo', () => {
  const correr = (env: Record<string, string> = {}, args: string[] = []) => {
    try {
      execFileSync(process.execPath, ['nativo/android/compilar.mjs', ...args], { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, ...env } });
      return 'sin error';
    } catch (e) { return String((e as { stderr?: string }).stderr); }
  };
  assert.match(correr(), /Falta --acepto-terminos-android-sdk/);
  const src = leer('nativo/android/compilar.mjs');
  assert.match(src, /if \(resolve\(CLAVES\)\.toLowerCase\(\)\.startsWith\(RAIZ_REPO\.toLowerCase\(\)\)\) salir\(/);
  assert.doesNotMatch(src, /console\.log\([^)]*\bpass\b/, 'la contraseña por pantalla');
  const ignorar = leer('nativo/android/.gitignore');
  for (const g of ['*.keystore', '*.jks', '*.aab', '/local.properties']) assert.ok(ignorar.includes(g), g);
});

test('la cuenta de Apple: el mismo Team ID en la asociación, en Codemagic y en el proyecto, y la app de App Store Connect', () => {
  const TEAM = '99V2VV9FP2';
  const aasa = JSON.parse(leer('public/.well-known/apple-app-site-association')) as { applinks: { details: Array<{ appIDs: string[] }> }; webcredentials: { apps: string[] } };
  assert.deepEqual(aasa.applinks.details[0].appIDs, [`${TEAM}.${ID}`]);
  assert.deepEqual(aasa.webcredentials.apps, [`${TEAM}.${ID}`]);
  const cm = leer('codemagic.yaml');
  assert.match(cm, new RegExp(`APPLE_TEAM_ID: ${TEAM}\\n`));
  assert.match(cm, /APP_STORE_APPLE_ID: 6830383006\n/, 'con 0, el número del build y la subida no encuentran la app');
  assert.equal((pbx.match(new RegExp(`DEVELOPMENT_TEAM = ${TEAM};`, 'g')) ?? []).length, 2, 'Debug y Release');
  assert.ok(!/DEVELOPMENT_TEAM = (?!99V2VV9FP2;)/.test(pbx), 'otro equipo en el proyecto');
});

test('el feature graphic de Play: 1024×500 y sin transparencia', async () => {
  const m = await sharp('nativo/android/feature-graphic.png').metadata();
  assert.equal(m.width, 1024);
  assert.equal(m.height, 500);
  assert.equal(m.hasAlpha, false, 'Play lo rechaza con alfa');
});

test('1. el mismo id en Android, en iOS y en Codemagic', () => {
  assert.equal(twa.packageId, ID);
  assert.equal(cap.appId, ID);
  assert.equal((pbx.match(/PRODUCT_BUNDLE_IDENTIFIER = ([\w.]+);/g) ?? []).length, 2);
  assert.ok(!/PRODUCT_BUNDLE_IDENTIFIER = (?!com\.holamako\.app;)/.test(pbx), 'otro id en el proyecto de Xcode');
  assert.match(leer('codemagic.yaml'), new RegExp(`bundle_identifier: ${ID.replace(/\./g, '\\.')}\\n`));
});

test('2. Android: hola-mako.com/inicio con el push delegado; la clave de firma y lo compilado, fuera del repo', () => {
  assert.equal(twa.host, 'hola-mako.com');
  assert.equal(twa.startUrl, '/inicio');
  assert.equal(twa.enableNotifications, true, 'sin esto el Web Push no llega como notificación de la app');
  assert.ok(Array.isArray(twa.fingerprints), 'las huellas de assetlinks.json');
  assert.match(twa.signingKey.path, /^\.\/[\w-]+\.keystore$/, 'la clave, al lado y relativa');
  const ignorado = leer('nativo/android/.gitignore');
  for (const p of ['*.keystore', '*.jks', '*.aab', '*.apk', '/app/']) assert.ok(ignorado.includes(p), `.gitignore sin ${p}`);
  const versionados = execFileSync('git', ['ls-files', 'nativo'], { encoding: 'utf8' });
  assert.doesNotMatch(versionados, /\.(keystore|jks|aab|apk)\n/, 'una clave de firma o un compilado en el repo');
  assert.match(leer('nativo/android/package.json'), /"@bubblewrap\/core": "1\.27\.0"/, 'la versión cuya plantilla apunta a la API 36');
});

test('3. iOS: sólo iPhone, los permisos con su porqué, los dominios y el push, sin red y el ícono sin alfa', async () => {
  assert.equal(cap.server.url, 'https://hola-mako.com/inicio');
  assert.ok(existsSync(`nativo/ios/www/${cap.server.errorPath}`), 'la pantalla sin conexión no existe');
  assert.equal(cap.ios.appendUserAgent, 'MaKoApp-iOS', 'el modo iOS (paso 3) lee esta marca');
  assert.doesNotMatch(pbx, /TARGETED_DEVICE_FAMILY = "1,2";/, 'ofrecida para iPad: el revisor la prueba ahí (R11)');
  assert.equal((pbx.match(/TARGETED_DEVICE_FAMILY = 1;/g) ?? []).length, 2);
  assert.equal((pbx.match(/CODE_SIGN_ENTITLEMENTS = App\/App\.entitlements;/g) ?? []).length, 2);
  for (const k of ['NSMicrophoneUsageDescription', 'NSCameraUsageDescription', 'NSPhotoLibraryAddUsageDescription']) {
    assert.match(plist, new RegExp(`<key>${k}</key>\\n\\t<string>MaKo [^<]{20,}</string>`), `${k}: sin su porqué en español`);
  }
  assert.match(plist, /<key>ITSAppUsesNonExemptEncryption<\/key>\n\t<false\/>/);
  const ent = leer('nativo/ios/ios/App/App/App.entitlements');
  assert.match(ent, /<string>applinks:hola-mako\.com<\/string>/);
  assert.match(ent, /<string>webcredentials:hola-mako\.com<\/string>/, 'las contraseñas y passkeys guardadas');
  assert.match(ent, /<key>aps-environment<\/key>/);
  assert.match(leer('nativo/ios/ios/App/App/AppDelegate.swift'), /post\(name: \.capacitorDidRegisterForRemoteNotifications, object: deviceToken\)/);
  const m = await sharp('nativo/ios/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png').metadata();
  assert.deepEqual([m.width, m.height, m.hasAlpha], [1024, 1024, false], 'Apple rechaza el ícono con transparencia');
});

test('4. nativo/ no entra al chequeo de tipos ni al lint de la app', () => {
  assert.match(leer('tsconfig.json'), /"exclude": \["node_modules", "nativo"\]/);
  assert.match(leer('eslint.config.mjs'), /"nativo\/\*\*",/);
});

// PROBADO ROMPIÉNDOLO (23/10/2026, base 4/0, de a una; cada una → 3/1):
//   · otro id en capacitor.config.json                 → 1
//   · `enableNotifications: false` en twa-manifest.json → 2
//   · `*.keystore` fuera del .gitignore de Android     → 2
//   · la configuración Release otra vez para iPad      → 3
//   · el permiso del micrófono sin su porqué           → 3
//   · `nativo` fuera del `exclude` de tsconfig.json     → 4
// La cuenta de Apple (3/11/2026, base 7 / 0): otro Team ID en Codemagic, el Apple ID en 0, u otro equipo en una configuración del proyecto -> 6 / 1 cada una.

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

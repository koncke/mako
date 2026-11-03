// =============================================================================
// tiendas-asociar — llena public/.well-known con lo que dan las cuentas de Martín (3/11/2026)
// =============================================================================
// Android abre sin barra de URL sólo si `assetlinks.json` tiene la huella de la firma; iOS abre los links en la app sólo si
// `apple-app-site-association` tiene el Team ID. Las dos cosas salen de las cuentas, así que el día que aparezcan se corre esto:
//
//   node scripts/tiendas-asociar.mjs --huella AA:BB:…            (la de la clave de subida, y otra vez con la de Play App Signing)
//   node scripts/tiendas-asociar.mjs --team ABCDE12345           (Membership, en developer.apple.com/account)
//
// Sólo escribe esos dos archivos, y las huellas se SUMAN: la de subida y la de Play van juntas (sin la de Play, la app de la tienda abre con barra).
// Lo que vende no abre la app (T5): un link de pago sigue en el navegador. Las rutas salen de lib/tienda.ts; tests/tiendas-asociar.test.ts las compara.
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAQUETE = 'com.holamako.app';
/** Lo mismo que RUTAS_DE_VENTA, más la raíz y lo que un negocio le manda a SU gente: se abre en el navegador, no en la app. */
export const SIN_APP = ['/', '/planes', '/planes/*', '/pagar/*', '/r/*', '/mako-partners', '/mako-partners/*', '/reembolsos', '/vsl', '/vsl/*', '/vsl-assets/*', '/l/*', '/compartido/*', '/mi-curso', '/api/*'];

export function assetlinksCon(huellas) {
  return [{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: PAQUETE, sha256_cert_fingerprints: huellas } }];
}

export function aasaCon(team) {
  const app = `${team}.${PAQUETE}`;
  return {
    applinks: { details: [{ appIDs: [app], components: [...SIN_APP.map((r) => ({ '/': r, exclude: true })), { '/': '/*' }] }] },
    webcredentials: { apps: [app] },
  };
}

export const huellaValida = (h) => /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(h);
export const teamValido = (t) => /^[A-Z0-9]{10}$/.test(t);

function argumento(nombre) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const huella = argumento('huella')?.trim().toUpperCase();
  const team = argumento('team')?.trim().toUpperCase();
  if (!huella && !team) { console.error('Falta --huella AA:BB:… o --team ABCDE12345'); process.exit(1); }
  if (huella) {
    if (!huellaValida(huella)) { console.error('Esa huella no es un SHA-256 (32 pares separados por «:»).'); process.exit(1); }
    const ruta = join(RAIZ, 'public', '.well-known', 'assetlinks.json');
    const hoy = JSON.parse(readFileSync(ruta, 'utf8'));
    const ya = hoy[0]?.target?.sha256_cert_fingerprints ?? [];
    const todas = ya.includes(huella) ? ya : [...ya, huella];
    writeFileSync(ruta, `${JSON.stringify(assetlinksCon(todas), null, 2)}\n`);
    console.log(`assetlinks.json: ${todas.length} huella(s).`);
  }
  if (team) {
    if (!teamValido(team)) { console.error('Ese Team ID no son 10 letras y números.'); process.exit(1); }
    writeFileSync(join(RAIZ, 'public', '.well-known', 'apple-app-site-association'), `${JSON.stringify(aasaCon(team))}\n`);
    console.log(`apple-app-site-association: ${team}.${PAQUETE}.`);
  }
}

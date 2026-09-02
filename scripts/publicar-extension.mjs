// =============================================================================
// Subir la extensión a la Chrome Web Store, sin abrir el navegador
// =============================================================================
// Uso:
//   node scripts/publicar-extension.mjs            # sube y manda a revisión
//   node scripts/publicar-extension.mjs --solo-subir   # sube y NO publica
//   node scripts/publicar-extension.mjs --estado       # solo pregunta cómo está
//
// ── Por qué existe ─────────────────────────────────────────────────────────
// Mientras la extensión se sirva como ZIP, **cada arreglo es un trámite manual
// por cliente**: bajar, descomprimir, quitar la vieja, cargar la nueva. Y desde
// que existe el gate de versión, además es un BLOQUEO por cliente hasta que lo
// haga. Ese es el costo real de no estar en la tienda, y se paga entero cada vez
// que se toca un archivo de `extension/`.
//
// La tienda lo cambia por «Chrome la actualiza sola». Lo que lo hacía caro era
// subirla: entrar al panel, arrastrar el zip, llenar el formulario. Con la API es
// un comando.
//
// ── Lo que hace falta UNA vez ──────────────────────────────────────────────
// Tres valores en `.env.local`. Los dos primeros salen de Google Cloud Console y
// el tercero de autorizar una vez desde el navegador:
//
//   CWS_CLIENT_ID=...            (Google Cloud → Credenciales → OAuth 2.0)
//   CWS_CLIENT_SECRET=...
//   CWS_REFRESH_TOKEN=...        (ver `--ayuda`, son dos pasos)
//
// ⚠️ NO SIRVEN LOS DE YOUTUBE que ya están en el `.env.local`. Un refresh token
// está atado a su SCOPE: el de YouTube no puede hablarle a la Chrome Web Store,
// aunque el client_id sea el mismo. Hace falta autorizar el scope
// `https://www.googleapis.com/auth/chromewebstore` explícitamente.

import { readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * ¿`a` es anterior a `b`? Copia de `lib/version-comparar.ts`.
 *
 * ⚠️ Se copia y no se importa porque este script corre con `node` pelado y ese
 * módulo es TypeScript. La copia es de ocho líneas y `tests/extension-version.test.ts`
 * ya cruza las otras dos gemelas; si algún día se agrega una tercera al test, esta
 * es la que falta.
 */
function esMasVieja(a, b) {
  const na = String(a || '').split('.').map((n) => Number(n) || 0);
  const nb = String(b || '').split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    if ((na[i] ?? 0) !== (nb[i] ?? 0)) return (na[i] ?? 0) < (nb[i] ?? 0);
  }
  return false;
}
config({ path: resolve(RAIZ, '.env.local') });

const ZIP = resolve(RAIZ, 'public/mako-puente.zip');
const MANIFEST = resolve(RAIZ, 'extension/manifest.json');
const TIENDA = resolve(RAIZ, 'lib/extension-tienda.ts');

const AYUDA = `
Cómo conseguir el CWS_REFRESH_TOKEN (una sola vez, ~3 minutos)

  1. En https://console.cloud.google.com/apis/credentials, crea unas credenciales
     OAuth 2.0 de tipo «Aplicación de escritorio». Copia el ID y el secreto a
     .env.local como CWS_CLIENT_ID y CWS_CLIENT_SECRET.

     Y habilita la API: https://console.cloud.google.com/apis/library/chromewebstore.googleapis.com

  2. Abre esta URL en el navegador, con TU CLIENT_ID adentro, y acepta:

     https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&client_id=<TU_CLIENT_ID>&redirect_uri=http://localhost&access_type=offline&prompt=consent

     Vas a caer en una página que no carga (http://localhost). No importa: el
     código está en la URL, después de "?code=". Cópialo.

     ⚠️ El "prompt=consent" NO es opcional: sin él Google no devuelve un refresh
     token en las autorizaciones repetidas, y el error que da tres pasos después
     no lo nombra.

  3. Canjéalo por el refresh token (el código vale una sola vez y dura minutos):

     node scripts/publicar-extension.mjs --canjear <EL_CODIGO>

     Guarda lo que imprime en .env.local como CWS_REFRESH_TOKEN.
`;

const args = process.argv.slice(2);
const tiene = (f) => args.includes(f);

if (tiene('--ayuda') || tiene('-h')) { console.log(AYUDA); process.exit(0); }

// ── Lo que se va a subir ───────────────────────────────────────────────────
const version = JSON.parse(readFileSync(MANIFEST, 'utf8')).version;
// El id sale del módulo que ya lo tiene, no de una constante nueva acá: dos
// lugares con el mismo id es cómo uno se queda viejo el día que Google lo cambie.
const idEnTienda = /EXTENSION_ID\s*=\s*'([a-z]{32})'/.exec(readFileSync(TIENDA, 'utf8'))?.[1];
if (!idEnTienda) {
  console.error('No pude leer EXTENSION_ID de lib/extension-tienda.ts');
  process.exit(1);
}

const cid = process.env.CWS_CLIENT_ID;
const secret = process.env.CWS_CLIENT_SECRET;
const refresh = process.env.CWS_REFRESH_TOKEN;

// ── Canjear el código por el refresh token ─────────────────────────────────
if (tiene('--canjear')) {
  const code = args[args.indexOf('--canjear') + 1];
  if (!code) { console.error('Falta el código. Ver --ayuda.'); process.exit(1); }
  if (!cid || !secret) { console.error('Faltan CWS_CLIENT_ID y CWS_CLIENT_SECRET en .env.local. Ver --ayuda.'); process.exit(1); }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cid, client_secret: secret, code,
      grant_type: 'authorization_code', redirect_uri: 'http://localhost',
    }),
  });
  const d = await r.json();
  if (!d.refresh_token) {
    console.error('Google no devolvió refresh_token:', JSON.stringify(d));
    console.error('\nLa causa casi siempre es una de dos: el código ya se usó (valen UNA vez)');
    console.error('o la URL de autorización no llevaba prompt=consent. Ver --ayuda.');
    process.exit(1);
  }
  console.log('\nCWS_REFRESH_TOKEN=' + d.refresh_token + '\n');
  console.log('Pégalo en .env.local y vuelve a correr el script sin --canjear.');
  process.exit(0);
}

if (!cid || !secret || !refresh) {
  console.error('Faltan credenciales de la Chrome Web Store en .env.local:');
  for (const [k, v] of [['CWS_CLIENT_ID', cid], ['CWS_CLIENT_SECRET', secret], ['CWS_REFRESH_TOKEN', refresh]]) {
    console.error(`  ${v ? '✓' : '✗'} ${k}`);
  }
  console.error('\nCorré: node scripts/publicar-extension.mjs --ayuda');
  process.exit(1);
}

/** Un access token fresco. Duran una hora y no se guardan. */
async function token() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cid, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token',
    }),
  });
  const d = await r.json();
  if (!d.access_token) {
    throw new Error('no se pudo renovar el token: ' + JSON.stringify(d).slice(0, 300));
  }
  return d.access_token;
}

// ⚠️ ESTA API SE APAGA EL 15 DE OCTUBRE DE 2026. Verificado en la documentación
// de Google el 02/09/2026: «The Chrome Web Store API (V1) will be supported until
// October 15th, 2026, after which you will need to migrate to the V2 API».
//
// Todo este script habla V1. Sigue funcionando hasta esa fecha, así que publicar
// hoy con esto es correcto — lo que NO conviene es montar el OAuth de V1 creyendo
// que es para siempre.
//
// La V2, para cuando toque migrar (los tres endpoints, verbatim de la doc):
//   subir     POST https://chromewebstore.googleapis.com/upload/v2/publishers/{PUBLISHER_ID}/items/{ITEM_ID}:upload
//   publicar  POST https://chromewebstore.googleapis.com/v2/publishers/{PUBLISHER_ID}/items/{ITEM_ID}:publish
//   estado    GET  https://chromewebstore.googleapis.com/v2/publishers/{PUBLISHER_ID}/items/{ITEM_ID}:fetchStatus
//
// Dos diferencias que cambian el trabajo, no sólo la URL:
//   · pide un PUBLISHER_ID, que no está en este repo — sale del panel de la CWS;
//   · acepta SERVICE ACCOUNTS, o sea que se puede dejar de pasear un refresh
//     token por .env.local. Es el camino recomendado al migrar.
//
// No se escribió acá todavía a propósito: sin el publisher id y sin credenciales
// no se puede ejercitar ni una línea, y un publicador que no se puede probar es
// peor que uno viejo que sí funciona.
const API = 'https://www.googleapis.com/chromewebstore/v1.1/items';
const SUBIDA = 'https://www.googleapis.com/upload/chromewebstore/v1.1/items';

async function estado(t) {
  const r = await fetch(`${API}/${idEnTienda}?projection=DRAFT`, {
    headers: { authorization: `Bearer ${t}`, 'x-goog-api-version': '2' },
  });
  return { http: r.status, cuerpo: await r.json().catch(() => ({})) };
}

// ── Preguntar cómo está ────────────────────────────────────────────────────
if (tiene('--estado')) {
  const { http, cuerpo } = await estado(await token());
  console.log(`item ${idEnTienda} · HTTP ${http}`);
  console.log(JSON.stringify(cuerpo, null, 1));
  process.exit(http === 200 ? 0 : 1);
}

// ── Guardas ANTES de subir ─────────────────────────────────────────────────
// ⚠️ El zip que Vercel sirve y el que se sube a la tienda son el MISMO archivo, y
// tiene que estar al día con `extension/`. El pre-push ya lo exige para pushear;
// acá se exige otra vez porque publicar es lo que llega a la gente.
let zipInfo;
try { zipInfo = statSync(ZIP); } catch {
  console.error('No existe public/mako-puente.zip. Corré: node scripts/zip-extension.mjs');
  process.exit(1);
}
console.log(`Extensión ${version} · ${(zipInfo.size / 1024).toFixed(1)} KB · item ${idEnTienda}`);

const t = await token();

// Qué versión hay hoy en la tienda. Se pregunta ANTES de subir para poder decir
// «no hay nada nuevo» en vez de gastar una revisión de Google en lo mismo.
const antes = await estado(t);
// ⚠️ ESTO NO ES «LA VERSIÓN QUE LA TIENDA PUBLICA»: es la del BORRADOR.
//
// `estado()` pega con `?projection=DRAFT`, así que `crxVersion` se pone al día
// apenas termina el PUT y NO cuando Google aprueba. Sirve para no gastar una
// revisión subiendo dos veces lo mismo, y para nada más. La pregunta «¿qué se
// lleva alguien que instala AHORA?» la contesta `node scripts/version-en-tienda.mjs`,
// que lee la ficha pública y no necesita credenciales.
const versionEnBorrador = antes.cuerpo?.crxVersion || '';
// `uploadState` es el campo que items.get sí devuelve; `status` no existe en esta
// respuesta y se imprimía siempre vacío.
const subidaPrevia = antes.cuerpo?.uploadState || '(sin estado)';
console.log(`En el borrador de la tienda: ${versionEnBorrador || '(no la dice)'} · última subida ${subidaPrevia}`);
if (!versionEnBorrador) {
  // Una lectura que no se pudo hacer NO es un permiso: se dice, y se sigue con
  // la guarda apagada en vez de fingir que pasó.
  console.log('  (no pude leer la versión del borrador; sigo y que decida Google)');
} else if (!esMasVieja(versionEnBorrador, version)) {
  // ⚠️ ORDENADA, no una igualdad. Con `===` se frenaba sólo el caso exacto y
  // dejaba pasar el que de verdad rompe: subir una versión MENOR que la del
  // borrador, que la CWS rechaza — con un error de ella, tres pasos después.
  // Y «0.5.0 vs 0.38.7» es exactamente el par donde comparar como número o como
  // texto da lo contrario que comparar como versión.
  console.error(`\n⛔ El borrador de la tienda ya tiene la ${versionEnBorrador}, que no es anterior a la ${version}.`);
  console.error('   Subí la versión en extension/manifest.json y regenerá el zip:');
  console.error('   node scripts/zip-extension.mjs');
  process.exit(1);
}

// ── Subir ──────────────────────────────────────────────────────────────────
console.log('Subiendo…');
const up = await fetch(`${SUBIDA}/${idEnTienda}`, {
  method: 'PUT',
  headers: { authorization: `Bearer ${t}`, 'x-goog-api-version': '2' },
  body: readFileSync(ZIP),
});
const rUp = await up.json().catch(() => ({}));

// ⚠️ UN 200 NO ES UN ÉXITO. La Chrome Web Store contesta 200 con
// `uploadState: FAILURE` y el motivo adentro de `itemError[]` — es exactamente el
// modo de falla que este repo ya documentó para Meta y para Evolution: «res.ok no
// es "salió bien": los proveedores mandan el fallo ADENTRO del 200».
if (rUp.uploadState !== 'SUCCESS') {
  console.error(`\n⛔ La subida no salió (${rUp.uploadState || up.status}):`);
  for (const e of rUp.itemError || []) console.error(`   · ${e.error_detail || JSON.stringify(e)}`);
  if (!rUp.itemError) console.error('   ' + JSON.stringify(rUp).slice(0, 500));
  process.exit(1);
}
console.log(`✓ Subida: ${version}`);

if (tiene('--solo-subir')) {
  console.log('\nQueda como BORRADOR. Para mandarla a revisión, corré el script sin --solo-subir.');
  process.exit(0);
}

// ── Publicar ───────────────────────────────────────────────────────────────
const pub = await fetch(`${API}/${idEnTienda}/publish`, {
  method: 'POST',
  headers: { authorization: `Bearer ${t}`, 'x-goog-api-version': '2', 'content-length': '0' },
});
const rPub = await pub.json().catch(() => ({}));

if (!(rPub.status || []).includes('OK')) {
  console.error(`\n⛔ No se pudo publicar (HTTP ${pub.status}):`);
  for (const [i, s] of (rPub.status || []).entries()) {
    console.error(`   · ${s}: ${(rPub.statusDetail || [])[i] || ''}`);
  }
  if (!rPub.status) console.error('   ' + JSON.stringify(rPub).slice(0, 500));
  process.exit(1);
}

// ⚠️ Y ACÁ NO SE DICE «PUBLICADA». `status: OK` significa que Google ACEPTÓ el
// pedido y la mandó a REVISIÓN, que puede tardar días y puede rechazarla. Decir
// «publicada» sería afirmar un hecho futuro — y encima uno que decide otro.
console.log(`\n✓ La ${version} entró a REVISIÓN de Google.`);
console.log('  No está publicada todavía: la revisión tarda de horas a días y puede rechazarla.');
console.log(`  Cómo va: node scripts/publicar-extension.mjs --estado`);
console.log('  Qué se sirve hoy: node scripts/version-en-tienda.mjs');
console.log('  Cuando Google apruebe, esa medición actualiza VERSION_EN_TIENDA y el',
  ' camino de instalación pasa solo a la tienda.');
console.log('     lib/extension-tienda.ts. Hasta que no se toque ese flag, MaKo le sigue');
console.log('     ofreciendo el ZIP a todo el mundo y la tienda no sirve de nada.');

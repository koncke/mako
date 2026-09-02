// =============================================================================
// version-en-tienda — qué versión de la extensión tiene PUBLICADA la Chrome Web Store
// =============================================================================
//
//   node scripts/version-en-tienda.mjs
//
// Lee la ficha pública y devuelve lo que Google le muestra a cualquiera. De ahí
// sale `VERSION_EN_TIENDA` en lib/extension-tienda.ts, que es lo que decide si a
// un cliente se le ofrece la tienda o el zip.
//
// ── Por qué NO se usa `publicar-extension.mjs --estado` para esto ───────────
// Ese modo pega a la API con `?projection=DRAFT`, así que su `crxVersion` es la
// del BORRADOR: se pone al día apenas termina la subida, no cuando Google
// aprueba. Creerle habría prendido el camino de la tienda mientras la tienda
// pública seguía sirviendo la versión vieja — que es exactamente el daño que el
// gate viene a evitar. La única fuente que contesta «qué se lleva alguien que
// instala AHORA» es la ficha pública.
//
// ⚠️ Y no necesita credenciales, que es la otra razón: la pregunta se puede
// contestar desde cualquier máquina, incluida una que no tenga acceso al panel.
//
// ── Lo que este script NO puede contestar ───────────────────────────────────
// Si hay una versión EN REVISIÓN. Eso vive en el panel de la CWS y en la API con
// `?projection=DRAFT`. Acá se contesta una sola cosa, y se dice cuál.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Lee una constante `export const X = '...'` de un .ts sin compilarlo. */
function constanteDe(archivo, nombre) {
  const txt = readFileSync(resolve(RAIZ, archivo), 'utf8');
  const m = new RegExp(`export const ${nombre}\\s*=\\s*['"\`]([^'"\`]+)['"\`]`).exec(txt);
  return m ? m[1] : null;
}

const ID = constanteDe('lib/extension-tienda.ts', 'EXTENSION_ID');
const DECLARADA = constanteDe('lib/extension-tienda.ts', 'VERSION_EN_TIENDA');
const DEL_ZIP = constanteDe('lib/extension-version.ts', 'EXTENSION_VERSION');
if (!ID) { console.error('no pude leer EXTENSION_ID de lib/extension-tienda.ts'); process.exit(1); }

const URL_FICHA = `https://chromewebstore.google.com/detail/mako/${ID}`;

let r;
try {
  r = await fetch(URL_FICHA, {
    headers: {
      // Sin un UA de navegador la tienda contesta una página distinta.
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'accept-language': 'es-419,es;q=0.9',
    },
  });
} catch (e) {
  console.error(`no se pudo llegar a la tienda: ${e.message}`);
  process.exit(1);
}

if (!r.ok) {
  // ⚠️ «No pude leer» NO es «no está publicada». Se dice cuál de las dos es, y
  // no se toca nada: un 503 de Google no puede traducirse en apagar la tienda.
  console.error(`la ficha contestó HTTP ${r.status}. No sé qué versión hay publicada; NO cambies la constante por esto.`);
  process.exit(1);
}

const html = await r.text();

/**
 * La versión sale del MANIFEST embebido, no del panel de la ficha.
 *
 * Google mete en el HTML el manifest.json del paquete publicado, y ahí el número
 * viene junto a `"name"` y `"description"`, o sea con contexto que lo identifica
 * como NUESTRO. El panel («Versión 0.5.0») también lo trae y sirve de segunda
 * lectura, pero un `>0.5.0<` suelto podría ser cualquier cosa: el HTML de una
 * ficha trae los manifests de las extensiones RECOMENDADAS al pie, y una regex
 * floja se lleva la versión de Adblock Plus con total naturalidad.
 */
// ⚠️ NO SE MATCHEA EL JSON CON UNA REGEX: el manifest viaja ESCAPADO adentro del
// HTML (\"name\": \"MaKo\"), y una regex que no contemple cada barra devuelve
// null en silencio — que es lo que pasó en la primera versión de este script,
// dejando la lectura identificatoria muda y el veredicto colgando de la otra.
//
// Se ancla en la descripción, que es NUESTRA y no la tiene ninguna otra ficha, y
// se busca la versión más cercana hacia atrás.
// ⚠️ Y se miran TODAS las apariciones, no la primera. La descripción sale dos
// veces en la página: como texto visible de la ficha (que aparece antes y no
// tiene ninguna versión delante) y adentro del manifest embebido. Con
// `indexOf` se agarraba la visible y la lectura daba null siempre.
const HUELLA = 'Genera los anuncios de MaKo';
let delManifest = null;
for (let iHuella = html.indexOf(HUELLA); iHuella > 0 && !delManifest; iHuella = html.indexOf(HUELLA, iHuella + 1)) {
  const ventana = html.slice(Math.max(0, iHuella - 400), iHuella);
  // Las barras van DOBLES: en el HTML el manifest viene escapado, así que hay una
  // barra literal antes de cada comilla. Escrito con una sola, `\?` es «una `?`
  // opcional» y no matchea nada — y falla en silencio.
  const todas = [...ventana.matchAll(/version\\?":\s*\\?"([0-9.]+)/g)];
  if (todas.length) delManifest = [null, todas[todas.length - 1][1]];
}
const delPanel = /class="nBZElf">([0-9]+\.[0-9]+(?:\.[0-9]+)?)</.exec(html);

const publicada = delManifest?.[1] ?? delPanel?.[1] ?? null;
const fecha = /Fecha de actualizaci[oó]n<\/div><div>([^<]+)</.exec(html)?.[1]
  ?? /Updated<\/div><div>([^<]+)</.exec(html)?.[1];

console.log(`ficha:      ${URL_FICHA}`);
console.log(`publicada:  ${publicada ?? '⚠ no pude leerla'}${fecha ? `   (actualizada el ${fecha})` : ''}`);
console.log(`  · del manifest embebido: ${delManifest?.[1] ?? '—'}`);
console.log(`  · del panel de la ficha: ${delPanel?.[1] ?? '—'}`);
console.log(`declarada:  ${DECLARADA ?? '—'}   (VERSION_EN_TIENDA en lib/extension-tienda.ts)`);
console.log(`el zip:     ${DEL_ZIP ?? '—'}   (EXTENSION_VERSION, lo que sirve Vercel)`);

if (!publicada) {
  console.error('\n⚠ El marcado de la ficha cambió: no encontré la versión. No toques la constante a ciegas.');
  process.exit(1);
}

// ⚠️ Dos lecturas que no coinciden es una razón para NO escribir nada. Una de las
// dos está leyendo otra extensión de la misma página.
if (delManifest && delPanel && delManifest[1] !== delPanel[1]) {
  console.error(`\n⚠ Las dos lecturas NO coinciden (${delManifest[1]} vs ${delPanel[1]}). No concluyo nada.`);
  process.exit(1);
}

console.log('');
if (publicada !== DECLARADA) {
  console.log(`⚠ VERSION_EN_TIENDA dice ${DECLARADA} y la tienda publica ${publicada}.`);
  console.log(`  Actualizá lib/extension-tienda.ts:  export const VERSION_EN_TIENDA = '${publicada}';`);
} else {
  console.log('✓ VERSION_EN_TIENDA está al día.');
}

// El veredicto que de verdad importa, dicho en palabras.
const vieja = (a, b) => {
  const na = String(a).split('.').map((n) => Number(n) || 0);
  const nb = String(b).split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    if ((na[i] ?? 0) !== (nb[i] ?? 0)) return (na[i] ?? 0) < (nb[i] ?? 0);
  }
  return false;
};
if (DEL_ZIP && vieja(publicada, DEL_ZIP)) {
  console.log(`\n→ La tienda va ATRÁS del zip (${publicada} < ${DEL_ZIP}): a los clientes se les sigue ofreciendo el zip.`);
  console.log('  Para que se pueda instalar desde Google, hay que publicar y esperar la aprobación.');
} else if (DEL_ZIP) {
  console.log(`\n→ La tienda está al día (${publicada} ≥ ${DEL_ZIP}): el camino de instalación es «Añadir a Chrome».`);
}

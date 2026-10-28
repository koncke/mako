// =============================================================================
// Con la tienda al día, NINGÚN usuario ve la descarga del .zip (27/10/2026)
// =============================================================================
// Martín, 27/10: «cuando esté publicada la extensión, en lugar de descargarlo, los usuarios solo deben instalarla de
// chrome». El .zip queda para desarrollo (la carpeta de Martín) y como camino mientras la tienda va atrás. Hoy cada
// pantalla elige por `EXTENSION_EN_TIENDA` (lib/extension-tienda.ts); lo que esto frena es una pantalla NUEVA que
// enlace el .zip sin preguntarle al flag: con la tienda al día seguiría mandando a «Descargar» y a «Modo de
// desarrollador», que es lo que Martín pidió que nadie vea más.
//
// Vale ANTES y DESPUÉS de que Google apruebe: no mira el valor del flag, mira que el .zip esté detrás de él.
//
// Probado rompiéndolo (27/10/2026), una rotura por vez:
//   · un `<a href={EXTENSION_URL_ZIP}>` en app/crm/TraerDeGrupoWA.tsx:                1 fallo
//   · el instructivo sin la pregunta (`const desdeLaTienda = true;`):                 1 fallo
//   · el perfil con «Descargar» siempre (`fin={boton(extension.zip, …)}`):            1 fallo
//   · `/extension` redirigiendo siempre al zip en next.config.ts:                     1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

/** Los que pueden nombrar el .zip, cada uno con su pregunta al flag fijada abajo. */
const CON_PERMISO = new Set([
  'app/extension/instalar/page.tsx',   // el instructivo: la rama del zip es el `else` de `desdeLaTienda`
  'app/extension/instalar/Pasos.tsx',  // recibe el destino por prop; no elige
  'app/perfil/instalar/page.tsx',      // le pasa los dos destinos y `enTienda` a InstalarApp
  'app/mako-puente.zip/route.ts',      // la dirección fija para desarrollo: redirige al zip versionado
]);

test('ninguna pantalla de usuario enlaza el .zip sin pasar por EXTENSION_EN_TIENDA', () => {
  const archivos = execFileSync('git', ['ls-files', '-z', '--', 'app', 'lib'], { cwd: raiz, encoding: 'utf8' })
    .split('\0').filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.startsWith('app/admin/dev/') && !CON_PERMISO.has(f) && f !== 'lib/extension-tienda.ts');
  const conZip = archivos.filter((f) => {
    let texto: string;
    try { texto = leer(f); } catch { return false; }   // borrado en el árbol y todavía en el índice
    const sinComentarios = texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    return /EXTENSION_URL_ZIP|['"`]\/mako-puente(?:-[^'"`]*)?\.zip/.test(sinComentarios);
  });
  assert.deepEqual(conZip, [], `estas pantallas enlazan el .zip: con la tienda al día tienen que ir a «Agregar a Chrome» (EXTENSION_URL_TIENDA) o al instructivo /extension/instalar, que ya pregunta`);
});

test('el instructivo: el zip es la rama de «la tienda va atrás»', () => {
  const p = leer('app/extension/instalar/page.tsx');
  assert.match(p, /const desdeLaTienda = EXTENSION_EN_TIENDA;/, 'el instructivo dejó de preguntarle al flag');
  const si = p.indexOf('{desdeLaTienda ? (');
  assert.ok(si > 0, 'el instructivo ya no elige entre la tienda y el zip');
  const sino = p.indexOf(') : (', si);
  const zips = [...p.matchAll(/zip=\{EXTENSION_URL_ZIP\}/g)].map((m) => m.index ?? -1);
  assert.ok(zips.length > 0 && sino > si);
  assert.ok(zips.every((i) => i > sino), 'un paso con el zip quedó en la rama de la tienda');
  assert.match(p.slice(si, sino), /zip=\{EXTENSION_URL_TIENDA\}/, 'la rama de la tienda no lleva a la tienda');
});

test('el perfil: «Agregar a Chrome» con la tienda, «Descargar» sólo sin ella', () => {
  const app = leer('app/perfil/instalar/InstalarApp.tsx');
  assert.match(app, /fin=\{extension\.enTienda \? boton\(extension\.tienda, 'Agregar a Chrome'[^)]*\) : boton\(extension\.zip, 'Descargar'/);
  assert.match(leer('app/perfil/instalar/page.tsx'), /enTienda: EXTENSION_EN_TIENDA/);
});

test('/extension va a la tienda cuando está al día', () => {
  assert.match(leer('next.config.ts'), /source: '\/extension',\s*\n\s*destination: EXTENSION_EN_TIENDA \? EXTENSION_URL_TIENDA : EXTENSION_URL_ZIP,/);
});

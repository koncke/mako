// =============================================================================
// NINGÚN usuario ve una descarga de la extensión: todo lleva a «Agregar a Chrome» (3/11/2026)
// =============================================================================
// Martín, 3/11: «Aún la extensión de mako me pide "Descargar"...», y antes: «dijimos que ya no se descarga nada, solo por el
// instalador de extensiones de chrome». Lo medido: la tienda publicaba la 0.74.3, el repo la 0.74.4, y el flag derivado
// `EXTENSION_EN_TIENDA` daba false: cada versión nueva, por chica que fuera, le devolvía el zip a todos.
//
// El flag ya no existe, y qué se ofrece no depende de ninguna versión. El .zip queda para desarrollo (`/mako-puente.zip`).
// La protección de versión vieja sigue, separada: una función que pide más lo dice en una línea (`lineaDeVersion`) y el aviso
// de «quedó vieja» compara contra lo que la persona puede tener (`copiaQuedoVieja`), no contra el repo.
//
// Vale con la tienda atrás, al día o adelante: acá nada mira cuál de las tres es.
//
// Probado rompiéndolo (3/11/2026), una rotura por vez, sobre 11 de 11 verdes. Las 17 cazadas, restaurado 11 de 11:
//   · el flag de vuelta en lib/extension-tienda.ts:                     1 fallo
//   · el CRM abriendo /mako-puente.zip:                                 1 fallo
//   · el perfil con «Descargar»:                                        1 fallo
//   · el perfil con la versión del repo:                                1 fallo
//   · /extension al zip en next.config.ts:                              1 fallo
//   · un paso de descomprimir en el instructivo:                        2 fallos
//   · el botón del instructivo al zip:                                  2 fallos
//   · el aviso del puente con «Descargar»:                              1 fallo
//   · el botón del onboarding de vuelta al instructivo:                 1 fallo
//   · «vieja» contra el repo:                                           1 fallo
//   · «vieja» sin descontar la de la tienda:                            1 fallo
//   · el hook con su propia comparación:                                1 fallo
//   · `lineaDeVersion` siempre manda a actualizar:                      1 fallo
//   · el avatar sin la línea:                                           1 fallo
//   · el puente con la versión de verdad:                               1 fallo
//   · el puente vacío:                                                  1 fallo
//   · el route sin la constante:                                        1 fallo
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import nextConfig from '../next.config';
import * as tienda from '../lib/extension-tienda';
import { esMasVieja } from '../lib/version-comparar';
import { MOTOR_INTERFAZ_DESDE } from '../lib/flow-interfaz';
import { RUTA_INSTALAR, requisitosAvatar } from '../lib/ai-avatar/requisitos';
import InstalarExtension from '../app/extension/instalar/page';
import { InstalarApp } from '../app/perfil/instalar/InstalarApp';

const { EXTENSION_URL_TIENDA, VERSION_EN_TIENDA, VERSION_ESPERADA_DEL_PUENTE, LLEGA_CON_LA_PROXIMA, copiaQuedoVieja, lineaDeVersion } = tienda;

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

/**
 * Sin comentarios. Los de bloque, sólo los que arrancan la línea o los de JSX: el `accept="image/*"` de varias pantallas abre un
 * «bloque» para un regex suelto y se come el código hasta el próximo cierre, y ahí el barrido dejaría de ver lo que busca.
 */
const sinComentarios = (s: string) => s
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '')
  .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

/** El código de la app (menos el panel de desarrollo, que no lo ve un usuario), sin comentarios. Se lee una vez: son miles. */
let leido: { archivo: string; texto: string }[] | null = null;
function codigoDeLaApp(): { archivo: string; texto: string }[] {
  leido ??= execFileSync('git', ['ls-files', '-z', '--', 'app', 'lib'], { cwd: raiz, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
    .split('\0')
    .filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.startsWith('app/admin/dev/'))
    .flatMap((archivo) => {
      try { return [{ archivo, texto: sinComentarios(leer(archivo)) }]; } catch { return []; }   // borrado en el árbol y todavía en el índice
    });
  return leido;
}

test('el flag no existe: qué se ofrece ya no depende de la versión', () => {
  assert.equal('EXTENSION_EN_TIENDA' in tienda, false, 'volvió el flag: con la tienda atrás le devuelve el zip a todos');
  const conFlag = codigoDeLaApp().filter(({ texto }) => /EXTENSION_EN_TIENDA|enTienda\b/.test(texto)).map((x) => x.archivo);
  assert.deepEqual(conFlag, [], 'estas pantallas todavía preguntan si la tienda está al día');
  assert.doesNotMatch(sinComentarios(leer('next.config.ts')), /EXTENSION_EN_TIENDA/);
});

test('ninguna pantalla de usuario enlaza el .zip', () => {
  // Los dos que lo pueden nombrar: quien lo define y la dirección fija para desarrollo.
  const permitidos = new Set(['lib/extension-tienda.ts', 'app/mako-puente.zip/route.ts']);
  const conZip = codigoDeLaApp()
    .filter(({ archivo, texto }) => !permitidos.has(archivo) && /EXTENSION_URL_ZIP|['"`]\/mako-puente(?:-[^'"`]*)?\.zip/.test(texto))
    .map((x) => x.archivo);
  assert.deepEqual(conZip, [], 'estas pantallas enlazan el .zip: tienen que ir a «Agregar a Chrome» (EXTENSION_URL_TIENDA) o a /extension/instalar');
});

test('ningún texto le pide a un usuario descargar o descomprimir la extensión', () => {
  const prohibido = /Descargar la extensi|Descomprime|Cargar descomprimida|cargarla descomprimida|Modo de desarrollador/i;
  const con = codigoDeLaApp().filter(({ texto }) => prohibido.test(texto)).map((x) => x.archivo);
  assert.deepEqual(con, []);
});

test('una pantalla no promete la versión del repo: es la que la tienda todavía puede no tener', () => {
  const con = codigoDeLaApp().filter(({ archivo, texto }) => archivo.startsWith('app/') && /EXTENSION_VERSION/.test(texto)).map((x) => x.archivo);
  assert.deepEqual(con, []);
  assert.match(leer('app/perfil/instalar/page.tsx'), /version: VERSION_EN_TIENDA/, 'el perfil dice una versión que el botón no da');
});

test('/extension, evaluada: va a la tienda', async () => {
  const redirecciones = await nextConfig.redirects!();
  const r = redirecciones.find((x) => x.source === '/extension');
  assert.equal(r?.destination, EXTENSION_URL_TIENDA);
});

test('el instructivo, dibujado: sólo la tienda', () => {
  const html = renderToStaticMarkup(createElement(InstalarExtension));
  assert.match(html, /Agregar a Chrome/);
  assert.ok(html.includes(`href="${EXTENSION_URL_TIENDA}"`), 'el botón no lleva a la ficha');
  assert.doesNotMatch(html, /descarg|\.zip|descomprim|desarrollador|mako-puente/i);
  assert.doesNotMatch(leer('app/extension/instalar/Pasos.tsx'), /name="descargar"/, 'el botón con el ícono de descargar');
});

test('el perfil, dibujado: la extensión es «Agregar a Chrome»', () => {
  const html = renderToStaticMarkup(createElement(InstalarApp, { qr: null, url: 'https://hola-mako.com', extension: { version: VERSION_EN_TIENDA, tienda: EXTENSION_URL_TIENDA } }));
  const navegador = html.slice(html.indexOf('En tu navegador'));
  assert.ok(navegador.includes(`href="${EXTENSION_URL_TIENDA}"`));
  assert.match(navegador, /Agregar a Chrome/);
  assert.doesNotMatch(navegador, /descarg|\.zip/i);
});

test('los avisos del Video Generator agregan desde la tienda, sin pasar por una descarga', () => {
  for (const r of ['app/video-generator/puente-avisos.tsx', 'app/video-generator/OnboardingVideoGen.tsx']) {
    const p = sinComentarios(leer(r));
    assert.match(p, /onClick=\{\(\) => window\.open\(EXTENSION_URL_TIENDA, '_blank', 'noopener'\)\}[\s\S]{0,120}Agregar a Chrome/, `${r}: el botón no abre la tienda`);
    assert.doesNotMatch(p, /name="descargar"/, `${r}: «Agregar a Chrome» con el ícono de descargar sigue diciendo «descargar»`);
    assert.doesNotMatch(p, /\/extension\/instalar/, `${r}: un botón que dice «Agregar a Chrome» no lleva a otra pantalla con otro botón`);
  }
});

test('«quedó vieja» es sólo la copia que va atrás de lo que da la TIENDA, nunca del repo', () => {
  const antes = '0.1.0';
  const despues = `${VERSION_EN_TIENDA}.1`;   // la que el repo va a tener mientras Google revisa
  assert.equal(copiaQuedoVieja(antes, false), true, 'una copia atrasada tiene que enterarse');
  assert.equal(copiaQuedoVieja(antes, null), true, 'ausente no es «no es de la tienda»: no se le silencia el aviso');
  assert.equal(copiaQuedoVieja(antes, true), false, 'la de la tienda la actualiza Chrome');
  assert.equal(copiaQuedoVieja(VERSION_EN_TIENDA, false), false, 'tiene lo mismo que da la tienda: no hay nada que hacer');
  assert.equal(copiaQuedoVieja(despues, false), false);
  // La pregunta vive en un solo lugar, y los dos avisos cuentan lo de la tienda.
  const hook = leer('app/video-generator/extension-instalada.tsx');
  assert.match(hook, /return copiaQuedoVieja\(instalada, deLaTienda\);/);
  for (const r of ['app/video-generator/extension-instalada.tsx', 'app/_components/AvisoExtensionVieja.tsx']) {
    const p = sinComentarios(leer(r));
    assert.match(p, /VERSION_EN_TIENDA/, `${r}: no dice lo que la tienda da`);
    assert.match(p, /Chrome\s+Web Store/, `${r}: no dice de dónde sacarla`);
  }
});

test('una función que pide más versión lo dice en una línea, y sólo manda a actualizar si la tienda ya la tiene', () => {
  const frase = 'Actualiza la extensión de MaKo';
  assert.equal(lineaDeVersion(VERSION_EN_TIENDA, frase), frase);
  assert.equal(lineaDeVersion('0.1.0', frase), frase);
  assert.equal(lineaDeVersion(`${VERSION_EN_TIENDA}.1`, frase), LLEGA_CON_LA_PROXIMA, 'la tienda no la tiene: actualizar no la traería');
  assert.doesNotMatch(LLEGA_CON_LA_PROXIMA, /\n/);

  // Las que hoy piden una versión pasan por acá.
  const pasos = requisitosAvatar({ puente: { estado: 'listo', vivo: true, actualizada: false }, instalada: '0.60.0', enTelefono: false, fotos: 1, para: 'avatar' }).pasos;
  const actualizar = pasos.find((p) => p.id === 'actualizar');
  assert.equal(actualizar?.ayuda, lineaDeVersion(MOTOR_INTERFAZ_DESDE, 'La que tienes no sabe poner tu cara en el avatar.'));
  assert.equal(actualizar?.enlace?.href, RUTA_INSTALAR);
  assert.match(leer('lib/ai-avatar/requisitos.ts'), /ayuda: lineaDeVersion\(MOTOR_INTERFAZ_DESDE,/);
  assert.match(leer('app/crm/TraerDeGrupoWA.tsx'), /\? lineaDeVersion\(VERSION_FICHAS,/);
  assert.match(leer('app/crm/AccionesLoteLeads.tsx'), /extWa === 'vieja' \? lineaDeVersion\(VERSION_FICHAS,/);
});

test('el puente no traba el desplegable de una copia vieja: su texto pide «cargarla descomprimida» y no se puede cambiar', () => {
  assert.ok(VERSION_ESPERADA_DEL_PUENTE, 'vacío no pisa lo que la extensión ya guardó (`anotarVersionEsperada`)');
  for (const corriendo of ['0.1.0', VERSION_EN_TIENDA, '0.74.5']) {
    assert.equal(esMasVieja(corriendo, VERSION_ESPERADA_DEL_PUENTE), false, `la ${corriendo} quedaría trabada en «Actualiza la extensión»`);
  }
  assert.match(leer('app/api/flow/puente/route.ts'), /versionEsperada: VERSION_ESPERADA_DEL_PUENTE,/);
});

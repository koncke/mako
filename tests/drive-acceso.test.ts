// =============================================================================
// Un video de Drive en una clase: lo tiene que poder ver un ALUMNO, no sólo su dueño (MAU-19, 27/10/2026)
// =============================================================================
// Mauricio conecta los videos de su curso pegando el link de Drive en cada clase. En el editor los ve porque está
// logueado en su Google; el alumno, sin esa cuenta, veía «Necesitas acceso». Lo que fija:
//   1. cómo se lee lo que contesta Drive sin sesión: 200 con su título = público, 404 = no existe, el 3xx a iniciar
//      sesión o un 401/403 = privado, y cualquier otra cosa = «no sé» (que NO frena);
//   2. la pregunta: sin seguir redirecciones, a /view, y nunca tira;
//   3. los TRES guardados de una clase (la pantalla y la API de MaKo) la hacen, sólo con un video NUEVO.
//
// Probado rompiéndolo (con todo puesto: 0 fallos). Cada rotura, sola:
//   · un 200 sin el título de Drive cuenta como público                                        → 1 fallo (1)
//   · cualquier 3xx cuenta como privado (sin mirar que vaya a accounts.google.com)            → 1 fallo (1)
//   · «no sé» frena el guardado (`errorDeAccesoDrive(null)` con texto)                         → 1 fallo (1)
//   · la pregunta sigue las redirecciones (sin `redirect: 'manual'`)                           → 1 fallo (2)
//   · un corte de red tira en vez de dar `null`                                                → 1 fallo (2)
//   · `guardarLeccion` sin el freno                                                            → 1 fallo (3)
//   · `guardarCampoClase` sin el freno                                                         → 1 fallo (3)
//   · `guardarClase` sin el freno                                                              → 1 fallo (3)
//   · el freno pregunta en cada guardado, aunque el video sea el mismo                         → 1 fallo (3)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TEXTO_DRIVE_NO_EXISTE, TEXTO_DRIVE_PRIVADO, accesoDeDrive, accesoPorRespuesta, errorDeAccesoDrive,
} from '../lib/drive-acceso';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8'));

test('lo que contesta Drive sin sesión: público, privado, no existe, o «no sé» (que no frena)', () => {
  const r = (status: number, location: string | null = null, titulo: string | null = null) => accesoPorRespuesta({ status, location, titulo });
  // Medido el 27/10/2026: un archivo público da 200 con «<nombre> - Google Drive»; un id que no existe, 404.
  assert.equal(r(200, null, '3. Musica - Google Drive'), 'publico');
  assert.equal(r(404), 'no-existe');
  assert.equal(r(302, 'https://accounts.google.com/ServiceLogin?continue=https://drive.google.com/file/d/x/view'), 'privado');
  assert.equal(r(401), 'privado');
  assert.equal(r(403), 'privado');
  assert.equal(r(200, null, null), null, 'un 200 sin el título de Drive no prueba que sea público');
  assert.equal(r(200, null, 'Iniciar sesión: Cuentas de Google'), null);
  assert.equal(r(302, 'https://drive.google.com/file/d/x/view?usp=sharing'), null, 'un 3xx dentro de Drive no es «privado»');
  assert.equal(r(500), null);
  assert.equal(errorDeAccesoDrive('privado'), TEXTO_DRIVE_PRIVADO);
  assert.equal(errorDeAccesoDrive('no-existe'), TEXTO_DRIVE_NO_EXISTE);
  assert.equal(errorDeAccesoDrive('publico'), null);
  assert.equal(errorDeAccesoDrive(null), null, '«no pude preguntar» no es «el video está roto»');
  assert.match(TEXTO_DRIVE_PRIVADO, /Cualquier persona con el enlace/, 'el error dice cómo arreglarlo');
});

test('la pregunta: sin sesión, sin seguir redirecciones, a /view, y nunca tira', async () => {
  const pedidos: Array<{ url: string; init: RequestInit | undefined }> = [];
  const falso = (respuesta: Response | Error) => (async (url: string | URL | Request, init?: RequestInit) => {
    pedidos.push({ url: String(url), init });
    if (respuesta instanceof Error) throw respuesta;
    return respuesta;
  }) as typeof fetch;
  const id = '1HjoB20foZFLPXPsyXYGYDbr2DblAnZ4u';
  assert.equal(await accesoDeDrive(id, falso(new Response('<html><title>Clase 1 - Google Drive</title></html>', { status: 200 }))), 'publico');
  assert.equal(pedidos[0].url, `https://drive.google.com/file/d/${id}/view`);
  assert.equal(pedidos[0].init?.redirect, 'manual', 'el 3xx a iniciar sesión ES la respuesta: no se sigue');
  assert.equal(new Headers(pedidos[0].init?.headers).get('cookie'), null, 'como un alumno: sin sesión');
  assert.equal(await accesoDeDrive(id, falso(new Response(null, { status: 302, headers: { location: 'https://accounts.google.com/ServiceLogin' } }))), 'privado');
  assert.equal(await accesoDeDrive(id, falso(new Error('ECONNRESET'))), null, 'un corte es «no sé», no un error');
  const antes = pedidos.length;
  assert.equal(await accesoDeDrive('../../etc', falso(new Response('', { status: 200 }))), 'no-existe');
  assert.equal(pedidos.length, antes, 'un id que no es de Drive no sale a la red');
});

test('los tres guardados de una clase preguntan por un video NUEVO de Drive (la pantalla y la API pasan por ahí)', () => {
  const admin = leer('lib/curso-admin.ts');
  const cuerpo = (nombre: string) => {
    const i = admin.indexOf(`export async function ${nombre}(`);
    assert.ok(i >= 0, `no encontré ${nombre}`);
    const fin = admin.indexOf('\nexport ', i + 10);
    return admin.slice(i, fin < 0 ? undefined : fin);
  };
  const freno = /const freno = await frenoDeDrive\(v\.(video|fila)\);\s*if \(freno\) return \{ ok: false, error: freno \};/;
  assert.match(cuerpo('guardarLeccion'), new RegExp(String.raw`if \(v\.video\.video_url !== c\.videoUrl\) \{\s*` + freno.source));
  assert.match(cuerpo('guardarCampoClase'), new RegExp(String.raw`if \(v\.video\.video_url !== c\.videoUrl\) \{\s*` + freno.source));
  assert.match(cuerpo('guardarClase'), new RegExp(String.raw`if \(v\.fila\.video_url !== \(previa\?\.videoUrl \?\? null\)\) \{\s*` + freno.source));
  const f = admin.slice(admin.indexOf('async function frenoDeDrive('), admin.indexOf('async function frenoDeDrive(') + 600);
  assert.match(f, /if \(video\.video_tipo !== 'drive' \|\| !video\.video_url\) return null;/, 'sólo los videos de Drive');
  assert.match(f, /return errorDeAccesoDrive\(a\);/);
  // La API de MaKo edita una clase por `guardarLeccion`: el mismo freno, sin copiarlo.
  assert.match(leer('lib/api-mako/areas/curso.run.ts'), /await guardarLeccion\(claseId, cambios, antes\)/);
});

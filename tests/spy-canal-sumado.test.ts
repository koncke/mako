// Un canal que se le suma solo a un competidor queda sumado Y trayendo sus piezas (4/11/2026).
//
// Martín, con Leila Hormozi en producción: «Encontré a Leila en YouTube… le apreté al link que me abrió su YouTube, era correcto,
// pero luego no se cargaron sus videos de YouTube... Es como si hubiese apretado en deshacer». La causa medida en el código: al
// sumarse el canal, la ficha releía TODO (`leer(id, false)`, sin motivo: Instagram otra vez por Apify, sin la lectura compartida)
// en una acción con 60 s de techo, que se cortaba antes de llegar a YouTube. El canal quedaba en la ficha y sin un video.
//   1. qué se lee después de sumar: sólo lo nuevo (TikTok no se lee), y la lectura respeta `solo`;
//   2. la pantalla lee sólo lo nuevo, con la lectura compartida (`'alta'`), y una vez más si se cortó;
//   3. la pastilla: el logo de su red, su nombre como link, «Trayendo sus videos…» mientras llegan, y sin «Deshacer» a mitad;
//   4. decir «Es» a un canal dudoso lo deja sumado y trayendo, y no relee todo;
//   5. la ficha que ya quedó así (su YouTube sin un video) lo trae sola al abrirse, sólo ese canal.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · `leeCanal` que ignora `solo`                                         → 1
//   · `buscarRedes` con el `leer(id, false)` de antes                       → 2
//   · la pastilla sin el logo de su red                                     → 3
//   · «Deshacer» a la vista mientras trae                                   → 3
//   · `confirmarRed` con `abrirRecienAgregado` (relee todo)                 → 4
//   · `youtubeSinLeer` que no mira si ya tiene videos                       → 5
//
// Correr: node --import tsx --test tests/spy-canal-sumado.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { canalesALeer, leeCanal } from '../lib/spy-lectura-pasos';
import { OtrasRedes } from '../app/competitor-spy/OtrasRedes';
import { youtubeSinLeer } from '../lib/spy-vista';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  const f = src.indexOf(hasta, i + desde.length);
  assert.ok(f > i, `no está el cierre de «${desde}»`);
  return src.slice(i, f);
};

const YT = { red: 'youtube' as const, ref: '@LeilaHormozi', url: 'https://www.youtube.com/@LeilaHormozi', titulo: 'Leila Hormozi', foto: null, porque: 'Mismo nombre' };

test('1. después de sumar se lee sólo lo nuevo, y la lectura respeta `solo`', () => {
  assert.deepEqual(canalesALeer([YT]), ['youtube']);
  assert.deepEqual(canalesALeer([{ red: 'tiktok' }]), [], 'TikTok no se lee: no hay nada que traer');
  assert.deepEqual(canalesALeer([{ red: 'instagram' }, { red: 'instagram' }], 'https://leila.com'), ['instagram', 'web']);
  assert.deepEqual(canalesALeer([], null), []);
  assert.equal(leeCanal(undefined, 'instagram'), true, 'sin `solo`, todos');
  assert.equal(leeCanal(['youtube'], 'instagram'), false, 'con `solo`, Instagram no se vuelve a leer');
  assert.equal(leeCanal(['youtube'], 'youtube'), true);
  const spy = sinComentarios(leer('lib/spy.ts'));
  const f = bloque(spy, 'export async function mirarCompetidor', '\nexport async function');
  assert.match(f, /const lee = \(p: PasoLectura\) => leeCanal\(solo, p\);/);
  assert.match(f, /\.\.\.\(!solo \|\| !c\.mirado_en \? \{ mirado_en: ahora/, 'leer un canal no marca fresco al resto');
  const acc = sinComentarios(leer('app/competitor-spy/actions.ts'));
  assert.match(acc, /solo\.filter\(\(p\): p is PasoLectura => p === 'instagram' \|\| p === 'youtube' \|\| p === 'web'\)/, 'lo del navegador se filtra');
});

test('2. la pantalla lee sólo lo nuevo, con la lectura compartida, y una vez más si se cortó', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const buscar = bloque(app, 'const buscarRedes = useCallback(', '\n  }, []);');
  assert.match(buscar, /const nuevos = r\.ok \? canalesALeer\(r\.sumadas, r\.web\) : \[\];/);
  assert.match(buscar, /if \(nuevos\.length\) await traerLoNuevo\(id, nuevos\);/);
  assert.doesNotMatch(buscar, /leer\(id, false\)/, 'releer todo es lo que se cortaba a los 60 s');
  const traer = bloque(app, 'const traerLoNuevo = useCallback(', '}, [leer, recargarLista]);');
  assert.match(traer, /const una = await leer\(id, false, 'alta', nuevos\)/);
  assert.match(traer, /if \(!una\?\.ok && actual\.current === id\) await leer\(id, false, 'alta', nuevos\)/, 'una vez más si se cortó');
  assert.match(traer, /setTrayendoRedes\(\(v\) => \(\{ \.\.\.v, \[id\]: nuevos \}\)\)/);
  assert.match(traer, /finally \{\s*setTrayendoRedes/, 'el «Trayendo…» se va también si falló');
});

test('3. la pastilla: su logo, su nombre como link, «Trayendo…» mientras llegan y sin «Deshacer» a mitad', () => {
  const props = { ocupado: false, onSi: () => {}, onNo: () => {}, onDeshacer: () => {} };
  const trayendo = renderToStaticMarkup(createElement(OtrasRedes, { ...props, b: { buscando: false, sumadas: [YT], candidatos: [] }, trayendo: ['youtube'] }));
  assert.match(trayendo, /data-red="youtube"/);
  assert.match(trayendo, /class="spy-redes-logo"><span[^>]*><svg[^>]*><use href="#ic-youtube"/, 'el logo de YouTube, no un punto de color');
  assert.doesNotMatch(trayendo, /spy-redes-punto/, 'sin foto no hay un punto suelto: el logo ya dice qué es');
  assert.match(trayendo, /<b>Su YouTube<\/b>/);
  assert.match(trayendo, /<a href="https:\/\/www\.youtube\.com\/@LeilaHormozi" target="_blank" rel="noreferrer noopener"[^>]*><span>Leila Hormozi<\/span>/);
  assert.match(trayendo, /role="status"[^>]*><i aria-hidden="true"><\/i>Trayendo sus videos…/);
  assert.doesNotMatch(trayendo, />Deshacer</, 'deshacer a mitad dejaría piezas de un canal que ya no es suyo');
  const listo = renderToStaticMarkup(createElement(OtrasRedes, { ...props, b: { buscando: false, sumadas: [YT], candidatos: [] }, trayendo: null }));
  assert.match(listo, />Deshacer</);
  assert.doesNotMatch(listo, /Trayendo/);
  const pregunta = renderToStaticMarkup(createElement(OtrasRedes, { ...props, b: { buscando: false, sumadas: [], candidatos: [YT] }, trayendo: null }));
  assert.match(pregunta, /<b>¿Es su YouTube\?<\/b>/);
  assert.match(pregunta, />Es<\/button>/);
  assert.match(pregunta, />No es<\/button>/);
  assert.equal(renderToStaticMarkup(createElement(OtrasRedes, { ...props, b: { buscando: true, sumadas: [YT], candidatos: [] }, trayendo: null })), '', 'mientras busca, nada');
});

test('4. decir «Es» lo deja sumado y trayendo, y no relee todo', () => {
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  const confirmar = bloque(app, 'const confirmarRed = async', '\n  };');
  assert.match(confirmar, /sumadas: \[\.\.\.v\[id\]\.sumadas, k\]/, 'la pastilla no desaparece justo cuando dijo que sí');
  assert.match(confirmar, /const nuevos = canalesALeer\(\[k\]\);\s*if \(nuevos\.length\) void traerLoNuevo\(id, nuevos\);/);
  assert.doesNotMatch(confirmar, /abrirRecienAgregado/, 'releer todo, con la película, era otra vez la lectura entera');
});

test('5. la ficha que quedó con su YouTube y sin un video lo trae sola al abrirse, sólo ese canal', () => {
  assert.equal(youtubeSinLeer({ youtube_id: '@LeilaHormozi' }, [{ canal: 'instagram' }], false), true);
  assert.equal(youtubeSinLeer({ youtube_id: '@LeilaHormozi' }, [{ canal: 'youtube' }], false), false, 'con videos, nada');
  assert.equal(youtubeSinLeer({ youtube_id: null }, [], false), false);
  assert.equal(youtubeSinLeer({ youtube_id: '@LeilaHormozi' }, [], true), false, 'una vez por sesión');
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /if \(quien && youtubeSinLeer\(quien, p \?\? \[\], yaLeidos\.current\.has\(id\)\)\) await traerLoNuevo\(id, \['youtube'\]\);/);
});

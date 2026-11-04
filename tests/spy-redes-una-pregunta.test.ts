// Una pregunta a la vez, y un canal es una pastilla (4/11/2026).
//
// Martín, con Federico Cristofari (`competidor=20`): «2 veces saltó el cartel de YouTube. Eso no debe pasar». Salían dos pastillas
// iguales, «¿Es su YouTube? · Federico Cristofari · Mismo nombre», y la segunda bajaba de renglón y empujaba el «?» y las
// pestañas. El mismo canal llegaba por dos caminos con dos refs: su `@handle` probado a ciegas y su `UC…` del video de Google.
//   1. la cadena reconoce el canal por el id que devuelve la API, no por la ref con la que se pidió: un candidato, no dos;
//   2. sin repetidos y una sola pregunta: la de más evidencia primero, «Ver otro» da la vuelta, y su YouTube antes que lo demás;
//   3. la ruta y la pantalla también sacan los repetidos, y no se pregunta por una red que ya se sumó;
//   4. dibujado: una sola pastilla de pregunta, con lo que la distingue (suscriptores) y «Ver otro» si hay más;
//   5. la fila de la miga no se parte en la computadora: el detalle cede primero y el nombre se lee siempre.
//
// Verificado rompiéndolo (cada línea, el test que cae):
//   · la cadena sin `canalesVistos` (dedup por ref)                         → 1
//   · `claveDeCanal` que mira la ref y no el id                             → 1, 2
//   · `preguntaDeAhora` sin el orden de red                                 → 2
//   · la ruta sin `sinCanalesRepetidos`                                     → 3
//   · OtrasRedes con todas las preguntas a la vez                           → 4
//   · `.spy-volver` que vuelve a partirse (flex-wrap) en la computadora     → 5
//
// Correr: node --import tsx --test tests/spy-redes-una-pregunta.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cadenaDeRedes, type DepsCadena, type LeidoRed } from '../lib/spy-cadena';
import { claveDeCanal, preguntaDeAhora, sinCanalesRepetidos } from '../lib/spy-otras-redes-reglas';
import { OtrasRedes } from '../app/competitor-spy/OtrasRedes';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const ID = 'UCfede000000000000000001';
// Su Instagram no es su @ de YouTube: el canal no entra por «su mismo usuario» sino por Google, que es donde se duplicaba.
const FEDE = { nombre: 'Federico Cristofari', instagram: 'fede.cristo', youtube_id: null, tiktok: null, landing_url: null, avatar: null };

function dobles(o: Partial<DepsCadena> = {}): DepsCadena {
  return {
    textoPropio: async () => 'Mentor de negocios',
    abrirPagina: async () => null,
    // El mismo canal se llama «Federico Cristofari» con cualquiera de sus dos refs, y la API devuelve su id.
    leerCanales: async (refs) => {
      const m = new Map<string, LeidoRed>();
      for (const r of refs) if (r === '@federicocristofari' || r === ID) m.set(r, { nombre: 'Federico Cristofari', texto: '', foto: null, id: ID, seguidores: 12400 });
      return m;
    },
    leerPerfiles: async () => new Map(),
    // Dos búsquedas de Google: la primera trae su canal por su @, la segunda un video suyo (el candidato llega por su `UC…`). Es
    // el camino real de las dos pastillas iguales: con el canal sólo «quizás», la cadena sigue buscando.
    googlear: (() => {
      let n = 0;
      return async () => (n++ === 0
        ? [{ organicResults: [{ url: 'https://www.youtube.com/@federicocristofari', title: 'Federico Cristofari - YouTube' }] }]
        : [{ organicResults: [{ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Federico Cristofari' }] }]);
    })(),
    gastarBusqueda: () => true,
    canalesDeVideos: async () => [{ id: ID, nombre: 'Federico Cristofari' }],
    hashDeFoto: async () => null,
    ...o,
  };
}

test('1. la cadena reconoce el canal por el id que devuelve la API: un candidato, no dos', async () => {
  const r = await cadenaDeRedes(FEDE, dobles());
  assert.ok(r.ok);
  const yt = [...r.seguros, ...r.candidatos].filter((k) => k.red === 'youtube');
  assert.equal(yt.length, 1, `el mismo canal por su @ y por su UC…: ${yt.map((k) => k.ref).join(', ')}`);
  assert.equal(yt[0].ref, '@federicocristofari', 'queda el primero que llegó');
  assert.equal(yt[0].id, ID);
  assert.equal(yt[0].seguidores, 12400, 'con lo que lo distingue de otro con el mismo nombre');
});

test('2. sin repetidos y una sola pregunta, la de más evidencia primero; «Ver otro» da la vuelta', () => {
  const a = { red: 'youtube', ref: '@federicocristofari', id: ID };
  const b = { red: 'youtube', ref: ID, id: ID };
  const otro = { red: 'youtube', ref: 'UCotro0000000000000000002', id: 'UCotro0000000000000000002' };
  const ig = { red: 'instagram', ref: 'fedecristofari', id: 'fedecristofari' };
  const tt = { red: 'tiktok', ref: 'fede' };
  assert.equal(claveDeCanal(a), claveDeCanal(b), 'el @ y el UC… del mismo canal son la misma clave');
  assert.deepEqual(sinCanalesRepetidos([a, b, otro]).map((k) => k.ref), ['@federicocristofari', otro.ref]);
  assert.deepEqual(preguntaDeAhora([tt, ig, a, b, otro]), { k: a, otros: 3 }, 'su YouTube primero, y cuántas más hay');
  assert.equal(preguntaDeAhora([tt, ig, a, b, otro], 1)?.k, otro, '«Ver otro»: el otro canal con su nombre');
  assert.equal(preguntaDeAhora([tt, ig, a, b, otro], 2)?.k, ig);
  assert.equal(preguntaDeAhora([tt, ig, a, b, otro], 4)?.k, a, 'da la vuelta');
  assert.equal(preguntaDeAhora([]), null);
});

test('3. la ruta y la pantalla también sacan los repetidos, y no se pregunta por una red ya sumada', () => {
  const ruta = sinComentarios(leer('app/api/competitor-spy/redes/route.ts'));
  assert.match(ruta, /candidatos: sinCanalesRepetidos\(candidatos\)/);
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(app, /candidatos: sinCanalesRepetidos\(r\.candidatos\)\.filter\(\(k\) => !\[\.\.\.r\.sumadas, \.\.\.\(v\[id\]\?\.sumadas \?\? \[\]\)\]\.some\(\(x\) => x\.red === k\.red\)\)/);
});

test('4. dibujado: una sola pastilla de pregunta, con lo que la distingue y «Ver otro» si hay más', () => {
  const k = (ref: string, id: string, seguidores: number, foto: string | null) => ({
    red: 'youtube' as const, ref, url: `https://www.youtube.com/${ref}`, titulo: 'Federico Cristofari', foto, porque: 'Mismo nombre', id, seguidores,
  });
  const html = renderToStaticMarkup(createElement(OtrasRedes, {
    b: { buscando: false, sumadas: [], candidatos: [k('@federicocristofari', ID, 12400, 'https://y/f.jpg'), k(ID, ID, 12400, 'https://y/f.jpg'), k('UCotro', 'UCotro', 310, null)] },
    ocupado: false, trayendo: null, onSi: () => {}, onNo: () => {}, onDeshacer: () => {},
  }));
  assert.equal(html.split('class="spy-redes-fila"').length - 1, 1, 'una pastilla, no dos ni tres');
  assert.match(html, /<small>12 mil suscriptores · Mismo nombre<\/small>/);
  assert.match(html, />Ver otro<\/button>/);
  assert.match(html, /data-con-foto="si"><img src="https:\/\/y\/f\.jpg"/, 'su foto, con el logo de su red en la esquina');
  const sola = renderToStaticMarkup(createElement(OtrasRedes, {
    b: { buscando: false, sumadas: [], candidatos: [k('@federicocristofari', ID, 12400, null)] },
    ocupado: false, trayendo: null, onSi: () => {}, onNo: () => {}, onDeshacer: () => {},
  }));
  assert.doesNotMatch(sola, /Ver otro/, 'sin otros, no hay «Ver otro»');
});

test('5. la fila de la miga no se parte en la computadora: el detalle cede primero y el nombre se lee siempre', () => {
  const css = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.match(css, /@media \(min-width:561px\)\{\.spy-volver\{flex-wrap:nowrap\}/);
  assert.match(css, /\.spy-redes-texto small\{flex:0 100 auto;min-width:0;overflow:hidden;text-overflow:ellipsis/);
  assert.match(css, /\.spy-redes-texto a\{[^}]*min-width:72px/);
});

// =============================================================================
// La clave de Apify RECHAZADA en Spy: se dice con su botón, no como un fallo mudo (14/11/2026)
// =============================================================================
// La llamada con Julio (13/11/2026, docs/relevo/llamada-julio-13-11.md, «Lo que falló en la demo»): en el detalle de un reel, el
// guion decía «No pude traer el video de Instagram» y Martín dijo «después lo reviso». Era la clave de Apify de Spy dando 401, y
// la pantalla no lo distinguía de una falla cualquiera. Además, un fallo bloqueaba el reintento un día: con la clave ya arreglada,
// el reel seguía con el error. Lo mismo al buscar las otras redes de un competidor: con la clave rechazada no aparecía nada y
// nada decía por qué (el Instagram de Andrea Cano). El Cerebro, 14/11: «con 401 o 403, devuelve el motivo nuevo
// 'clave-rechazada'… una sola línea con el botón, nunca "no encontré nada"».
//   1. lo que contestó Apify por el video: 401 y 403 son la clave (con su huella), un 500 es «no pude», un 200 sin video «no está»;
//   2. el guion con la clave rechazada lo dice, sin sumar a `fallos` ni esperar el día, y vuelve apenas cambian la clave;
//   3. sin ninguna clave ya, es «sin clave»; y Copywriting lo dice con sus palabras;
//   4. al buscar sus otras redes, Google o los perfiles con la clave rechazada son la clave, nunca «no encontré nada», y un
//      «no pude» cualquiera sigue sin texto;
//   5. la ficha dibuja UNA línea con el botón; sin la clave rechazada, nada;
//   6. el detalle, las rutas y los dos videos (reel y anuncio) pasan por acá.
//
// PROBADO ROMPIÉNDOLO (14/11/2026), una rotura por vez y restaurada, con el archivo en verde (qué tests caen):
//   · `rechazoLaClave` sólo con el 401 (el 403 vuelve a ser «no pude»)                 → 1
//   · `transcribirGuion` sin la rama de la clave (vuelve a ser un fallo)               → 2
//   · `hayQueTranscribir` sin mirar la huella (espera la hora con la clave nueva)      → 2
//   · `vistaDeGuion` sin la clave rechazada («Lo transcribo más tarde»)                → 2, 3
//   · la cadena que toma la respuesta rechazada de Google como un cuerpo vacío         → 4
//   · la cadena que no mira los perfiles rechazados                                    → 4
//   · la ficha sin la línea                                                            → 5
// Correr: node --import tsx --test tests/spy-clave-rechazada.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CLAVE_SPY_RECHAZADA, ESPERA_CLAVE_RECHAZADA_MS, ESPERA_TRAS_FALLO_MS, FALLOS_HASTA_ESPERAR, hayQueTranscribir, leerGuion, reclamarGuion,
  transcribirGuion, vistaDeGuion, type DepsGuion, type Guion, type ResultadoVideo,
} from '../lib/spy-transcripcion';
import { rechazoLaClave, videoDeLaRespuesta, videoDelAnuncio, videoDelItem } from '../lib/spy-todo-reglas';
import { cadenaDeRedes, type CompetidorCadena, type DepsCadena, type LeidoRed } from '../lib/spy-cadena';
import { CLAVE_RECHAZADA } from '../lib/spy-google-corrida';
import { REDES_CLAVE_RECHAZADA } from '../lib/spy-otras-redes-reglas';
import { OtrasRedes } from '../app/competitor-spy/OtrasRedes';
import { motivoSinTranscripcion, sinTranscripcion } from '../app/copywriter/transcribir-original';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ENLACE = 'https://www.instagram.com/reel/DAbc123xyz/';
const VIDEO = 'https://scontent.cdninstagram.com/v/t50/abc.mp4?oe=6740';
const HUELLA = 'aaaaaaaaaaaaaaaa';
const OTRA = 'bbbbbbbbbbbbbbbb';
const T0 = Date.parse('2026-11-14T12:00:00Z');
const MIN = 60_000;

type Doble = DepsGuion & { store: { crudo: string | null }; escuchas: number; respVideo: ResultadoVideo };
function doble(): Doble {
  let n = 0;
  const d: Doble = {
    store: { crudo: null }, escuchas: 0,
    respVideo: { ok: true, url: VIDEO },
    leer: async () => ({ crudo: d.store.crudo, version: d.store.crudo }),
    cambiarSi: async (version, nuevo) => {
      if (d.store.crudo !== version) return false;
      d.store.crudo = nuevo;
      return true;
    },
    video: async () => d.respVideo,
    bajar: async () => ({ bytes: new Uint8Array([1, 2, 3]), mime: 'video/mp4' }),
    escuchar: async () => { d.escuchas += 1; return { ok: true, texto: 'Nadie te dice esto.' }; },
    nuevoIntento: () => `t${++n}`,
  };
  return d;
}

test('1. lo que contestó Apify por el video: 401 y 403 son la clave, no «no pude»', () => {
  const clave = { huella: HUELLA };
  for (const status of [401, 403]) {
    assert.deepEqual(videoDeLaRespuesta({ status, cuerpo: null, clave }, videoDelItem), { ok: false, motivo: 'clave-rechazada', huella: HUELLA }, `HTTP ${status}`);
    assert.deepEqual(videoDeLaRespuesta({ status, cuerpo: null, clave }, videoDelAnuncio), { ok: false, motivo: 'clave-rechazada', huella: HUELLA }, `anuncio, HTTP ${status}`);
  }
  assert.deepEqual(videoDeLaRespuesta({ status: 500, cuerpo: null, clave }, videoDelItem), { ok: false, motivo: 'fallo' });
  assert.deepEqual(videoDeLaRespuesta(null, videoDelItem), { ok: false, motivo: 'fallo' }, 'sin respuesta es «no pude»');
  assert.deepEqual(videoDeLaRespuesta({ status: 200, cuerpo: [{ videoUrl: VIDEO }], clave }, videoDelItem), { ok: true, url: VIDEO });
  assert.deepEqual(videoDeLaRespuesta({ status: 200, cuerpo: [{ displayUrl: 'https://a/b.jpg' }], clave }, videoDelItem), { ok: false, motivo: 'no-esta' });
  // Sin crédito (402) o frenado (429) no es la clave: el 402 pasa a la siguiente (lib/spy-claves.ts).
  assert.equal(rechazoLaClave(402), false);
  assert.equal(rechazoLaClave(429), false);
});

test('2. el guion con la clave rechazada lo dice, sin contarlo como fallo, y vuelve apenas la cambian', async () => {
  const d = doble();
  d.respVideo = { ok: false, motivo: 'clave-rechazada', huella: HUELLA };
  // Rechazada varias veces seguidas (una por hora, con la misma clave): nunca llega a la espera de una semana de los fallos.
  let ahora = T0;
  for (let i = 0; i < FALLOS_HASTA_ESPERAR + 1; i += 1) {
    const r = await reclamarGuion(d, ahora, undefined, [HUELLA]);
    assert.equal(r.corre, true, `vuelta ${i + 1}: con la misma clave, pasada la hora se vuelve a pedir`);
    if (!r.corre) return;
    const fin = await transcribirGuion(d, ENLACE, r, () => ahora + 1000);
    assert.equal(fin.motivo, CLAVE_SPY_RECHAZADA);
    assert.equal(fin.fallos, 0, 'la clave no es un fallo del reel');
    ahora += ESPERA_CLAVE_RECHAZADA_MS + 5000;
  }
  assert.equal(d.escuchas, 0);
  const g = leerGuion(d.store.crudo);
  assert.equal(g?.claveRechazada, HUELLA, 'se guarda la huella, nunca la clave');
  const desde = Date.parse(g!.desde);
  assert.deepEqual(vistaDeGuion(g, { aplica: true, ahora: desde + MIN }), { estado: 'clave-rechazada' }, 'no «Lo transcribo más tarde»');
  // Con la MISMA clave no se pide enseguida: cada pedido gasta uno del tope del día de las transcripciones.
  assert.equal(hayQueTranscribir(g, desde + 5 * MIN, undefined, [HUELLA]), false);
  // Apenas la cambian, sí (la huella del rechazo ya no está entre las suyas): es lo que hace «Revisar la clave» → `onConectado`.
  assert.equal(hayQueTranscribir(g, desde + 5 * MIN, undefined, [OTRA]), true);
  assert.ok(ESPERA_CLAVE_RECHAZADA_MS < ESPERA_TRAS_FALLO_MS, 'la espera de la clave es más corta que la de un fallo');

  d.respVideo = { ok: true, url: VIDEO };
  const r2 = await reclamarGuion(d, desde + 5 * MIN, undefined, [OTRA]);
  assert.equal(r2.corre, true, 'con la clave nueva se vuelve a pedir');
  if (!r2.corre) return;
  const fin2 = await transcribirGuion(d, ENLACE, r2, () => desde + 6 * MIN);
  assert.equal(fin2.estado, 'listo');
  assert.equal(leerGuion(d.store.crudo)?.claveRechazada, undefined, 'sin rastro del rechazo');
});

test('3. sin ninguna clave ya, es «sin clave»; Copywriting lo dice con sus palabras', () => {
  const g: Guion = {
    estado: 'no-pudo', intento: 'x', desde: new Date(T0).toISOString(), hecho: null, texto: null, motivo: CLAVE_SPY_RECHAZADA, fallos: 0,
    reintentarEn: new Date(T0 + ESPERA_CLAVE_RECHAZADA_MS).toISOString(), claveRechazada: HUELLA,
  };
  assert.equal(leerGuion(JSON.stringify(g))?.claveRechazada, HUELLA, 'se lee de vuelta');
  assert.deepEqual(vistaDeGuion(g, { aplica: true, ahora: T0 + MIN }), { estado: 'clave-rechazada' });
  assert.deepEqual(vistaDeGuion(g, { aplica: true, sinClave: true, ahora: T0 + MIN }), { estado: 'sin-clave' }, 'si la sacaron, es «Conectar»');
  const dicho = sinTranscripcion(motivoSinTranscripcion({ estado: 'clave-rechazada' }), 'reel');
  assert.match(dicho, /^No pude transcribir el video \(la clave de Competitors Spy fue rechazada por Apify\), así que no sé lo que se dice/);
});

// ── Sus otras redes ──────────────────────────────────────────────────────────────────────────
// Andrea Cano: tiene su YouTube y le falta el Instagram. La cadena prueba su mismo usuario en Instagram (los perfiles) y Google.
const ANDREA: CompetidorCadena = { nombre: 'Andrea Cano', instagram: null, youtube_id: '@andreacanoart', tiktok: null, landing_url: null, avatar: null };

function deps(o: Partial<DepsCadena> = {}): DepsCadena & { cuenta: { perfiles: number; google: number } } {
  const cuenta = { perfiles: 0, google: 0 };
  return {
    cuenta,
    textoPropio: async () => '',
    abrirPagina: async () => null,
    leerCanales: async () => new Map<string, LeidoRed>(),
    leerPerfiles: async () => { cuenta.perfiles += 1; return new Map<string, LeidoRed>(); },
    googlear: async () => { cuenta.google += 1; return []; },
    gastarBusqueda: () => true,
    canalesDeVideos: async () => [],
    hashDeFoto: async () => null,
    ...o,
  };
}

test('4. al buscar sus otras redes, la clave rechazada es la clave, nunca «no encontré nada»', async () => {
  // Google rechazado y nada encontrado: la línea, con su motivo.
  let d = deps({ googlear: async () => CLAVE_RECHAZADA });
  assert.deepEqual(await cadenaDeRedes(ANDREA, d), { ok: false, error: REDES_CLAVE_RECHAZADA, clave: 'rechazada' });

  // Los perfiles rechazados (Google contesta, sin nada): también. Antes era un «no existe» mudo.
  d = deps({ leerPerfiles: async () => { d.cuenta.perfiles += 1; return CLAVE_RECHAZADA; } });
  assert.deepEqual(await cadenaDeRedes(ANDREA, d), { ok: false, error: REDES_CLAVE_RECHAZADA, clave: 'rechazada' });
  assert.ok(d.cuenta.perfiles >= 1, 'se probó su mismo usuario en Instagram');

  // Con algo encontrado (su web, en su descripción) sale lo encontrado Y la línea.
  d = deps({ textoPropio: async () => 'Mis cursos: https://andreacano.com', googlear: async () => CLAVE_RECHAZADA });
  const conWeb = await cadenaDeRedes(ANDREA, d);
  assert.ok(conWeb.ok);
  assert.equal(conWeb.ok && conWeb.web, 'https://andreacano.com');
  assert.equal(conWeb.clave, 'rechazada');

  // ⚠️ LO QUE NO CAMBIA: un «no pude» cualquiera de Google sigue sin texto (Martín, 4/11: «Elimina textos innecesarios»).
  d = deps({ googlear: async () => null });
  assert.deepEqual(await cadenaDeRedes(ANDREA, d), { ok: false, error: '' });
  // Y una búsqueda que contestó sin nada tampoco dice nada de la clave.
  d = deps();
  const nada = await cadenaDeRedes(ANDREA, d);
  assert.ok(nada.ok && !('clave' in nada), 'sin la clave rechazada no hay línea');
});

test('5. la ficha dibuja UNA línea con el botón; sin la clave rechazada, nada', () => {
  const props = {
    ocupado: false, trayendo: null, onSi: () => {}, onNo: () => {}, onDeshacer: () => {},
    botonClave: createElement('button', { type: 'button', className: 'spy-boton' }, 'Revisar la clave'),
  };
  const sola = renderToStaticMarkup(createElement(OtrasRedes, { ...props, b: { buscando: false, sumadas: [], candidatos: [], claveRechazada: true } }));
  assert.match(sola, /Apify rechazó tu clave de Spy: no pude buscar sus otras redes\./);
  assert.match(sola, /<button[^>]*>Revisar la clave<\/button>/);
  assert.equal(sola.split('spy-redes-clave').length - 1, 1, 'una sola línea');
  assert.equal(renderToStaticMarkup(createElement(OtrasRedes, { ...props, b: { buscando: false, sumadas: [], candidatos: [] } })), '', 'sin nada que decir, nada');
  assert.equal(renderToStaticMarkup(createElement(OtrasRedes, { ...props, b: { buscando: true, sumadas: [], candidatos: [], claveRechazada: true } })), '', 'mientras busca, nada');
});

test('6. el detalle, las rutas y los dos videos pasan por acá', () => {
  const detalle = sinComentarios(leer('app/competitor-spy/DetallePieza.tsx'));
  const rama = detalle.slice(detalle.indexOf("guion.estado === 'clave-rechazada'"), detalle.indexOf("guion.estado === 'listo' && guion.texto"));
  assert.match(rama, /\{CLAVE_SPY_RECHAZADA\}/);
  assert.match(rama, /<BotonIntegracion servicio="apify-instagram"[^>]*onConectado=\{onConectado\}>/, 'el botón a la clave de Spy, que lo vuelve a pedir');
  const todo = sinComentarios(leer('lib/spy-todo.ts'));
  assert.match(todo, /videoDeLaRespuesta\(r, videoDelItem\)/, 'el reel');
  assert.match(todo, /videoDeLaRespuesta\(r, videoDelAnuncio\)/, 'el anuncio');
  const transcribir = sinComentarios(leer('app/api/competitor-spy/transcribir/route.ts'));
  assert.match(transcribir, /huellasDeSpy\(ws\)/);
  assert.match(transcribir, /asegurarGuion\(ws, piezaId, \{[^}]*huellas[^}]*\}\)/);
  const srv = sinComentarios(leer('lib/spy-transcripcion-servidor.ts'));
  assert.match(srv, /reclamarGuion\(deps, Date\.now\(\), undefined, opts\.huellas\)/);
  const redes = sinComentarios(leer('lib/spy-otras-redes.ts'));
  assert.match(redes, /if \(r && rechazoLaClave\(r\.status\)\) \{[\s\S]{0,160}return CLAVE_RECHAZADA;/, 'Google');
  assert.match(redes, /l\.motivo === 'sin-permiso'\)\) return CLAVE_RECHAZADA/, 'los perfiles');
  assert.match(sinComentarios(leer('app/api/competitor-spy/redes/route.ts')), /\.\.\.\(r\.clave \? \{ clave: r\.clave \} : \{\}\)/);
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  assert.equal(app.split("claveRechazada: r.clave === 'rechazada'").length - 1, 2, 'con y sin resultados');
  assert.match(app, /botonClave=\{<BotonIntegracion servicio="apify-instagram"[^>]*onConectado=\{\(\) => void buscarRedes\(c\.id\)\}>/);
});

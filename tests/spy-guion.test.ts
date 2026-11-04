// =============================================================================
// El guion de un reel en el detalle: transcripto solo, una vez, con la IA y la clave del negocio (4/11/2026)
// =============================================================================
// Pedido de Martín (por el Cerebro, 4/11): «En cada uno de los videos cuando entro no estás trayendo la transcripción… hacé
// que se pida sola en segundo plano, con "Transcribiendo" mientras tanto». Medido: no había transcripción (el detalle decía
// que no se podía) y el video de cada reel se tiraba al leerlo. Corre lib/spy-transcripcion.ts con dobles: la clave en
// memoria con compare-and-set, un Apify que cuenta sus pedidos, una bajada y una IA que escucha.
//   1. sólo un reel de Instagram tiene guion, con su enlace;
//   2. la primera vez: «transcribiendo», UNA publicación a Apify, el video bajado y escuchado, en párrafos;
//   3. listo es listo: no se vuelve a pagar, hasta que vence a los 30 días;
//   4. dos a la vez: uno solo trabaja, y uno viejo no pisa al nuevo;
//   5. un fallo dice por qué y no se reintenta en cadena; un video muy pesado no se escucha cortado;
//   6. un reel sin voz queda dicho, sin volver a pagarlo;
//   7. la pantalla: sin IA o sin la clave de Apify lo dice; lo vencido no se muestra;
//   8. lo que va a Apify y lo que vuelve; «frente a su mediana»;
//   9. la ruta, el servidor, el detalle y «Dejar de mirarlo» pasan por acá.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada, base en verde (qué tests caen):
//   · `hayQueTranscribir` que no mira si ya está listo                   → 3
//   · `reclamarGuion` que no compara al escribir «transcribiendo»        → 2, 3, 4, 5, 6
//   · `transcribirGuion` que escribe sin compare-and-set                → 4
//   · `hayQueTranscribir` sin la espera tras un fallo                   → 5
//   · `transcribirGuion` que escucha un video cortado                   → 5
//   · `vencido` que no vence                                            → 3, 7
//   · el servidor con un `fetch` pelado para bajar el video             → 9
// Correr: node --import tsx --test tests/spy-guion.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ESPERA_TRAS_FALLO_MS, FALLOS_HASTA_ESPERAR, RETENCION_MS, TRANSCRIBIENDO_VENCE_MS,
  claveTranscripcion, enlaceDeLaPublicacion, guionLegible, hayQueTranscribir, leerGuion, prefijoTranscripciones, reclamarGuion,
  tieneGuion, transcribirGuion, vistaDeGuion, type DepsGuion, type ResultadoEscucha, type ResultadoVideo,
} from '../lib/spy-transcripcion';
import { entradaDeUnaPublicacion, videoDelItem } from '../lib/spy-todo-reglas';
import { vecesSuMediana } from '../lib/spy-detalle';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const ENLACE = 'https://www.instagram.com/reel/DAbc123xyz/';
const VIDEO = 'https://scontent.cdninstagram.com/v/t50/abc.mp4?oe=6740';
const DICHO = 'Nadie te dice esto. Si vendes servicios, tu problema no es el precio. Es que nadie sabe qué haces. Te muestro cómo lo arreglé en una semana. Escríbeme «GUIA» y te la mando.';

type Doble = DepsGuion & {
  store: { crudo: string | null };
  videos: string[];
  bajadas: string[];
  escuchas: number;
  respVideo: ResultadoVideo;
  respBajada: { bytes: Uint8Array; mime: string } | null | Error;
  respEscucha: ResultadoEscucha;
};

function doble(): Doble {
  let n = 0;
  const d: Doble = {
    store: { crudo: null }, videos: [], bajadas: [], escuchas: 0,
    respVideo: { ok: true, url: VIDEO },
    respBajada: { bytes: new Uint8Array([1, 2, 3]), mime: 'video/mp4' },
    respEscucha: { ok: true, texto: DICHO },
    leer: async () => ({ crudo: d.store.crudo, version: d.store.crudo }),
    cambiarSi: async (version, nuevo) => {
      if (d.store.crudo !== version) return false;
      d.store.crudo = nuevo;
      return true;
    },
    video: async (enlace) => { d.videos.push(enlace); return d.respVideo; },
    bajar: async (url) => {
      d.bajadas.push(url);
      if (d.respBajada instanceof Error) throw d.respBajada;
      return d.respBajada;
    },
    escuchar: async () => { d.escuchas += 1; return d.respEscucha; },
    nuevoIntento: () => `t${++n}`,
  };
  return d;
}

const T0 = Date.parse('2026-11-04T12:00:00Z');

async function unaVez(d: Doble, ahora: number) {
  const r = await reclamarGuion(d, ahora);
  if (!r.corre) return { corrio: false as const, r };
  return { corrio: true as const, fin: await transcribirGuion(d, ENLACE, r, () => ahora + 1000) };
}

test('1. sólo un reel de Instagram tiene guion, con su enlace', () => {
  assert.equal(tieneGuion({ canal: 'instagram', tipo: 'reel' }), true);
  assert.equal(tieneGuion({ canal: 'instagram', tipo: 'publicacion' }), false, 'una imagen no tiene voz');
  assert.equal(tieneGuion({ canal: 'youtube', tipo: 'video', ref: 'AbCdEfGhIj0' }), true, 'YouTube lo transcribe Gemini (tests/spy-guion-youtube.test.ts)');
  assert.equal(tieneGuion({ canal: 'youtube', tipo: 'video' }), false, 'sin su id no hay enlace');
  assert.equal(tieneGuion({ canal: 'anuncios', tipo: 'anuncio' }), false);
  assert.equal(enlaceDeLaPublicacion({ url: ENLACE, ref: 'x' }), ENLACE);
  assert.equal(enlaceDeLaPublicacion({ url: null, ref: 'DAbc123xyz' }), 'https://www.instagram.com/p/DAbc123xyz/');
  assert.equal(enlaceDeLaPublicacion({ url: 'https://evil.example.com/', ref: '../../x' }), null, 'ni un enlace ajeno ni un código raro');
  assert.equal(claveTranscripcion(13, 2071), 'spy.transcripcion.13.2071');
  assert.ok(claveTranscripcion(13, 2071).startsWith(prefijoTranscripciones(13)));
  assert.ok(!claveTranscripcion(130, 1).startsWith(prefijoTranscripciones(13)), 'el prefijo de 13 no se lleva los de 130');
});

test('2. la primera vez: «transcribiendo», una publicación a Apify, bajado, escuchado y en párrafos', async () => {
  const d = doble();
  const r = await reclamarGuion(d, T0);
  assert.equal(r.corre, true);
  assert.equal(leerGuion(d.store.crudo)?.estado, 'transcribiendo');
  assert.deepEqual(vistaDeGuion(leerGuion(d.store.crudo), { aplica: true, ahora: T0 }), { estado: 'transcribiendo', texto: null, motivo: null });
  const fin = await transcribirGuion(d, ENLACE, r as Extract<typeof r, { corre: true }>, () => T0 + 1000);
  assert.equal(fin.estado, 'listo');
  assert.deepEqual(d.videos, [ENLACE], 'UNA publicación a Apify');
  assert.deepEqual(d.bajadas, [VIDEO]);
  assert.equal(d.escuchas, 1);
  assert.equal(fin.texto?.split('\n\n').length, 2, 'de a tres frases por párrafo');
  assert.match(fin.texto ?? '', /^Nadie te dice esto\./);
  assert.deepEqual(leerGuion(d.store.crudo), fin);
});

test('3. listo es listo: no se vuelve a pagar, hasta que vence a los 30 días', async () => {
  const d = doble();
  await unaVez(d, T0);
  const otra = await unaVez(d, T0 + 24 * 60 * 60_000);
  assert.equal(otra.corrio, false);
  assert.equal(d.videos.length, 1, 'ni Apify');
  assert.equal(d.escuchas, 1, 'ni la IA');
  const luego = await unaVez(d, T0 + RETENCION_MS + 60_000);
  assert.equal(luego.corrio, true, 'vencido: se vuelve a transcribir si alguien lo abre');
  assert.equal(d.escuchas, 2);
});

test('4. dos a la vez: uno solo trabaja, y uno viejo que termina tarde no pisa al nuevo', async () => {
  const d = doble();
  const a = await reclamarGuion(d, T0);
  const b = await reclamarGuion(d, T0 + 1000);
  assert.equal(a.corre, true);
  assert.equal(b.corre, false);
  const c = await reclamarGuion(d, T0 + TRANSCRIBIENDO_VENCE_MS + 5000);
  assert.equal(c.corre, true, 'uno colgado se retoma pasado el vencimiento');
  d.respEscucha = { ok: false, error: 'viejo' };
  await transcribirGuion(d, ENLACE, a as Extract<typeof a, { corre: true }>);
  assert.equal(leerGuion(d.store.crudo)?.intento, (c as Extract<typeof c, { corre: true }>).actual.intento, 'la clave sigue siendo del nuevo');
  const e = doble();
  e.cambiarSi = async () => false;
  assert.equal((await reclamarGuion(e, T0)).corre, false);
});

test('5. un fallo dice por qué y no se reintenta en cadena; un video muy pesado no se escucha cortado', async () => {
  const d = doble();
  d.respVideo = { ok: false, motivo: 'sin-clave' };
  let r = await unaVez(d, T0);
  assert.equal(r.corrio && r.fin.motivo, 'Para transcribirlo hace falta tu clave de Apify.');
  assert.equal(d.escuchas, 0);
  assert.equal(hayQueTranscribir(leerGuion(d.store.crudo), T0 + 60 * 60_000), false, 'no en la misma hora');
  assert.equal(hayQueTranscribir(leerGuion(d.store.crudo), T0 + ESPERA_TRAS_FALLO_MS + 5000), true, 'al día siguiente');

  const e = doble();
  e.respBajada = null;
  r = await unaVez(e, T0);
  assert.equal(r.corrio && r.fin.motivo, 'El video pesa demasiado para transcribirlo.');
  assert.equal(e.escuchas, 0, 'un video cortado no se escucha');

  const f = doble();
  f.respBajada = new Error('403');
  r = await unaVez(f, T0);
  assert.equal(r.corrio && r.fin.motivo, 'No pude bajar el video de Instagram.');

  const g = doble();
  g.respEscucha = { ok: false, error: 'Conecta tu IA para transcribir este reel.' };
  let ahora = T0;
  for (let i = 0; i < FALLOS_HASTA_ESPERAR; i += 1) {
    await unaVez(g, ahora);
    ahora += ESPERA_TRAS_FALLO_MS + 5000;
  }
  const guion = leerGuion(g.store.crudo);
  assert.equal(guion?.fallos, FALLOS_HASTA_ESPERAR);
  assert.equal(guion?.motivo, 'Conecta tu IA para transcribir este reel.');
  assert.equal(hayQueTranscribir(guion, ahora), false, `a los ${FALLOS_HASTA_ESPERAR} fallos espera una semana`);
});

test('6. un reel sin voz queda dicho, sin volver a pagarlo', async () => {
  const d = doble();
  d.respEscucha = { ok: true, texto: '   ' };
  const r = await unaVez(d, T0);
  assert.equal(r.corrio && r.fin.estado, 'listo');
  assert.equal(r.corrio && r.fin.motivo, 'No tiene voz: es sólo música o imagen.');
  assert.equal(hayQueTranscribir(leerGuion(d.store.crudo), T0 + 60_000), false);
  assert.deepEqual(vistaDeGuion(leerGuion(d.store.crudo), { aplica: true, ahora: T0 }), { estado: 'listo', texto: '', motivo: 'No tiene voz: es sólo música o imagen.' });
});

test('7. la pantalla: sin IA o sin la clave lo dice, y lo vencido no se muestra', () => {
  assert.deepEqual(vistaDeGuion(null, { aplica: false }), { estado: 'no-aplica' });
  assert.deepEqual(vistaDeGuion(null, { aplica: true, sinIA: true }), { estado: 'sin-ia' });
  assert.deepEqual(vistaDeGuion(null, { aplica: true, sinClave: true, sinIA: true }), { estado: 'sin-clave' });
  const listo = { estado: 'listo' as const, intento: 'x', desde: new Date(T0).toISOString(), hecho: new Date(T0).toISOString(), texto: 'Hola.', motivo: null, fallos: 0 };
  assert.deepEqual(vistaDeGuion(listo, { aplica: true, sinIA: true, ahora: T0 + 1000 }), { estado: 'listo', texto: 'Hola.', motivo: null }, 'lo ya transcripto se ve aunque hoy no haya IA');
  assert.deepEqual(vistaDeGuion(listo, { aplica: true, sinIA: true, ahora: T0 + RETENCION_MS + 1000 }), { estado: 'sin-ia' }, 'vencido no se muestra');
  assert.equal(guionLegible('  Hola.\n\n  Chau.  '), 'Hola.\nChau.', 'si ya viene en renglones, se respeta');
});

test('8. lo que va a Apify y lo que vuelve; «frente a su mediana»', () => {
  assert.deepEqual(entradaDeUnaPublicacion(ENLACE), { directUrls: [ENLACE], resultsType: 'posts', resultsLimit: 1, addParentData: false });
  assert.equal(videoDelItem([{ shortCode: 'x', videoUrl: VIDEO }]), VIDEO);
  assert.equal(videoDelItem([{ shortCode: 'x', displayUrl: 'https://a/b.jpg' }]), null, 'una imagen no trae video');
  assert.equal(videoDelItem([{ videoUrl: 'http://inseguro/x.mp4' }]), null);
  assert.equal(videoDelItem({ error: 'no' }), null);

  type PiezaDelGrafico = Parameters<typeof vecesSuMediana>[1][number];
  const p = (id: number, vistas: number | null): PiezaDelGrafico => ({ id, canal: 'instagram', tipo: 'reel', vistas, megusta: null, publicada_en: '2026-10-01T00:00:00Z', visto_primera_vez: '2026-10-01T00:00:00Z', dejo_de_verse_en: null });
  const todas = [p(1, 1000), p(2, 2000), p(3, 3000), p(4, 6900)];
  // Mediana de 1000, 2000, 3000 y 6900 = 2500 → 6900 / 2500 = 2,76 → 2,8.
  assert.equal(vecesSuMediana(4, todas), 2.8);
  assert.equal(vecesSuMediana(1, todas), 0.4);
  assert.equal(vecesSuMediana(9, todas), null);
  assert.equal(vecesSuMediana(1, todas.slice(0, 2)), null, 'con dos piezas la mediana no dice nada');
});

test('9. la ruta, el servidor, el detalle y «Dejar de mirarlo» pasan por acá', () => {
  const ruta = sinComentarios(leer('app/api/competitor-spy/transcribir/route.ts'));
  assert.match(ruta, /soloAdminDeTab\('market-an'\)/);
  assert.match(ruta, /conSuIADelNegocio\(ws, /, 'D6b');
  assert.match(ruta, /after\(correr\)/);
  const srv = sinComentarios(leer('lib/spy-transcripcion-servidor.ts'));
  assert.match(srv, /bajarWebSegura\(url, \{ validar: validarDestino, pedir: \(u, ips\) => pedirClavado\(u, ips, UA, \{ maxBytes: MAX_BYTES_VIDEO \+ 1/, 'la bajada SSRF-segura, con techo');
  assert.doesNotMatch(srv, /\bfetch\(/, 'sin un fetch pelado al CDN');
  assert.match(srv, /pii: true, sinGroq: true/, 'la IA del negocio, sin la red de la plataforma');
  assert.match(srv, /salidaDegenerada\(texto\)/);
  const todo = sinComentarios(leer('lib/spy-todo.ts'));
  assert.match(todo, /reservarCorrida\(CLAVE_DIA_TRANSCRIPCIONES, TRANSCRIPCIONES_POR_DIA\)/, 'con su tope del día, contado en la base');
  assert.match(todo, /entradaDeUnaPublicacion\(enlace\)/);
  const detalle = sinComentarios(leer('app/competitor-spy/DetallePieza.tsx'));
  assert.match(detalle, /fetch\('\/api\/competitor-spy\/transcribir'/);
  assert.match(detalle, /Transcribiendo…/);
  assert.match(detalle, /Hacer uno así/);
  assert.doesNotMatch(detalle, /Copiar estructura/, 'el botón de antes se fue');
  const spy = sinComentarios(leer('lib/spy.ts'));
  const quitar = spy.slice(spy.indexOf('export async function quitarCompetidor'), spy.indexOf('export async function quitarCanal'));
  assert.match(quitar, /borrarSettingsConPrefijo\(prefijoTranscripciones\(id\)\)/);
  const api = sinComentarios(leer('lib/api-mako/areas/spy.run.ts'));
  assert.match(api, /const guiones = await guionesGuardados\(c\.c\.id\)/, 'la API de MaKo lee el guion guardado, sin pedir nada');
  assert.match(api, /Guion: \$\{guion/);
});

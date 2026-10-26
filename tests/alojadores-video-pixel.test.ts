// =============================================================================
// El Pixel mide los videos de Bunny Stream y Cloudflare Stream, y el YouTube que trae enablejsapi=1 (v27, 25/10/2026)
// =============================================================================
// Martín (25/10): «Implementa otros alojadores de video, no solo panda, como Vimeo u otros... Y asegurate de que
// funcionen bien». Medido ese día en Chrome con un video REAL de cada alojador (scripts/pixel-alojadores-real.mts):
// Panda, Vimeo, Wistia y YouTube ya medían; Bunny, Cloudflare y un YouTube con enablejsapi=1 en una página sin la API
// de YouTube daban CERO eventos con play, pausa y avance. Lo que fija:
//   1. el analizador de páginas ve las dos piezas nuevas y arma el MISMO id que el Pixel (si no, el mismo video sale
//      dos veces en la pantalla que los nombra);
//   2. el Pixel: Bunny por player.js (con su suscripción), Cloudflare por sus mensajes, y el YouTube al que nadie le pide;
//   3. la versión sube con su novedad, y una página con un código anterior y uno de esos videos se entera.
// Correr: node --import tsx --test tests/alojadores-video-pixel.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analizarHtml, hostDeVideoId, videosDeHtml } from '../lib/landing-analisis';
import { PREFIJOS_CANONICOS, canonizarVideoId } from '../lib/video-id';

const leer = (rel: string) => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const BT = String.fromCharCode(96);
const BS = String.fromCharCode(92);

/** El snippet tal cual sale (lo mismo que tests/landing-snippet-emitido.test.ts: el módulo es sólo de servidor). */
function snippetEmitido(): string {
  const s = leer('lib/landing-token.ts');
  const desde = s.indexOf('return ' + BT + '<script>');
  const hasta = s.indexOf('</script>' + BT + ';', desde);
  assert.ok(desde > 0 && hasta > desde, 'no se encontró el template del snippet');
  const tpl = s.slice(desde + ('return ' + BT).length, hasta);
  const mapa: Record<string, string> = { n: '\n', t: '\t', r: '\r', [BS]: BS, [BT]: BT, $: '$' };
  let out = '';
  for (let i = 0; i < tpl.length; i++) {
    if (tpl[i] === BS && i + 1 < tpl.length) { out += mapa[tpl[i + 1]] ?? tpl[i + 1]; i++; } else out += tpl[i];
  }
  return out;
}

// Los videos de verdad con los que se midió (los de la documentación de cada alojador).
const BUNNY = 'https://iframe.mediadelivery.net/embed/197133/dc48a09e-d9bb-420a-83d7-72dc2304c034';
const CF_CLIENTE = 'https://customer-f33zs165nr7gyfy4.cloudflarestream.com/6b9e68b07dfee8cc2d116e4c51d6a957/iframe';
const CF_DELIVERY = 'https://iframe.videodelivery.net/5d5bc37ffcf54c9b82e996823bffbb81';
const iframe = (src: string) => `<iframe src="${src}" allow="autoplay"></iframe>`;
const BASE = 'https://ejemplo.com/';

test('el analizador ve Bunny y Cloudflare como videos que se miden, con su id', () => {
  const html = iframe(BUNNY) + iframe(CF_CLIENTE) + iframe(CF_DELIVERY);
  const piezas = analizarHtml(BASE, html).piezas;
  assert.ok(piezas.has('video-bunny') && piezas.has('video-cloudflare'));
  const ids = videosDeHtml(BASE, html).map((v) => v.id);
  assert.deepEqual(ids, ['bunny:dc48a09e-d9bb-420a-83d7-72dc2304c034', 'cfs:6b9e68b07dfee8cc2d116e4c51d6a957', 'cfs:5d5bc37ffcf54c9b82e996823bffbb81']);
  assert.equal(hostDeVideoId(ids[0])?.medible, true);
  assert.equal(hostDeVideoId(ids[1])?.pieza, 'video-cloudflare');
  assert.ok(PREFIJOS_CANONICOS.includes('bunny:') && PREFIJOS_CANONICOS.includes('cfs:'));
  assert.equal(canonizarVideoId(ids[0]), ids[0], 'el canónico es el mismo');
});

test('el Pixel arma el MISMO id que el analizador para el mismo iframe', () => {
  const s = snippetEmitido();
  const fuente = /function otroId\(r\) \{[\s\S]*?\n {2}\}/.exec(s)?.[0];
  assert.ok(fuente, 'no encontré otroId en el snippet');
  const otroId = new Function(`${fuente}; return otroId;`)() as (r: unknown) => string;
  const r = (src: string, cual: 'bunny' | 'cfs') => ({ cual, el: { getAttribute: () => src } });
  for (const [src, cual] of [[BUNNY, 'bunny'], [CF_CLIENTE, 'cfs'], [CF_DELIVERY, 'cfs']] as const) {
    assert.equal(otroId(r(src, cual)), videosDeHtml(BASE, iframe(src))[0].id, src);
  }
});

test('Bunny por player.js (suscribirse), Cloudflare por sus mensajes, y por el origen', () => {
  const s = snippetEmitido();
  // El origen, sin el dominio entero en el texto (el analizador de piezas lo busca en la página).
  assert.ok(s.includes('var BUNNY_ORIGEN = /^https:\\/\\/(iframe|player)\\.mediadelivery\\.net$/;'), 'BUNNY_ORIGEN');
  assert.ok(s.includes('var CFS_ORIGEN = /^https:\\/\\/(iframe\\.videodelivery\\.net|(iframe|customer-[a-z0-9]+)\\.cloudflarestream\\.com)$/;'), 'CFS_ORIGEN');
  // Bunny no manda nada hasta la suscripción, que va como TEXTO JSON, en el saludo y al arrancar.
  assert.ok(s.includes("w.postMessage(JSON.stringify({ context: 'player.js', version: '0.0.11', method: 'addEventListener', value: n[i], listener: 'mko-' + n[i] }), origen)"));
  assert.ok(s.includes("if (d.event === 'ready') { r.vid = otroId(r); bunnySuscribir(ev.source, o); return; }"));
  // Cloudflare: los segundos y la duración llegan como propiedades, el play y la pausa como eventos.
  assert.match(s, /if \(d\.property === 'duration'\) otroTiempo\(r, e, null, d\.value\);\s*else if \(d\.property === 'currentTime'\) otroTiempo\(r, e, d\.value, 0\);/);
  assert.match(s, /if \(d\.eventName === 'play'\) otroPlay\(r, e\);\s*else if \(d\.eventName === 'pause'\) otroPausa\(r, e\);\s*else if \(d\.eventName === 'ended'\) otroFin\(r, e\);/);
  // El avance, igual que YouTube (los hitos de 5 % y la escalera de segundos).
  assert.ok(s.includes('if (e.play && !e.pausado) ytAvance(e, r.vid);'));
});

test('el YouTube que ya trae enablejsapi=1 se pide a los 6 s si nadie le habló y no hay API de YouTube', () => {
  const s = snippetEmitido();
  assert.match(s, /if \(y\.pasivo\) \{\s*if \(!y\.espera && !y\.vivo\) y\.espera = setTimeout\(function \(\) \{ y\.espera = 0; ytQuizasPedir\(y\); \}, 6000\);/);
  assert.match(s, /if \(!y\.pasivo \|\| y\.vivo \|\| y\.recargado \|\| ytHayApi\(\)\) return;\s*y\.pasivo = false;\s*ytOir\(y\);/);
  assert.ok(s.includes('if (window.YT && window.YT.Player) return true;'));
});

test('la versión 27 con su novedad, y la página con un código anterior y uno de esos videos se entera', () => {
  const fuente = leer('lib/landing-token.ts');
  assert.match(fuente, /^export const SNIPPET_VERSION = 27;$/m);
  assert.match(fuente, /^ {2}27: 'la medición de los videos de Bunny Stream y de Cloudflare Stream/m);
  assert.ok(fuente.includes("const HOSTS_DE_LA_V27 = ['video-bunny', 'video-cloudflare'];"));
  assert.ok(fuente.includes('|| (instalada < 27 && !!piezas && piezas.some((p) => HOSTS_DE_LA_V27.includes(p)))'));
});

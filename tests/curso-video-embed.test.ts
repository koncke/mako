// =============================================================================
// curso-video-embed — el video de una clase: TODAS las formas reales de un link, y el código embed
// =============================================================================
// Item 14 del audio del 08/10/2026 (docs/feedback-curso-08oct.md, 22:40 y 23:10):
//   · «Hoy en día solamente funciona con URL, tengo que hacer que funcione con URL y con objetos embed.
//     Con HTML embed». El link de Panda caía en «afuera»: «me redirige a Panda pero no me toma la
//     previsualización de Panda».
//   · «el de YouTube me lo permite previsualizar, pero no puedo ver el video desde la aplicación… me
//     redirige un link».
//
// Ejecuta `videoDeLink` y `reproductorDeClase` (lib/curso.ts) sobre una TABLA DE LINKS REALES y mira el
// reproductor que le toca a cada uno. Medido ANTES del arreglo (scratchpad video/formas-antes.txt): caían
// en «afuera» `music.youtube.com`, `/e/<id>`, el `attribution_link`, Drive con `/file/u/0/d/`,
// `docs.google.com/file/d/` y el reproductor de Panda; en NADA (no se podían ni guardar) todo link sin
// `https://` y TODO código `<iframe>`; y `/embed/videoseries` (una lista) se tomaba por el video
// «videoseries», y un showcase de Vimeo daba el número del showcase.
//
// Probado ROMPIÉNDOLO (08/10/2026), una rotura por vez, restaurado de la copia en memoria y verificado por
// hash (scratchpad video/romper.mjs). El resultado, con números, en el bloque «ROTURAS» del final.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { videoDeLink, reproductorDeClase, tapaDeVideo, type Clase } from '../lib/curso';
import { validarVideoEntrada, videoDeClase } from '../app/customer-success/curso/reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios (las líneas primero, los bloques después: AGENTS.md). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const YT = 'dQw4w9WgXcQ';
const PANDA = 'https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=8d035c87-3767-4b84-8a3d-da41efc6524f';
const clase = (videoUrl: string): Pick<Clase, 'videoTipo' | 'videoUrl' | 'videoPath'> => ({ videoTipo: 'url', videoUrl, videoPath: null });

type Esperado = { tipo: string; medible: boolean; embed?: string; id?: string };

/** La tabla: link o código REAL → el reproductor de la clase. */
const TABLA: Array<[string, Esperado]> = [
  // YouTube: todas se miden con su IFrame API.
  [`https://www.youtube.com/watch?v=${YT}`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://youtube.com/watch?v=${YT}&list=PLx1&index=2`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://www.youtube.com/watch?v=${YT}&t=42s`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://youtu.be/${YT}`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://youtu.be/${YT}?si=AbCdEf123`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://youtu.be/${YT}?t=42`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://m.youtube.com/watch?v=${YT}&feature=share`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://www.youtube.com/shorts/${YT}?si=x`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://www.youtube.com/live/${YT}?si=x`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://www.youtube.com/embed/${YT}?si=x`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://www.youtube-nocookie.com/embed/${YT}?rel=0`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://music.youtube.com/watch?v=${YT}&si=x`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://www.youtube.com/watch?app=desktop&v=${YT}`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://www.youtube.com/v/${YT}`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://www.youtube.com/e/${YT}`, { tipo: 'youtube', medible: true, id: YT }],
  [`youtube.com/watch?v=${YT}`, { tipo: 'youtube', medible: true, id: YT }],
  [`www.youtube.com/watch?v=${YT}`, { tipo: 'youtube', medible: true, id: YT }],
  [`https://www.youtube.com/attribution_link?a=x&u=%2Fwatch%3Fv%3D${YT}%26feature%3Dshare`, { tipo: 'youtube', medible: true, id: YT }],
  [`<iframe width="560" height="315" src="https://www.youtube.com/embed/${YT}?si=x" title="YouTube video player" frameborder="0" allowfullscreen></iframe>`, { tipo: 'youtube', medible: true, id: YT }],
  // Una lista no es UN video: se abre en YouTube (antes se tomaba por el video «videoseries»).
  ['https://www.youtube.com/embed/videoseries?list=PLx1', { tipo: 'afuera', medible: false }],
  // Vimeo: se mide con su Player API; el hash de uno no listado viaja.
  ['https://vimeo.com/123456789', { tipo: 'vimeo', medible: true, embed: 'https://player.vimeo.com/video/123456789' }],
  ['https://vimeo.com/123456789/abcdef1234', { tipo: 'vimeo', medible: true, embed: 'https://player.vimeo.com/video/123456789?h=abcdef1234' }],
  ['https://vimeo.com/123456789/abcdef1234?share=copy', { tipo: 'vimeo', medible: true, embed: 'https://player.vimeo.com/video/123456789?h=abcdef1234' }],
  ['https://player.vimeo.com/video/123456789?h=abcdef1234&badge=0', { tipo: 'vimeo', medible: true, embed: 'https://player.vimeo.com/video/123456789?h=abcdef1234' }],
  ['https://vimeo.com/channels/staffpicks/123456789', { tipo: 'vimeo', medible: true, embed: 'https://player.vimeo.com/video/123456789' }],
  ['https://vimeo.com/showcase/1234/video/123456789', { tipo: 'vimeo', medible: true, embed: 'https://player.vimeo.com/video/123456789' }],
  ['https://vimeo.com/manage/videos/123456789', { tipo: 'vimeo', medible: true, embed: 'https://player.vimeo.com/video/123456789' }],
  ['<iframe src="https://player.vimeo.com/video/123456789?h=abcdef1234&amp;badge=0&amp;autopause=0" frameborder="0"></iframe>', { tipo: 'vimeo', medible: true, embed: 'https://player.vimeo.com/video/123456789?h=abcdef1234' }],
  // Loom y Drive: adentro, «sin medir».
  ['https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184?sid=abc', { tipo: 'iframe', medible: false, embed: 'https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184' }],
  ['https://loom.com/share/0281766fa2d04bb788eaf19e65135184', { tipo: 'iframe', medible: false, embed: 'https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184' }],
  ['https://www.loom.com/share/Mi-clase-0281766fa2d04bb788eaf19e65135184', { tipo: 'iframe', medible: false, embed: 'https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184' }],
  ['https://drive.google.com/file/d/1AbC_dEf-123/view?usp=sharing', { tipo: 'iframe', medible: false, embed: 'https://drive.google.com/file/d/1AbC_dEf-123/preview' }],
  ['https://drive.google.com/file/u/0/d/1AbC_dEf-123/view', { tipo: 'iframe', medible: false, embed: 'https://drive.google.com/file/d/1AbC_dEf-123/preview' }],
  ['https://drive.google.com/open?id=1AbC_dEf-123', { tipo: 'iframe', medible: false, embed: 'https://drive.google.com/file/d/1AbC_dEf-123/preview' }],
  ['https://docs.google.com/file/d/1AbC_dEf-123/edit', { tipo: 'iframe', medible: false, embed: 'https://drive.google.com/file/d/1AbC_dEf-123/preview' }],
  // Panda: ADENTRO y medido (lo que se pidió). El link del reproductor y el código que da su panel.
  [PANDA, { tipo: 'panda', medible: true, embed: PANDA }],
  ['<div style="position:relative;padding-top:56.25%;"><iframe id="panda-x" src="https://player-vz-dd4ad08b-375.tv.pandavideo.com.br/embed/?v=8d035c87-3767-4b84-8a3d-da41efc6524f" style="border:none;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture" allowfullscreen=true width="720" height="360" fetchpriority="high"></iframe></div>',
    { tipo: 'panda', medible: true, embed: 'https://player-vz-dd4ad08b-375.tv.pandavideo.com.br/embed/?v=8d035c87-3767-4b84-8a3d-da41efc6524f' }],
  // Wistia y Bunny: adentro, «sin medir».
  ['https://fast.wistia.net/embed/iframe/e4a27b971d', { tipo: 'iframe', medible: false, embed: 'https://fast.wistia.net/embed/iframe/e4a27b971d' }],
  ['https://iframe.mediadelivery.net/embed/12345/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', { tipo: 'iframe', medible: false, embed: 'https://iframe.mediadelivery.net/embed/12345/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d' }],
  // Un archivo directo se mide con <video>; un link cualquiera se abre afuera, como siempre.
  ['https://cdn.ejemplo.com/clases/uno.mp4', { tipo: 'directo', medible: true }],
  ['https://ejemplo.com/una-pagina', { tipo: 'afuera', medible: false }],
  ['https://calendly.com/juan/30min', { tipo: 'afuera', medible: false }],
];

test('la TABLA de links reales: cada forma da el reproductor que le toca (ninguna real cae «afuera»)', () => {
  const mal: string[] = [];
  for (const [link, esp] of TABLA) {
    const r = reproductorDeClase(clase(link));
    const v = r.video as { tipo: string; id?: string; embed?: string } | null;
    const ok = v != null && v.tipo === esp.tipo && r.medible === esp.medible
      && (esp.id == null || v.id === esp.id) && (esp.embed == null || v.embed === esp.embed);
    if (!ok) mal.push(`${link.slice(0, 80)} → ${JSON.stringify(r)}`);
  }
  assert.deepEqual(mal, []);
});

test('lo que se GUARDA de un código o de un link de Panda es el reproductor, y cabe en la columna de siempre', () => {
  // `video_tipo` tiene un CHECK con siete valores (mig 0202): Panda se guarda como 'url' con su reproductor.
  const codigo = TABLA.find(([l]) => l.startsWith('<div style="position:relative;padding-top'))![0];
  const g = validarVideoEntrada({ tipo: 'url', url: codigo }, { ws: 1, productoId: 1 });
  assert.ok(g.ok);
  assert.deepEqual(g.video, { video_tipo: 'url', video_url: 'https://player-vz-dd4ad08b-375.tv.pandavideo.com.br/embed/?v=8d035c87-3767-4b84-8a3d-da41efc6524f', video_path: null });
  assert.ok(['ninguno', 'archivo', 'youtube', 'vimeo', 'loom', 'drive', 'url'].includes(g.video.video_tipo));
  // Lo guardado se vuelve a reconocer igual (el portal y la tab preguntan a lo guardado).
  assert.deepEqual(reproductorDeClase({ videoTipo: 'url', videoUrl: g.video.video_url, videoPath: null }).video, { tipo: 'panda', embed: g.video.video_url });
  // Un código de YouTube se guarda con el link que trae, y se reproduce con la API.
  const yt = validarVideoEntrada({ tipo: 'url', url: TABLA.find(([l]) => l.startsWith('<iframe width'))![0] }, { ws: 1, productoId: 1 });
  assert.ok(yt.ok && yt.video.video_tipo === 'youtube');
  // El rótulo de la pantalla: Panda, medido (no «Link · sin medir»).
  assert.deepEqual(videoDeClase({ videoTipo: 'url', videoUrl: PANDA, videoPath: null }), { hay: true, rotulo: 'Panda Video', medible: true });
});

test('lo que NO es un video no se guarda: el panel de Panda (sin biblioteca), un código sin link, un esquema raro', () => {
  for (const malo of [
    'https://dashboard.pandavideo.com.br/#/videos/8d035c87-3767-4b84-8a3d-da41efc6524f',
    '<p>hola</p>', '<iframe src="javascript:alert(1)"></iframe>', 'javascript:alert(1)', 'data:text/html,x', '',
    'https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=no-es-un-uuid',
  ]) {
    assert.equal(videoDeLink(malo), null, malo);
    assert.equal(reproductorDeClase(clase(malo)).video, null, malo);
  }
  const r = validarVideoEntrada({ tipo: 'url', url: '<iframe srcdoc="<script>alert(1)</script>"></iframe>' }, { ws: 1, productoId: 1 });
  assert.equal(r.ok, false);
});

test('la tapa de la tarjeta: Panda va sin miniatura (no se inventa una), los demás siguen como antes', () => {
  assert.equal(tapaDeVideo({ tipo: 'panda', embed: PANDA }), null);
  assert.equal(tapaDeVideo(reproductorDeClase(clase(`https://youtu.be/${YT}?si=x`)).video), `https://i.ytimg.com/vi/${YT}/hqdefault.jpg`);
});

test('el reproductor de Panda: mide con lo que publica SU iframe, sin autoplay, y pone los minutos solos', () => {
  const rep = sinComentarios(leer('app/compartido/curso/[token]/Reproductor.tsx'));
  assert.match(rep, /case 'panda':\s*return <VideoPanda /);
  const panda = rep.slice(rep.indexOf('function VideoPanda('), rep.length);
  assert.ok(panda.length > 400 && panda.length < 3000, `VideoPanda mide ${panda.length}`);
  // Sólo los mensajes de ESTE iframe: su ventana Y su origen (un guard de origen se escribe con origin).
  assert.match(panda, /if \(!ref\.current \|\| e\.source !== ref\.current\.contentWindow \|\| e\.origin !== origen\) return;/);
  assert.match(panda, /origen = new URL\(embed\)\.origin;/);
  // Lo medido vive en `lecturaDePanda` (lib/embeds.ts): la duración, los segundos, y el corte manda en el acto.
  assert.match(panda, /const l = lecturaDePanda\(e\.data\);/);
  assert.match(panda, /if \(!dicha\) \{ dicha = true; durRef\.current\?\.\(l\.seg\); \}/, 'los minutos de la clase salen de la duración, sin play');
  assert.match(panda, /if \(l\.tipo === 'avance'\) \{ marcar\(l\.seg, dur\); return; \}/);
  assert.match(panda, /enviar\(\);/);
  assert.match(panda, /const src = srcDePandaParaClase\(embed\);/);
  assert.match(panda, /<iframe ref=\{ref\} src=\{src\}/);
  assert.match(panda, /window\.removeEventListener\('message', alMensaje\); enviar\(\);/, 'al cerrar la clase, lo último sale');
});

test('YouTube que no se deja ver acá: se dice por qué, nombrando a YouTube, con «Ver en YouTube»', () => {
  const rep = sinComentarios(leer('app/compartido/curso/[token]/Reproductor.tsx'));
  const yt = rep.slice(rep.indexOf('function VideoYouTube('), rep.indexOf('function VideoVimeo('));
  assert.match(yt, /onError: \(\{ data \}\) => \{ if \(vivo\) setFallo\(Number\(data\)\); \},/);
  assert.match(yt, /if \(fallo != null\) \{[\s\S]*?motivoDeYouTube\(fallo\)[\s\S]*?Ver en YouTube/);
  const motivo = rep.slice(rep.indexOf('function motivoDeYouTube('), rep.indexOf('function VideoYouTube('));
  assert.match(motivo, /codigo === 101 \|\| codigo === 150/);
  for (const m of motivo.matchAll(/return '([^']+)'/g)) assert.ok(m[1].split(' ').length <= 8, `largo: ${m[1]}`);
});

// ── ROTURAS (08/10/2026, scratchpad video/romper.mjs) ────────────────────────
// Corriendo juntos los tres archivos de la pista (38 tests, 38 / 0 con todo en su lugar). Las que tumban
// tests de ESTE archivo:
//   · Vimeo vuelve a «el primer número del camino» (lib/embeds.ts)   → 36 / 2 (la TABLA)
//   · Drive vuelve a /file/d/ solo                                    → 33 / 5 (la TABLA)
//   · Loom con el título adelante del id                              → 36 / 2 (la TABLA)
//   · una lista de YouTube tomada por un video                        → 36 / 2 (la TABLA)
//   · sin music.youtube.com                                           → 33 / 5 (la TABLA)
//   · un link sin https:// no es un link                              → 32 / 6 (la TABLA)
//   · el panel de Panda no pide el código                             → 36 / 2 («lo que NO es un video»)
//   · Panda sin mirar el origen del mensaje (Reproductor.tsx)         → 37 / 1 (el reproductor de Panda)
//   · Panda con autoplay (sin srcDePandaParaClase)                    → 37 / 1 (el reproductor de Panda)
//   · YouTube sin onError                                             → 37 / 1 (YouTube que no se deja ver)
// Y en Chrome (scratchpad video/banco): un Panda real se reproduce ADENTRO, la duración (101,25 s) llega
// sin play —los minutos de la clase salen solos—, el progreso sale con su duración y, al cerrar, con lo
// último que vio; music.youtube.com, un link sin https:// y el código <iframe> de YouTube abren la IFrame
// API adentro (duración 635 s) y ninguno cae en «afuera».

// =============================================================================
// embeds — lo que se puede INSERTAR (un video, una agenda), desde un link o su código
// =============================================================================
// Ejecuta lib/embeds.ts (`embedDe`, `reconocerUrl`, `atributosDeIframe`, `embedDeIframe`, los altos,
// `lecturaDePanda`, `porQueNoSeInserta`; y desde el 11/10/2026 Fathom y lo que se ve en el Video y el Insertar
// del Dashboard: `videoDe`, `insertableDe`, `videoDirecto`, `miniaturaDe`, `esHostPropio`). Items 14 y 15 del audio del 08/10/2026
// (docs/feedback-curso-08oct.md): «tengo que hacer que funcione con URL y con objetos embed. Con HTML
// embed» (22:40) y «que lo pueda embeber cosas como… el Calendar» (24:30).
//
// Los ataques: `javascript:`, `data:`, un host PARECIDO (`calendly.com.evil.tld`, `evil.com.calendly.com`,
// `calendly.com@evil.tld`, un punto al final, un puerto), `http`, un código con `srcdoc` o con `onload`.
// La regla de la casa es «un guard de ORIGEN se escribe con origin»: acá, hostname EXACTO.
//
// Probado ROMPIÉNDOLO (08/10/2026), una rotura por vez sobre lib/embeds.ts, restaurado desde la copia en
// memoria y verificado por hash (scratchpad video/romper.mjs). Con todo en su lugar: 11 pass / 0 fail en
// este archivo. Cada rotura y lo que tumbó: ver el bloque «ROTURAS» al final del archivo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esCodigoParaInsertar } from '../app/_ui/editor-rico-reglas';
import {
  embedDe, reconocerUrl, atributosDeIframe, embedDeIframe, altoDeEmbed, altoValido, ALTOS_EMBED, lecturaDePanda,
  porQueNoSeInserta, srcDePandaParaClase, direccionDeTexto, nombreDeProveedor, claseDeProveedor, SANDBOX_EMBED, ALLOW_EMBED,
  REFERRER_EMBED, HOSTS_IFRAME, DOMINIOS_IFRAME, PROVEEDORES_EMBED,
  videoDe, insertableDe, videoDirecto, miniaturaDe, esArchivoDeVideo, esHostPropio, conDominio,
} from '../lib/embeds';
import { DOMINIOS_MAKO } from '../lib/email-remitente';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios (las líneas primero, los bloques después: AGENTS.md). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const YT = 'dQw4w9WgXcQ';
const PANDA = 'https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=8d035c87-3767-4b84-8a3d-da41efc6524f';
const LOOM = '0281766fa2d04bb788eaf19e65135184';
/** Un token de Fathom con la forma de los reales (32 letras y números): inventado. */
const FATHOM = 'qGEmdURy3JdNPfo9CseUvfNfjYMGzQ5D';

/** Links y códigos REALES (la forma que copia la persona) → el `src` que se inserta y de quién es. */
const BUENOS: Array<[string, string, string]> = [
  // YouTube: todas las formas del botón «Compartir», la barra del navegador y la app.
  [`https://www.youtube.com/watch?v=${YT}`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`, 'youtube'],
  [`https://youtu.be/${YT}?si=AbCdEf123`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`, 'youtube'],
  [`https://www.youtube.com/shorts/${YT}?si=x`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`, 'youtube'],
  [`https://music.youtube.com/watch?v=${YT}&si=x`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`, 'youtube'],
  [`youtube.com/watch?v=${YT}`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`, 'youtube'],
  // Un código con el `&` escrito como entidad ANTES del id: sin decodificarlo, el `v` no aparece.
  [`<iframe src="https://www.youtube.com/watch?app=desktop&amp;v=${YT}"></iframe>`, `https://www.youtube-nocookie.com/embed/${YT}?rel=0`, 'youtube'],
  [`<iframe width="560" height="315" src="https://www.youtube.com/embed/${YT}?si=Zx" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`,
    `https://www.youtube-nocookie.com/embed/${YT}?rel=0`, 'youtube'],
  // Vimeo, con el hash de uno NO LISTADO, y el código con `&amp;` y su <script> (que no viaja).
  ['https://vimeo.com/76979871', 'https://player.vimeo.com/video/76979871', 'vimeo'],
  ['https://vimeo.com/123456789/abcdef1234?share=copy', 'https://player.vimeo.com/video/123456789?h=abcdef1234', 'vimeo'],
  ['https://vimeo.com/showcase/1234/video/123456789', 'https://player.vimeo.com/video/123456789', 'vimeo'],
  ['<div style="padding:56.25% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/123456789?h=abcdef1234&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="Clase"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>',
    'https://player.vimeo.com/video/123456789?h=abcdef1234', 'vimeo'],
  // Loom, con el título adelante del id (los links nuevos) y su código.
  [`https://www.loom.com/share/${LOOM}?sid=abc`, `https://www.loom.com/embed/${LOOM}`, 'loom'],
  [`https://www.loom.com/share/Mi-clase-${LOOM}`, `https://www.loom.com/embed/${LOOM}`, 'loom'],
  [`<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/${LOOM}?sid=1" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe></div>`, `https://www.loom.com/embed/${LOOM}`, 'loom'],
  // Drive: el de compartir, el de otra cuenta logueada (`/u/0/`) y el viejo de Docs.
  ['https://drive.google.com/file/d/1AbC_dEf-123/view?usp=sharing', 'https://drive.google.com/file/d/1AbC_dEf-123/preview', 'drive'],
  ['https://drive.google.com/file/u/0/d/1AbC_dEf-123/view', 'https://drive.google.com/file/d/1AbC_dEf-123/preview', 'drive'],
  ['https://drive.google.com/open?id=1AbC_dEf-123', 'https://drive.google.com/file/d/1AbC_dEf-123/preview', 'drive'],
  // Panda: el reproductor (los dos dominios) y su código para insertar (el que se pegó en el audio).
  [PANDA, PANDA, 'panda'],
  ['<div style="position:relative;padding-top:56.25%;"><iframe id="panda-8d035c87-3767-4b84-8a3d-da41efc6524f" src="https://player-vz-dd4ad08b-375.tv.pandavideo.com.br/embed/?v=8d035c87-3767-4b84-8a3d-da41efc6524f" style="border:none;position:absolute;top:0;left:0;" allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture" allowfullscreen=true width="720" height="360" fetchpriority="high"></iframe></div>',
    'https://player-vz-dd4ad08b-375.tv.pandavideo.com.br/embed/?v=8d035c87-3767-4b84-8a3d-da41efc6524f', 'panda'],
  // Wistia y Bunny.
  ['https://fast.wistia.net/embed/iframe/e4a27b971d', 'https://fast.wistia.net/embed/iframe/e4a27b971d', 'wistia'],
  ['https://miescuela.wistia.com/medias/e4a27b971d', 'https://fast.wistia.net/embed/iframe/e4a27b971d', 'wistia'],
  ['https://iframe.mediadelivery.net/play/12345/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', 'https://iframe.mediadelivery.net/embed/12345/0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', 'bunny'],
  // Fathom (las llamadas del Closing, 11/10/2026): el link de Compartir (con el `?timestamp=` que trae al
  // copiarlo desde un minuto, y la barra final) y el del reproductor dan el MISMO reproductor.
  [`https://fathom.video/share/${FATHOM}`, `https://fathom.video/embed/${FATHOM}`, 'fathom'],
  [`https://fathom.video/share/${FATHOM}/?timestamp=754.2`, `https://fathom.video/embed/${FATHOM}`, 'fathom'],
  [`https://www.fathom.video/embed/${FATHOM}?autoplay=1`, `https://fathom.video/embed/${FATHOM}`, 'fathom'],
  [`fathom.video/share/${FATHOM}`, `https://fathom.video/embed/${FATHOM}`, 'fathom'],
  // Agendas: el link y el código de cada una.
  ['https://calendly.com/juan-perez/30min', 'https://calendly.com/juan-perez/30min', 'calendly'],
  ['<!-- Calendly inline widget begin --><div class="calendly-inline-widget" data-url="https://calendly.com/juan-perez/30min" style="min-width:320px;height:700px;"></div><script type="text/javascript" src="https://assets.calendly.com/assets/external/widget.js" async></script><!-- Calendly inline widget end -->',
    'https://calendly.com/juan-perez/30min', 'calendly'],
  ['https://cal.com/juan/30min', 'https://cal.com/juan/30min', 'calcom'],
  ['<div style="width:100%;height:100%;overflow:scroll" id="my-cal-inline"></div><script type="text/javascript">Cal("init", "30min", {origin:"https://cal.com"}); Cal.ns["30min"]("inline", { elementOrSelector:"#my-cal-inline", calLink: "juan/30min", layout: "month_view" });</script>',
    'https://cal.com/juan/30min', 'calcom'],
  ['<iframe src="https://calendar.google.com/calendar/appointments/schedules/AcZssZ0abcDEF123_xyz?gv=true" style="border: 0" width="100%" height="600" frameborder="0"></iframe>',
    'https://calendar.google.com/calendar/appointments/schedules/AcZssZ0abcDEF123_xyz?gv=true', 'google'],
  ['https://tidycal.com/juan/30-minutos', 'https://tidycal.com/juan/30-minutos', 'tidycal'],
  ['<div class="tidycal-embed" data-path="juan/30-minutos"></div><script src="https://asset-tidycal.b-cdn.net/js/embed.js" async></script>', 'https://tidycal.com/juan/30-minutos', 'tidycal'],
  ['<div class="meetings-iframe-container" data-src="https://meetings.hubspot.com/juan?embed=true"></div><script type="text/javascript" src="https://static.hsappstatic.net/MeetingsEmbed/ex/MeetingsEmbedCode.js"></script>',
    'https://meetings.hubspot.com/juan?embed=true', 'hubspot'],
];

/** Lo que NUNCA se inserta: ataques y parecidos. */
const MALOS: string[] = [
  'javascript:alert(1)',
  ' JAVASCRIPT:alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  // Hosts PARECIDOS: el host real es otro, o es un subdominio que no es el servicio.
  'https://calendly.com.evil.tld/juan/30min',
  'https://evil.com.calendly.com/juan/30min',
  'https://calendly.com@evil.tld/juan/30min',
  'https://juan:clave@calendly.com/juan/30min',
  'https://calendly.com:8443/juan/30min',
  'https://calendly.com./juan/30min',
  'https://evilcalendly.com/juan',
  '//calendly.com/juan/30min',
  `https://www.youtube.com.evil.tld/watch?v=${YT}`,
  `https://youtube.com@evil.tld/watch?v=${YT}`,
  'https://player-vz-dd4ad08b-375.tv.pandavideo.com.evil.tld/embed/?v=8d035c87-3767-4b84-8a3d-da41efc6524f',
  'https://xplayer-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=8d035c87-3767-4b84-8a3d-da41efc6524f',
  'https://meetings.hubspot.com.evil.tld/juan',
  'https://evilmeetings.hubspot.com/juan',
  // http: lo que se inserta en un texto es https, siempre.
  'http://calendly.com/juan/30min',
  '<iframe src="http://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>',
  // Un id que podría cambiar el camino, o lo que no es un video ni una agenda.
  'https://www.youtube.com/watch?v=abc/../../x',
  'https://www.youtube.com/embed/videoseries?list=PLx1',
  'https://www.youtube.com/playlist?list=PLx1',
  'https://calendly.com/juan%2F..%2Fapp',
  'https://drive.google.com/drive/folders/1AbC',
  'https://calendar.app.google/abc123XYZ',
  'https://dashboard.pandavideo.com.br/#/videos/8d035c87-3767-4b84-8a3d-da41efc6524f',
  'https://player-vz-dd4ad08b-375.tv.pandavideo.com/embed/?v=no-es-un-uuid',
  // Un código con manejadores y sin un src de la lista.
  '<iframe src="https://evil.tld/x" onload="alert(1)"></iframe>',
  '<img src=x onerror=alert(1)>',
  '<div data-url="javascript:alert(1)"></div>',
  'https://evil.tld/calendly.com/juan',
  '',
  'no es un link',
  // Fathom: parecidos, http, la grabación ADENTRO de la cuenta (no se ve sin entrar), su miniatura y un
  // token que cambiaría el camino.
  `https://fathom.video.evil.tld/share/${FATHOM}`,
  `https://evilfathom.video/share/${FATHOM}`,
  `https://fathom.video@evil.tld/share/${FATHOM}`,
  `http://fathom.video/share/${FATHOM}`,
  'https://fathom.video/calls/829932619',
  `https://fathom.video/share/${FATHOM}/thumbnail`,
  'https://fathom.video/share/abc%2F..%2Fx',
  'https://fathom.video/share/',
];

test('cada link y código REAL da el reproductor o la agenda de su proveedor, con el src armado acá', () => {
  for (const [entra, src, proveedor] of BUENOS) {
    const e = embedDe(entra);
    assert.ok(e, `no se insertó: ${entra.slice(0, 90)}`);
    assert.equal(e.src, src, entra.slice(0, 90));
    assert.equal(e.proveedor, proveedor, entra.slice(0, 90));
  }
});

test('ningún ataque ni host parecido se inserta', () => {
  const pasaron = MALOS.filter((m) => embedDe(m) != null);
  assert.deepEqual(pasaron, []);
  // Y con usuario, clave o puerto, la PRIMERA capa (la de cualquier dirección) ya dice que no.
  for (const u of ['https://calendly.com@evil.tld/x', 'https://a:b@calendly.com/x', 'https://calendly.com:444/x']) assert.equal(reconocerUrl(new URL(u)), null, u);
});

test('el src que sale es estable: volver a pasarlo da el mismo (lo que compara el saneo)', () => {
  for (const [entra] of BUENOS) {
    const e = embedDe(entra)!;
    const otra = embedDe(e.src);
    assert.ok(otra, `el src armado no se reconoce: ${e.src}`);
    assert.equal(otra.src, e.src);
    assert.equal(otra.proveedor, e.proveedor);
  }
});

test('un video no lleva alto; una agenda sí, de la lista (el de su código, o el de su proveedor)', () => {
  for (const [entra, , proveedor] of BUENOS) {
    const e = embedDe(entra)!;
    if (claseDeProveedor(proveedor) === 'video') assert.equal(e.alto, undefined, entra.slice(0, 60));
    else assert.ok(e.alto != null && ALTOS_EMBED.includes(e.alto), `${proveedor}: alto ${e.alto}`);
  }
  assert.equal(embedDe(BUENOS.find(([e]) => e.includes('calendly-inline-widget'))![0])!.alto, 700, 'el height:700px del código de Calendly');
  assert.equal(embedDe(BUENOS.find(([e]) => e.includes('calendar.google.com'))![0])!.alto, 600, 'el height="600" del código de Google');
  assert.equal(embedDe(BUENOS.find(([e]) => e.includes('calLink'))![0])!.alto, 700, 'un height:100% no es un alto: va el de Cal.com');
  assert.equal(embedDe('<iframe src="https://calendly.com/juan/30min" width="100%" height="100%"></iframe>')!.alto, 700, 'un height="100%" no es un alto');
  assert.equal(embedDe('<iframe src="https://calendly.com/juan/30min" height="2000"></iframe>')!.alto, 1200, 'un alto de más se acota');
  assert.equal(embedDe('<iframe src="https://calendly.com/juan/30min" height="40"></iframe>')!.alto, 300, 'uno de menos, también');
});

test('los altos: una lista cerrada, comparada como TEXTO exacto', () => {
  assert.equal(ALTOS_EMBED[0], 300);
  assert.equal(ALTOS_EMBED[ALTOS_EMBED.length - 1], 1200);
  assert.equal(ALTOS_EMBED.length, 19);
  for (const n of ALTOS_EMBED) { assert.equal(altoDeEmbed(String(n)), n); assert.equal(altoDeEmbed(n), n); }
  for (const malo of ['0700', '725', '1250', '250', '700px', ' 700', '700 ', '7e2', '-700', '', null, undefined, 700.5]) assert.equal(altoDeEmbed(malo), null, `«${String(malo)}»`);
  assert.equal(altoValido(712), 700);
  assert.equal(altoValido(Number.NaN), 300);
});

test('los atributos del iframe: en orden, fijos, y ninguno libre', () => {
  const v = atributosDeIframe(embedDe(`https://youtu.be/${YT}`)!);
  assert.deepEqual(v, [
    ['src', `https://www.youtube-nocookie.com/embed/${YT}?rel=0`], ['title', 'YouTube'], ['data-proveedor', 'youtube'],
    ['sandbox', SANDBOX_EMBED], ['allow', ALLOW_EMBED], ['loading', 'lazy'], ['referrerpolicy', REFERRER_EMBED],
  ]);
  const a = atributosDeIframe(embedDe('https://calendly.com/juan/30min')!);
  assert.deepEqual(a.map(([n]) => n), ['src', 'title', 'data-proveedor', 'data-alto', 'sandbox', 'allow', 'loading', 'referrerpolicy']);
  assert.equal(a.find(([n]) => n === 'data-alto')![1], '700');
  // El sandbox no deja navegar la pestaña de arriba; los permisos no piden cámara, micrófono ni ubicación.
  assert.doesNotMatch(SANDBOX_EMBED, /allow-top-navigation|allow-modals|allow-downloads/);
  assert.doesNotMatch(ALLOW_EMBED, /camera|microphone|geolocation|payment|usb/);
  assert.equal(REFERRER_EMBED, 'strict-origin-when-cross-origin', 'YouTube exige el Referer (error 153 sin él)');
  // Un iframe pegado: el alto de una agenda sale de `data-alto` o de su `height`.
  assert.equal(embedDeIframe({ src: 'https://calendly.com/juan/30min', 'data-alto': '900' })!.alto, 900);
  assert.equal(embedDeIframe({ src: 'https://calendly.com/juan/30min', height: '820' })!.alto, 800);
  assert.equal(embedDeIframe({ src: 'https://calendly.com/juan/30min', 'data-alto': '901', height: 'x' })!.alto, 700);
  assert.equal(embedDeIframe({ src: `https://youtu.be/${YT}`, 'data-alto': '900' })!.alto, undefined, 'un video no lleva alto');
  assert.equal(embedDeIframe({ src: 'https://evil.tld/x' }), null);
});

test('la segunda capa (los hosts del saneo) cubre TODOS los src que arma la primera', () => {
  for (const [entra] of BUENOS) {
    const host = new URL(embedDe(entra)!.src).hostname;
    const ok = HOSTS_IFRAME.includes(host) || DOMINIOS_IFRAME.some((d) => host === d || host.endsWith(`.${d}`));
    assert.ok(ok, `el saneo tiraría ${host}`);
  }
  // Ningún host nuestro: con `allow-scripts allow-same-origin`, un iframe de nuestro origen se sacaría el sandbox.
  for (const h of [...HOSTS_IFRAME, ...DOMINIOS_IFRAME]) assert.doesNotMatch(h, /hola-mako|vercel\.app|localhost/);
  for (const p of Object.keys(PROVEEDORES_EMBED)) assert.ok(nombreDeProveedor(p), p);
});

test('la dirección de un texto: link, link sin https, o la que trae un código; nada más', () => {
  assert.equal(direccionDeTexto('  https://calendly.com/x  '), 'https://calendly.com/x');
  assert.equal(direccionDeTexto('calendly.com/x'), 'https://calendly.com/x');
  assert.equal(direccionDeTexto('https://calendly.com/x y algo más'), null);
  assert.equal(direccionDeTexto('<p>hola</p>'), null, 'un HTML sin iframe ni data-url no trae un link');
  assert.equal(direccionDeTexto('a'.repeat(6000)), null);
  assert.equal(direccionDeTexto(null), null);
  // De un código se saca SÓLO una dirección: el resto (estilos, scripts, manejadores) no viaja.
  assert.equal(direccionDeTexto('<iframe onload="alert(1)" style="position:fixed" src=\'https://calendly.com/x\'></iframe>'), 'https://calendly.com/x');
});

test('por qué no: una frase corta, y la que pide el código cuando el link no alcanza', () => {
  assert.equal(porQueNoSeInserta(''), 'Pega un link o un código.');
  assert.equal(porQueNoSeInserta('http://calendly.com/x'), 'El link tiene que ser https.');
  assert.equal(porQueNoSeInserta('https://dashboard.pandavideo.com.br/#/videos/8d035c87-3767-4b84-8a3d-da41efc6524f'), 'De Panda Video, pega su código para insertar.');
  assert.equal(porQueNoSeInserta('https://calendar.app.google/abc123XYZ'), 'De Google Calendar, pega su código para insertar.');
  assert.equal(porQueNoSeInserta('https://evil.tld/x'), 'Ese sitio no se puede insertar.');
  assert.equal(porQueNoSeInserta('<p>hola</p>'), 'Ese código no trae un link.');
  assert.equal(porQueNoSeInserta('javascript:alert(1)'), 'Ese link no es válido.');
  assert.equal(porQueNoSeInserta('https://www.youtube.com/playlist?list=PLx1'), 'Ese link de YouTube no es un video.');
  assert.equal(porQueNoSeInserta('https://calendly.com/a/b/c/d'), 'Ese link de Calendly no es una agenda.');
  for (const m of MALOS) assert.ok(porQueNoSeInserta(m).split(' ').length <= 9, `largo: ${porQueNoSeInserta(m)}`);
});

test('Panda: los mensajes MEDIDOS de su reproductor, y la vista previa muda no cuenta', () => {
  // Las formas exactas que publicó el reproductor real (scratchpad video/panda-probe*.mjs, 08/10/2026).
  const v = '8d035c87-3767-4b84-8a3d-da41efc6524f';
  assert.equal(lecturaDePanda({ message: 'panda_allData', video: v, playerData: { paused: true, currentTime: 0, duration: 0 } }), null, 'duración 0 = todavía no la sabe');
  assert.deepEqual(lecturaDePanda({ message: 'panda_allData', video: v, playerData: { duration: 101.25 } }), { tipo: 'duracion', seg: 101.25 });
  assert.deepEqual(lecturaDePanda({ message: 'panda_timeupdate', video: v, currentTime: 10.849783, isMutedIndicator: false, isPreviousProgressLoaded: true }), { tipo: 'avance', seg: 10.849783 });
  assert.equal(lecturaDePanda({ message: 'panda_timeupdate', video: v, currentTime: 0.195344, isMutedIndicator: true, isPreviousProgressLoaded: true }), null, 'la vista previa muda que arranca sola no es alguien mirando');
  assert.deepEqual(lecturaDePanda({ message: 'panda_pause', currentTime: 42, isMutedIndicator: false }), { tipo: 'corte', seg: 42 });
  assert.deepEqual(lecturaDePanda({ message: 'panda_ended', currentTime: 101, isMutedIndicator: true }), { tipo: 'corte', seg: null });
  assert.deepEqual(lecturaDePanda(JSON.stringify({ message: 'panda_timeupdate', currentTime: 3 })), { tipo: 'avance', seg: 3 }, 'algunos reproductores mandan el JSON como texto');
  for (const otro of [{ type: 'PANDA_READY' }, { message: 'panda_ready', currentTime: 0 }, { message: 'panda_timeupdate', currentTime: -1 }, { message: 'panda_timeupdate', currentTime: 'x' }, null, 'hola', 42]) {
    assert.equal(lecturaDePanda(otro), null, JSON.stringify(otro));
  }
  // La clase no arranca sola (medido: con el parámetro, ningún play hasta el clic).
  assert.equal(srcDePandaParaClase(PANDA), `${PANDA}&autoplay=false`);
});

test('el editor: «Insertar» escribe el MISMO iframe que el saneo, y pegar sólo un código lo inserta', () => {
  // Pura: cuándo un pegado es un código (y no un párrafo que menciona uno).
  assert.equal(esCodigoParaInsertar(BUENOS.find(([e]) => e.startsWith('<iframe width'))![0]), true);
  assert.equal(esCodigoParaInsertar(BUENOS.find(([e]) => e.includes('calendly-inline-widget'))![0]), true);
  assert.equal(esCodigoParaInsertar('Para insertar, pega un <iframe src="x"> en la clase.'), false, 'un párrafo que menciona un iframe es texto');
  assert.equal(esCodigoParaInsertar('<p>hola</p>'), false);
  assert.equal(esCodigoParaInsertar(`https://youtu.be/${YT}`), false, 'un link pegado sigue siendo un link (el autolink)');
  // El editor: los atributos del nodo se LEEN con la regla del saneo (sin su `parseHTML`, TipTap pisaría
  // el `src` rearmado con el crudo) y el iframe se escribe con `atributosDeIframe`, completo.
  const ed = sinComentarios(leer('app/_ui/EditorRico.tsx'));
  const nodo = ed.slice(ed.indexOf('const Insertado = NodoTiptap.create({'), ed.indexOf('const AtajosMako ='));
  assert.ok(nodo.length > 800 && nodo.length < 4000, `el nodo mide ${nodo.length}`);
  for (const a of ['src', 'proveedor', 'alto']) {
    assert.match(nodo, new RegExp(`${a}: \\{ default: null, parseHTML: \\(el: HTMLElement\\) => leerIframe\\(el\\)\\?\\.${a} \\?\\? null, renderHTML: \\(\\) => \\(\\{\\}\\) \\}`), a);
  }
  assert.match(nodo, /\{ tag: 'iframe\[src\]', getAttrs: \(el\) => \(leerIframe\(el as HTMLElement\) \? null : false\) \}/);
  assert.match(nodo, /return e \? \['iframe', Object\.fromEntries\(atributosDeIframe\(e\)\)\] : \['p'\];/);
  assert.match(ed, /embedDeIframe\(\{ src: el\.getAttribute\('src'\), 'data-alto': el\.getAttribute\('data-alto'\), height: el\.getAttribute\('height'\) \}\)/);
  // El botón (con su punto del recorrido), el panel y el pegado.
  assert.match(ed, /\{ tipo: 'boton', id: 'insertar', nombre: 'Insertar video o agenda', icono: I\.insertar, abre: true, recorrido: 'editor-insertar', accion: \(el\) => alternarPanel\('insertar', el\) \}/);
  assert.match(ed, /if \(!e\) \{ setError\(porQueNoSeInserta\(texto\)\); return; \}/);
  assert.match(ed, /if \(!files\.length && esCodigoParaInsertar\(plano\)\) \{\s*const e = embedDe\(plano\);\s*if \(e\) \{ insertarEmbedRef\.current\(e\); return true; \}/);
  // En el editor el iframe no se lleva el clic hasta que el bloque está elegido.
  assert.match(ed, /\.mk-editor-rico \.ProseMirror \.mk-er-insertado > iframe \{ margin: 0; pointer-events: none; \}/);
  assert.match(ed, /\.mk-editor-rico \.ProseMirror \.mk-er-insertado\.ProseMirror-selectednode > iframe \{ pointer-events: auto; \}/);
});

// ── Los elementos del Dashboard: Video e Insertar (11/10/2026) ───────────────
// Decisión 6 de Martín: «Closing Analyst va COMPLETO al Dashboard, sumando los elementos Enlace, Video e
// Insertar». Lo que se ve en cada uno lo decide este módulo; la pantalla (app/dashboard/ElementoInsertado.tsx)
// no reconoce un host ni arma un `src`.

const errorDe = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error);

test('Fathom: el link de la grabación pide el de Compartir; el reproductor es fathom.video/embed y entra a la segunda capa', () => {
  for (const calls of ['https://fathom.video/calls/829932619', 'https://app.fathom.video/calls/99', `https://fathom.video/share/${FATHOM}/thumbnail`]) {
    assert.equal(embedDe(calls), null, calls);
    assert.equal(porQueNoSeInserta(calls), 'Usa el link de Compartir de Fathom.', calls);
  }
  assert.ok(HOSTS_IFRAME.includes('fathom.video'), 'sin el host, el saneo de una clase tiraría el reproductor de Fathom');
  const a = atributosDeIframe(embedDe(`https://fathom.video/share/${FATHOM}`)!);
  assert.deepEqual(a.slice(0, 3), [['src', `https://fathom.video/embed/${FATHOM}`], ['title', 'Fathom'], ['data-proveedor', 'fathom']]);
  assert.ok(!a.some(([n]) => n === 'data-alto'), 'un video no lleva alto');
  assert.equal(claseDeProveedor('fathom'), 'video');
});

test('el Video: un proveedor de VIDEO de la lista, un archivo directo o Fathom (miniatura y clic); nada más', () => {
  const yt = videoDe(`https://www.youtube.com/watch?v=${YT}&t=42`);
  assert.ok(yt.ok);
  assert.deepEqual(yt.valor, {
    direccion: `https://www.youtube.com/watch?v=${YT}&t=42`, modo: 'iframe', src: `https://www.youtube-nocookie.com/embed/${YT}?rel=0`, proveedor: 'youtube',
    nombre: 'YouTube', link: `https://www.youtube.com/watch?v=${YT}&t=42`, miniatura: `https://i.ytimg.com/vi/${YT}/hqdefault.jpg`, alClic: false,
  });
  // Fathom: la miniatura y un clic; el «Abrir ↗» va al link de Compartir, sin el minuto ni el reproductor suelto.
  for (const entra of [`https://fathom.video/share/${FATHOM}?timestamp=754.2`, `https://fathom.video/embed/${FATHOM}`]) {
    const f = videoDe(entra);
    assert.ok(f.ok, entra);
    assert.equal(f.valor.src, `https://fathom.video/embed/${FATHOM}`);
    assert.equal(f.valor.link, `https://fathom.video/share/${FATHOM}`);
    assert.equal(f.valor.miniatura, `https://fathom.video/share/${FATHOM}/thumbnail`);
    assert.equal(f.valor.alClic, true);
  }
  const mp4 = videoDe('https://cdn.ejemplo.com/clases/uno.MP4?v=2');
  assert.ok(mp4.ok);
  assert.deepEqual([mp4.valor.modo, mp4.valor.src, mp4.valor.proveedor, mp4.valor.miniatura], ['directo', 'https://cdn.ejemplo.com/clases/uno.MP4?v=2', null, null]);
  // Del CÓDIGO que se pegó se guarda la dirección, nunca el código.
  const codigo = videoDe(BUENOS.find(([e]) => e.startsWith('<iframe width'))![0]);
  assert.ok(codigo.ok);
  assert.doesNotMatch(codigo.valor.direccion, /[<>"\s]/);
  assert.equal(codigo.valor.proveedor, 'youtube');

  const NO: Array<[string, string]> = [
    ['', 'Pega el link del video.'],
    [`http://www.youtube.com/watch?v=${YT}`, 'El link tiene que ser https.'],
    ['https://calendly.com/juan/30min', 'Es una agenda: usa Insertar.'],
    ['https://ejemplo.com/pagina', 'Ese link no es de un video. Usa Insertar.'],
    ['https://fathom.video/calls/829932619', 'Usa el link de Compartir de Fathom.'],
    ['https://dashboard.pandavideo.com.br/#/videos/8d035c87-3767-4b84-8a3d-da41efc6524f', 'De Panda Video, pega su código para insertar.'],
    ['https://www.youtube.com/playlist?list=PLx1', 'Ese link de YouTube no es un video.'],
    ['javascript:alert(1)', 'Ese link no es válido.'],
    [`https://juan:clave@www.youtube.com/watch?v=${YT}`, 'Ese link no es válido.'],
    [`https://www.youtube.com:8443/watch?v=${YT}`, 'Ese link no es válido.'],
    ['https://localhost/a.mp4', 'Ese link no es válido.'],
    ['https://192.168.0.10/a.mp4', 'Ese link no es válido.'],
    ['<p>hola</p>', 'Ese código no trae un link.'],
    [`https://ejemplo.com/${'a'.repeat(2100)}.mp4`, 'Ese link es demasiado largo.'],
  ];
  for (const [entra, frase] of NO) {
    assert.equal(errorDe(videoDe(entra)), frase, entra.slice(0, 80));
    assert.ok(frase.split(' ').length <= 9, `largo: ${frase}`);
  }
});

test('Insertar: CUALQUIER https (como Looker); lo de la lista pasa por ella; nunca MaKo; un código nunca se guarda', () => {
  // El código que da Looker Studio: se guarda SÓLO su `src`, y va tal cual (no es de la lista).
  const looker = '<iframe width="600" height="450" src="https://lookerstudio.google.com/embed/reporting/0a1b/page/p_xyz" frameborder="0" style="border:0" allowfullscreen sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"></iframe><script>alert(1)</script>';
  const l = insertableDe(looker);
  assert.ok(l.ok);
  assert.deepEqual(l.valor, {
    direccion: 'https://lookerstudio.google.com/embed/reporting/0a1b/page/p_xyz', src: 'https://lookerstudio.google.com/embed/reporting/0a1b/page/p_xyz',
    proveedor: null, nombre: 'lookerstudio.google.com',
  });
  // Lo de la lista: el `src` lo arma lib/embeds.ts, y se guarda la dirección que se pegó.
  const yt = insertableDe(`https://youtu.be/${YT}`);
  assert.ok(yt.ok);
  assert.deepEqual([yt.valor.src, yt.valor.proveedor, yt.valor.nombre, yt.valor.direccion], [`https://www.youtube-nocookie.com/embed/${YT}?rel=0`, 'youtube', 'YouTube', `https://youtu.be/${YT}`]);
  const cal = insertableDe(BUENOS.find(([e]) => e.includes('calendly-inline-widget'))![0]);
  assert.ok(cal.ok);
  assert.deepEqual([cal.valor.src, cal.valor.direccion], ['https://calendly.com/juan-perez/30min', 'https://calendly.com/juan-perez/30min']);
  const www = insertableDe('https://www.typeform.com/to/abc');
  assert.ok(www.ok && www.valor.nombre === 'typeform.com');
  // Lo que se guarda vuelve a dar lo mismo (es lo que la pantalla relee en cada dibujo).
  for (const r of [l, yt, cal, www]) {
    assert.ok(r.ok);
    const otra = insertableDe(r.valor.direccion);
    assert.deepEqual(otra, r);
  }

  const NO: Array<[string, string | null, string]> = [
    ['https://hola-mako.com/crm', null, 'Para una pantalla de MaKo usa Enlace.'],
    ['https://www.hola-mako.com/dashboard?hoja=closing', null, 'Para una pantalla de MaKo usa Enlace.'],
    ['https://app.hola-mako.com/x', null, 'Para una pantalla de MaKo usa Enlace.'],
    ['https://makodigital.app/crm', null, 'Para una pantalla de MaKo usa Enlace.'],
    // El host de ESTA pestaña (un deploy de prueba) también es MaKo.
    ['https://dashboard-marketing-abc123.vercel.app/crm', 'dashboard-marketing-abc123.vercel.app', 'Para una pantalla de MaKo usa Enlace.'],
    ['https://hola-mako.com.evil.tld/x', null, ''],
    ['javascript:alert(1)', null, 'Ese link no es válido.'],
    ['data:text/html,<script>alert(1)</script>', null, 'Ese código no trae un link.'],
    ['//ejemplo.com/x', null, 'Ese link no es válido.'],
    ['http://ejemplo.com/x', null, 'El link tiene que ser https.'],
    ['https://juan:clave@ejemplo.com/x', null, 'Ese link no es válido.'],
    ['https://ejemplo.com:8443/x', null, 'Ese link no es válido.'],
    ['https://192.168.0.1/admin', null, 'Ese link no es válido.'],
    ['https://localhost/x', null, 'Ese link no es válido.'],
    ['<iframe srcdoc="<script>alert(1)</script>"></iframe>', null, 'Ese código no trae un link.'],
    ['https://www.youtube.com/playlist?list=PLx1', null, 'Ese link de YouTube no es un video.'],
    ['https://fathom.video/calls/829932619', null, 'Usa el link de Compartir de Fathom.'],
    ['https://calendar.app.google/abc123XYZ', null, 'De Google Calendar, pega su código para insertar.'],
    ['', null, 'Pega un link o un código.'],
  ];
  for (const [entra, propio, frase] of NO) {
    const r = insertableDe(entra, propio);
    // '' en la tabla = SÍ entra (un host PARECIDO a MaKo no es MaKo: es otro sitio, con su sandbox).
    if (!frase) { assert.ok(r.ok, entra); continue; }
    assert.equal(errorDe(r), frase, entra.slice(0, 80));
    assert.ok(frase.split(' ').length <= 9, `largo: ${frase}`);
  }
  // Sin decirle el host de la pestaña, el deploy de prueba es un sitio más (lo frena la pantalla, que sí lo sabe).
  assert.ok(insertableDe('https://dashboard-marketing-abc123.vercel.app/crm').ok);
});

test('el video directo, la miniatura y nuestros hosts', () => {
  for (const ok of ['https://x.com/a.webm', 'https://x.com/b/c.m4v', 'https://x.com/d.MOV', 'https://x.com/e.mp4?token=1#t=10']) assert.ok(videoDirecto(ok), ok);
  for (const no of ['https://x.com/a.mp4.html', 'http://x.com/a.mp4', 'https://x.com/a.mkv', 'javascript:a.mp4', '', null]) assert.equal(videoDirecto(no), null, String(no));
  assert.equal(esArchivoDeVideo('/clases/uno.mp4'), true);
  assert.equal(esArchivoDeVideo('/clases/uno.mp4/'), false);

  assert.equal(miniaturaDe(`https://youtu.be/${YT}`), `https://i.ytimg.com/vi/${YT}/hqdefault.jpg`);
  assert.equal(miniaturaDe(`https://fathom.video/share/${FATHOM}`), `https://fathom.video/share/${FATHOM}/thumbnail`);
  for (const sin of ['https://vimeo.com/76979871', 'https://calendly.com/juan/30min', `http://youtu.be/${YT}`, 'https://fathom.video/calls/1', '']) assert.equal(miniaturaDe(sin), null, sin);

  for (const h of ['hola-mako.com', 'www.hola-mako.com', 'send.hola-mako.com', 'HOLA-MAKO.COM', 'hola-mako.com.', 'makodigital.app']) assert.equal(esHostPropio(h), true, h);
  for (const h of ['hola-mako.com.evil.tld', 'evilhola-mako.com', 'mako.com', '']) assert.equal(esHostPropio(h), false, h);
  assert.equal(esHostPropio('preview.vercel.app', 'preview.vercel.app'), true, 'el host de esta pestaña');
  // Los dominios de MaKo son UNA lista: la de lib/email-remitente.ts.
  for (const d of DOMINIOS_MAKO) assert.equal(esHostPropio(d), true, d);
  for (const h of ['ejemplo.com', 'a.b.co', 'xn--mxico-bsa.mx']) assert.equal(conDominio(h), true, h);
  for (const h of ['localhost', '127.0.0.1', '[::1]', 'ejemplo.', 'ejemplo.1', '.ejemplo.com']) assert.equal(conDominio(h), false, h);
});

// ── ROTURAS (08/10/2026, scratchpad video/romper.mjs) ────────────────────────
// Una por vez, restaurada de memoria (hash verificado), corriendo JUNTOS los tres archivos de la pista
// (este, tests/curso-video-embed.test.ts y tests/html-seguro.test.ts): 38 tests, 38 / 0 con todo en su lugar.
//   · el host de Calendly con endsWith en vez de exacto                 → 35 / 3 (ningún ataque… · ningún ataque clásico… · lo insertado…)
//   · reconocerUrl sin mirar usuario, clave y puerto                    → 35 / 3 (los mismos)
//   · embedDe acepta http                                               → 35 / 3 (los mismos)
//   · el id sin su juego de caracteres                                  → 34 / 4 (y «el saneo es IDEMPOTENTE»)
//   · Panda con includes(pandavideo) en vez de la expresión anclada     → 37 / 1 (ningún ataque…)
//   · el código sin decodificar &amp;                                    → 34 / 4 (cada link real…, estable, alto, segunda capa)
//     (la primera corrida dio 38 / 0: con el v de Vimeo PRIMERO, el &amp; no molestaba. Se sumó el
//     código con el id DESPUÉS de un &amp; — ver «cada link real» — y recién ahí cayó.)
//   · Vimeo vuelve a «el primer número del camino»                      → 36 / 2 (la TABLA · cada link real…)
//   · Drive vuelve a /file/d/ solo                                      → 33 / 5
//   · un height de 100% cuenta como alto                                → 37 / 1 (un video no lleva alto…) — también 38 / 0
//     la primera vez: el 100% del código de Cal.com está en un style, no en un height=. Se sumó el caso.
//   · Panda cuenta la vista previa muda (isMutedIndicator)              → 37 / 1 (Panda…)
//   · el sandbox antes del title en atributosDeIframe                   → 34 / 4 (los atributos…, y tres de html-seguro)
//   · allow-top-navigation en el sandbox                                → 34 / 4 (los mismos)
//   · el panel de Panda no pide el código                               → 36 / 2
//   · Loom con el título adelante del id                                → 36 / 2
//   · una lista de YouTube (videoseries) tomada por un video            → 36 / 2
//   · sin music.youtube.com                                             → 33 / 5
//   · un link sin https:// no es un link                                → 32 / 6
//   · el editor: el src del nodo sin su parseHTML (TipTap lo pisa)      → 37 / 1 (el editor…)
//   · el editor: pegar un código no lo inserta                          → 37 / 1 (el editor…)
//   · esCodigoParaInsertar sin exigir que empiece con < y termine con > → 37 / 1 (el editor…)
//
// ── ROTURAS (11/10/2026: Fathom, el Video y el Insertar del Dashboard) ───────
// Base de este archivo solo: 15 / 0. Arnés del paquete P1 (scratchpad p1/romper.mjs), una rotura por vez
// sobre lib/embeds.ts, restaurada DE MEMORIA (nunca con git) y verificada por hash. Al final, 15 / 0.
//   · el host de Fathom con endsWith en vez de exacto                    → 14 / 1 (ningún ataque…)
//   · el token de Fathom sin su juego de caracteres                      → 14 / 1 (ningún ataque…)
//   · Fathom armando el src con /share/ (no entra en un iframe)          → 12 / 3 (cada link real · Fathom · el Video)
//   · Fathom sin su `pista` (el link de la grabación)                    → 12 / 3 (Fathom · el Video · Insertar)
//   · fathom.video fuera de HOSTS_IFRAME                                 → 13 / 2 (la segunda capa · Fathom)
//   · una dirección con puerto aceptada                                  → 13 / 2 (el Video · Insertar)
//   · Insertar sin mirar nuestro host                                    → 14 / 1 (Insertar)
//   · esHostPropio sin el host de la pestaña                             → 13 / 2 (Insertar · los hosts)
//   · el Video aceptando una agenda                                      → 14 / 1 (el Video)
//   · Insertar guardando lo que se pegó (el código) en vez de la dirección → 14 / 1 (Insertar)
//   · Fathom sin miniatura                                               → 13 / 2 (el Video · la miniatura y los hosts)
//   · conDominio aceptando una IP (el TLD con números)                   → 12 / 3 (el Video · Insertar · los hosts)
//   · el «Abrir ↗» de Fathom al link que se pegó (con el minuto)         → 14 / 1 (el Video)

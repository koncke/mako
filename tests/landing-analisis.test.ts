// =============================================================================
// El analizador: qué tiene ESTA landing, para no pedirle lo que no tiene
// =============================================================================
// Hasta ahora los pasos de la prueba se adivinaban por los eventos que habían
// llegado — o sea, DESPUÉS de probar, que es cuando ya no sirve. Un paso que en
// esa página no se puede cumplir se queda en rojo para siempre y entrena a
// ignorar la lista entera.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DETECTORES_VERSION,
  HOSTS_VIDEO,
  analizarHtml,
  analizarLanding,
  esPiezaDeVideo,
  estadoVideo,
  hostDeVideoId,
  tieneVideoMedible,
  videosDeHtml,
  videosNoMedibles,
} from '../lib/landing-analisis';
import { ALIAS_VIDEO_ID } from '../lib/video-id';

const A = (html: string) => analizarHtml('https://x.com', html);

test('detecta los SEIS hosts de video, y sabe cuáles puede medir', () => {
  assert.ok(A('<video controls src="a.mp4"></video>').piezas.has('video-nativo'));
  assert.ok(A('<iframe src="https://player-vz-1.tv.pandavideo.com.br/embed/?v=x"></iframe>').piezas.has('video-panda'));
  assert.ok(A('<iframe src="https://www.youtube.com/embed/abc"></iframe>').piezas.has('video-youtube'));
  assert.ok(A('<iframe src="https://player.vimeo.com/video/1"></iframe>').piezas.has('video-vimeo'));
  // Wistia, en sus dos formas: el player nuevo es una etiqueta propia y el embed
  // clásico es un div con su clase, o un iframe.
  assert.ok(A('<wistia-player media-id="y4reukhgq8"></wistia-player>').piezas.has('video-wistia'));
  assert.ok(A('<div class="wistia_embed wistia_async_y4reukhgq8"></div>').piezas.has('video-wistia'));
  assert.ok(A('<iframe src="https://fast.wistia.net/embed/iframe/y4reukhgq8"></iframe>').piezas.has('video-wistia'));
  assert.ok(A('<iframe src="https://drive.google.com/file/d/1Yf516z3y_5CVurkydHkq/preview"></iframe>').piezas.has('video-drive'));

  // ⚠️ QUÉ SE PUEDE MEDIR CAMBIÓ EN LA v16, y está medido en un navegador de
  // verdad (11/09/2026), no leído en documentación. Este test decía «solo dos se
  // pueden medir» y con eso el panel le decía a un cliente con su VSL en YouTube
  // que lo subiera a otro lado.
  for (const html of [
    '<video></video>',
    '<iframe src="pandavideo.com/x"></iframe>',
    '<wistia-player media-id="abc123"></wistia-player>',
    '<iframe src="https://www.youtube.com/embed/x"></iframe>',
    '<iframe src="https://player.vimeo.com/video/1"></iframe>',
  ]) {
    assert.ok(tieneVideoMedible(A(html).piezas), `tendría que medirse: ${html}`);
  }

  // ⚠️ Y EL QUE NO SE PUEDE MEDIR HAY QUE DECIRLO. Drive no le manda NADA a la
  // página: con un video reproduciendo, cero mensajes. Su reproductor real es un
  // iframe anidado que solo le habla a Drive (control positivo en la misma
  // página: un YouTube con la API prendida contestó 31 mensajes).
  const drive = A('<iframe src="https://drive.google.com/file/d/1Yf516z3y_5CVurkydHkq/preview"></iframe>');
  assert.ok(!tieneVideoMedible(drive.piezas), 'un Drive no se puede medir');
  assert.deepEqual(videosNoMedibles(drive.piezas), ['un video de Google Drive']);
  assert.deepEqual(videosNoMedibles(A('<video></video>').piezas), [], 'un video medible no se anuncia como problema');

  // Los tres estados que el panel necesita distinguir. El tercero es el que
  // faltaba: «no reconocí ningún reproductor» NO es «tu página no tiene video».
  assert.equal(estadoVideo(A('<video src="a.mp4"></video>').piezas).estado, 'medible');
  assert.equal(estadoVideo(drive.piezas).estado, 'no-medible');
  assert.equal(estadoVideo(A('<p>sin video</p>').piezas).estado, 'no-reconocido');
  assert.equal(estadoVideo(null).estado, 'no-se', 'sin análisis no se afirma nada');
});

test('el id de la página es el MISMO que manda el snippet, prefijo incluido', () => {
  // ⚠️ SI LOS DOS LADOS NO DERIVAN EL MISMO ID, el video sale DOS VECES en la
  // pantalla que los nombra: una fila con eventos y sin URL, otra con URL y sin
  // actividad, y nombrar una no nombra la otra.
  //
  // ⚠️ Y EL CASO DE WISTIA CAMBIÓ DE SIGNO EL 27/09/2026. Este test afirmaba que el
  // custom element y el embed clásico eran DOS ids para la misma media, y no estaba
  // mal escrito: reflejaba fielmente lo que el código hacía a propósito. Lo que se
  // revirtió es la decisión — «es error nuestro permitir que un mismo video pueda
  // tener varios ID» —, así que ahora las dos formas tienen que dar el MISMO id.
  // Quien vuelva a partirlas rompe esta línea, que es el punto.
  const id = (html: string) => videosDeHtml('https://x.com', html)[0]?.id;
  assert.equal(id('<video id="vsl" src="/a.mp4"></video>'), 'v:vsl');
  assert.equal(id('<wistia-player media-id="y4reukhgq8"></wistia-player>'), 'w:y4reukhgq8');
  // Las dos formas de embeber la MISMA media dan el mismo id, y se afirma con el
  // mismo hashedId a la vista para que no se pueda leer distraído.
  assert.equal(id('<iframe src="https://fast.wistia.net/embed/iframe/y4reukhgq8"></iframe>'), 'w:y4reukhgq8');
  assert.equal(id('<div class="wistia_async_y4reukhgq8"></div>'), 'w:y4reukhgq8');
  assert.equal(
    id('<wistia-player media-id="y4reukhgq8"></wistia-player>'),
    id('<iframe src="https://fast.wistia.net/embed/iframe/y4reukhgq8"></iframe>'),
    'el custom element y el iframe son la misma media: un solo id',
  );
  assert.equal(id('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>'), 'yt:dQw4w9WgXcQ');
  assert.equal(id('<iframe src="https://player.vimeo.com/video/123456789"></iframe>'), 'vimeo:123456789');
  assert.equal(id('<iframe src="https://drive.google.com/file/d/1Yf516z3y_5CVurkydHkq/preview"></iframe>'), 'drive:1Yf516z3y_5CVurkydHkq');
  // Panda es el único sin prefijo: su id es un UUID y no se confunde con nada.
  assert.equal(id('<iframe src="https://player-vz-1.tv.pandavideo.com.br/embed/?v=1b9db76c-6bbb-4837-8274-96896c3d8b47"></iframe>'), '1b9db76c-6bbb-4837-8274-96896c3d8b47');

  // Y el prefijo del catálogo tiene que ser el que de verdad se emite: sin esto,
  // agregar un host con el prefijo mal escrito no falla en ningún lado.
  for (const h of HOSTS_VIDEO) {
    if (!h.prefijo) continue;
    assert.ok(h.prefijo.endsWith(':'), `el prefijo de ${h.pieza} tiene que terminar en dos puntos`);
    assert.equal(hostDeVideoId(`${h.prefijo}abc123`)?.pieza, h.pieza, `hostDeVideoId no reconoce ${h.prefijo}`);
  }
  // `vimeo:` y `v:` empiezan igual: el más largo gana, o todo Vimeo se leería
  // como un video propio de la página.
  assert.equal(hostDeVideoId('vimeo:123')?.pieza, 'video-vimeo');
  assert.equal(hostDeVideoId('v:x.mp4')?.pieza, 'video-nativo');

  // ⚠️ Y LOS ALIAS TAMBIÉN. Acá contestaba **null** para `wistia:` —un prefijo que
  // este mismo archivo emitía— y para toda la familia por nombre de etiqueta, medido
  // el 27/09/2026. Un `null` de un lector de prefijos no se lee como un error: se lee
  // como «ese id no es de ningún host», y río abajo le calculaba el avance con la
  // duración de otro video.
  for (const al of ALIAS_VIDEO_ID) {
    assert.equal(
      hostDeVideoId(`${al.de}abc123`)?.pieza,
      hostDeVideoId(`${al.a}abc123`)?.pieza,
      `hostDeVideoId no resuelve el alias ${al.de} igual que ${al.a}`,
    );
  }
});

test('el catálogo está completo: ninguna pieza de video sin sus datos', () => {
  // La pregunta que este test contesta no es «¿este archivo cumple su regla?»
  // sino «¿qué pieza se olvidó en algún registro?». La lista estaba copiada en
  // ocho lugares y olvidarse de una fallaba en silencio y distinto cada vez.
  for (const h of HOSTS_VIDEO) {
    assert.ok(esPiezaDeVideo(h.pieza), `${h.pieza} no se reconoce como pieza de video`);
    // El nombre entra en una frase («le agregaste ___ a tu página»), así que
    // arranca en minúscula y con su artículo.
    assert.match(h.nombre, /^(un|una|el|la) /, `${h.pieza} sin un nombre que entre en una frase: ${h.nombre}`);
    assert.ok(h.desde >= 1 && h.desde <= DETECTORES_VERSION, `${h.pieza} tiene un «desde» fuera del rango del catálogo`);
    // Un detector que matchea un HTML vacío marca la pieza en TODA página.
    assert.ok(!h.reHtml.test(''), `el detector de ${h.pieza} matchea un HTML vacío`);
    if (h.reBundle) assert.ok(!h.reBundle.test(''), `el detector de bundle de ${h.pieza} matchea un texto vacío`);
  }
  assert.ok(HOSTS_VIDEO.some((h) => !h.medible), 'si todos fueran medibles, el estado «no-medible» quedaría sin probar');
});

test('detecta cómo capta esa página, que es lo que cambia los pasos', () => {
  assert.ok(A('<form><input name="email"></form>').piezas.has('formulario'));
  // El CTA embebido es la pieza que MÁS cambia la prueba: lo que pasa dentro de
  // ese iframe es de otro dominio y ningún pixel del mundo lo ve.
  assert.ok(A('<div class="calendly-inline-widget"></div>').piezas.has('embed-agenda'));
  assert.ok(A('<iframe src="https://tally.so/r/abc"></iframe>').piezas.has('embed-agenda'));
  assert.ok(A('<a href="https://wa.me/5219981234567">Escribinos</a>').piezas.has('link-whatsapp'));
  // Un <a> SIN href no cuenta: no navega a ningún lado.
  assert.ok(A('<a>no soy un link</a>').piezas.size === 0);
  assert.ok(A('<a href="/gracias">ir</a>').piezas.has('botones'));
  assert.ok(A('<button>Enviar</button>').piezas.has('botones'));
});

test('lee el estado del Pixel EN ESA PÁGINA', () => {
  const html = `<script>var TOKEN = 'mko_abc123'; var SV = 9;</script>`;
  const a = A(html);
  assert.ok(a.piezas.has('pixel'));
  assert.equal(a.tokenPixel, 'mko_abc123');
  assert.equal(a.versionPixel, 9);
  // (Hasta el 06/10/2026 el análisis también leía el proyecto de Clarity de la
  // página. Clarity salió del producto: ya no hay nada que comparar.)
  // ⚠️ El token permite decir «esta landing tiene el código de OTRO workspace»,
  // que pasa al copiar y pegar entre clientes y es invisible de cualquier otra
  // forma: los eventos llegan, pero al CRM equivocado.
  assert.equal(A('<html></html>').tokenPixel, null);
  assert.equal(A('<html></html>').versionPixel, null);
});

test('el token del Pixel se lee con el nombre nuevo (v23) y desde la LÍNEA del cargador', () => {
  // Desde la v23 (09/10/2026) el token viaja en `var CUENTA` —`var TOKEN` lo tapaba con
  // ******** el editor con IA de un cliente— y una página con el cargador de una línea
  // (lib/pixel-cargador.ts) no trae el código: trae `/m.js?id=<token>`. Sin leer las dos
  // formas nuevas, «esta landing tiene el código de OTRO workspace» deja de verse justo en
  // las páginas que se instalan como se pide ahora.
  //
  // PROBADO ROMPIÉNDOLO (09/10/2026, con 9 / 0 en este archivo antes):
  //   · la regex del token sin `CUENTA` (sólo `var TOKEN`) → 8 pass / 1 fail (éste)
  //   · sin la rama `tokenDelCargador`                     → 8 pass / 1 fail (éste)
  const cuenta = A(`<script>var CUENTA = 'mko_cuenta123'; var SV = 23;</script>`);
  assert.ok(cuenta.piezas.has('pixel'));
  assert.equal(cuenta.tokenPixel, 'mko_cuenta123');
  assert.equal(cuenta.versionPixel, 23);

  const linea = A(`<body><script src="https://hola-mako.com/m.js?id=mko_${'e5'.repeat(16)}" defer></script></body>`);
  assert.ok(linea.piezas.has('pixel'), 'la página con la línea del cargador tiene el Pixel');
  assert.equal(linea.tokenPixel, `mko_${'e5'.repeat(16)}`);
  // La versión no está en el HTML: la sirve el cargador, y es la del día.
  assert.equal(linea.versionPixel, null);
});

test('el caso de Mauricio: agenda embebida y ningún botón propio', () => {
  // Es la landing que destapó todo esto. Con la lista vieja le quedaban dos
  // puntos en rojo para siempre.
  const a = A('<video src="v.mp4"></video><div class="calendly-inline-widget"></div>');
  assert.ok(tieneVideoMedible(a.piezas), 'su video SÍ se mide');
  assert.ok(a.piezas.has('embed-agenda'), 'su CTA es un embed');
  assert.ok(!a.piezas.has('formulario'), 'no tiene formulario propio');
  assert.ok(!a.piezas.has('botones'), 'ni botones propios');
});

test('⚠️ falla hacia «no sé», nunca hacia «no tiene»', () => {
  // Si la página no se puede leer, la prueba tiene que ofrecer TODOS los pasos.
  // Un análisis fallido que apaga chequeos esconde justo los problemas que la
  // prueba viene a encontrar.
  const caido = async () => { throw new Error('boom'); };
  return analizarLanding('https://x.com', caido as unknown as typeof fetch).then((a) => {
    assert.equal(a.ok, false, 'un análisis fallido NO puede pasar por bueno');
    assert.equal(a.piezas.size, 0);
    assert.match(a.error ?? '', /No se pudo leer/);
  });
});

test('un 403 se distingue de una página vacía', () => {
  const bloquea = async () => ({ ok: false, status: 403 }) as Response;
  return analizarLanding('https://x.com', bloquea as unknown as typeof fetch).then((a) => {
    assert.equal(a.ok, false);
    assert.match(a.error ?? '', /403/, 'el motivo tiene que decir qué pasó, no «falló»');
  });
});

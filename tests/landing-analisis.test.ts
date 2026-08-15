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
import { analizarHtml, analizarLanding, tieneVideoMedible, videosNoMedibles } from '../lib/landing-analisis';

const A = (html: string) => analizarHtml('https://x.com', html);

test('detecta las cuatro clases de video, y sabe cuáles puede medir', () => {
  assert.ok(A('<video controls src="a.mp4"></video>').piezas.has('video-nativo'));
  assert.ok(A('<iframe src="https://player-vz-1.tv.pandavideo.com.br/embed/?v=x"></iframe>').piezas.has('video-panda'));
  assert.ok(A('<iframe src="https://www.youtube.com/embed/abc"></iframe>').piezas.has('video-youtube'));
  assert.ok(A('<iframe src="https://player.vimeo.com/video/1"></iframe>').piezas.has('video-vimeo'));
  // ⚠️ Solo dos se pueden MEDIR. YouTube y Vimeo no emiten los eventos que
  // escuchamos: callarlo deja al cliente esperando una retención que no va a
  // llegar nunca.
  assert.ok(tieneVideoMedible(A('<video></video>')));
  assert.ok(tieneVideoMedible(A('<iframe src="pandavideo.com/x"></iframe>')));
  assert.ok(!tieneVideoMedible(A('<iframe src="youtube.com/embed/x"></iframe>')));
  assert.deepEqual(videosNoMedibles(A('<iframe src="youtube.com/embed/x"></iframe>')), ['YouTube']);
  assert.deepEqual(videosNoMedibles(A('<video></video>')), [], 'un video medible no se anuncia como problema');
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
  const html = `<script>var TOKEN = 'mko_abc123'; var SV = 9; (function(c,l,a,r,i){})(window,document,"clarity","script","y2vjnv3kr3");</script>`;
  const a = A(html);
  assert.ok(a.piezas.has('pixel'));
  assert.equal(a.tokenPixel, 'mko_abc123');
  assert.equal(a.versionPixel, 9);
  assert.equal(a.clarityProjectId, 'y2vjnv3kr3');
  // ⚠️ El token permite decir «esta landing tiene el código de OTRO workspace»,
  // que pasa al copiar y pegar entre clientes y es invisible de cualquier otra
  // forma: los eventos llegan, pero al CRM equivocado.
  assert.equal(A('<html></html>').tokenPixel, null);
  assert.equal(A('<html></html>').versionPixel, null);
});

test('el caso de Mauricio: agenda embebida y ningún botón propio', () => {
  // Es la landing que destapó todo esto. Con la lista vieja le quedaban dos
  // puntos en rojo para siempre.
  const a = A('<video src="v.mp4"></video><div class="calendly-inline-widget"></div>');
  assert.ok(tieneVideoMedible(a), 'su video SÍ se mide');
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

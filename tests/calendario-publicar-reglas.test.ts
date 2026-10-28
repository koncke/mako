// =============================================================================
// Publicar desde el Calendario: las reglas (lib/calendario-publicar-reglas.ts, puro) — 28/10/2026
// =============================================================================
// Martín a Teo (28/10): «publicás reels e historias desde el Calendar los días y a la hora que elijas». Una «Publicación» del
// Calendario se programa en la red por Zernio. Lo que tiene que pasar, y lo que un cambio ingenuo rompe:
//
//   1. LA HORA ES UN INSTANTE: el post sale con `scheduledFor` en UTC (con su Z). Un evento «todo el día» no se programa: se
//      publicaría a la medianoche. Tampoco uno que ya pasó.
//   2. CADA RED CON LO SUYO: un reel es un video; TikTok y YouTube, sólo video; el formato «Anuncio» o «Email» no se publica.
//   3. EL ARCHIVO ES DEL NEGOCIO Y DEL EVENTO: la ruta se valida por SEGMENTOS (AGENTS.md), nunca por prefijo: `3/…` no es `30/…`.
//   4. LA FIRMA DURA HASTA DESPUÉS DE PUBLICAR: Zernio lee la media cuando publica, días después de programarla.
//   5. EL ESTADO DE ZERNIO SE TRADUCE SIN INVENTAR: «scheduled» o «publishing» siguen esperando; «partial» es un fallo.
//
// Correr: node --import tsx --test tests/calendario-publicar-reglas.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cuerpoDelPost, estadoDeZernio, motivoParaNoProgramar, rutaDelArchivo, rutaValida, segundosDeFirma, tipoDeArchivo, TOPE_TEXTO,
  type EventoParaPublicar,
} from '../lib/calendario-publicar-reglas';

const AHORA = Date.parse('2026-11-02T12:00:00Z');
const EV: EventoParaPublicar = {
  id: 'evabc123', tipo: 'publicacion', formato: 'reel', titulo: 'Reel del lunes', inicio: '2026-11-03T13:00:00+00:00', dia_completo: false,
  estado: 'planeado', red: 'instagram', cuenta_red: 'acc_ig_1', archivo: '3/calendario/evabc123/k3j4h5g6.mp4', archivo_tipo: 'video',
  texto: 'Mirá esto 👀', post_id: null, publicacion: null, publicacion_motivo: null, publicacion_url: null,
};

test('un evento completo se programa; lo que falta se dice en palabras', () => {
  assert.equal(motivoParaNoProgramar(EV, AHORA), null);
  const casos: Array<[Partial<EventoParaPublicar>, RegExp]> = [
    [{ tipo: 'bloque', formato: null }, /Publicación/],
    [{ dia_completo: true }, /hora/],
    [{ inicio: '2026-11-02T12:03:00Z' }, /ya pasó|minutos/],
    [{ inicio: '2026-11-01T12:00:00Z' }, /ya pasó/],
    [{ red: null }, /cuenta/],
    [{ cuenta_red: null }, /cuenta/],
    [{ archivo: null }, /archivo/],
    [{ publicacion: 'programada', post_id: 'p1' }, /Ya está programada/],
    [{ publicacion: 'programando' }, /Ya está programada/],
    [{ publicacion: 'publicada' }, /Ya se publicó/],
    [{ estado: 'hecho' }, /publicada/],
    [{ texto: 'x'.repeat(TOPE_TEXTO + 1) }, /2200|2\.200/],
  ];
  for (const [cambio, re] of casos) {
    const m = motivoParaNoProgramar({ ...EV, ...cambio }, AHORA);
    assert.ok(m && re.test(m), `${JSON.stringify(cambio)} → ${m}`);
  }
  // Un fallo anterior se puede volver a programar.
  assert.equal(motivoParaNoProgramar({ ...EV, publicacion: 'fallo', publicacion_motivo: 'x' }, AHORA), null);
});

test('cada red con lo suyo: un reel es un video, TikTok y YouTube sólo video, y un anuncio no se publica', () => {
  assert.match(motivoParaNoProgramar({ ...EV, archivo_tipo: 'image', archivo: '3/calendario/evabc123/k3j4h5g6.jpg' }, AHORA) ?? '', /video/);
  assert.equal(motivoParaNoProgramar({ ...EV, formato: 'story', archivo_tipo: 'image', archivo: '3/calendario/evabc123/k3j4h5g6.jpg' }, AHORA), null);
  assert.equal(motivoParaNoProgramar({ ...EV, formato: 'post', archivo_tipo: 'image', archivo: '3/calendario/evabc123/k3j4h5g6.jpg' }, AHORA), null);
  assert.equal(motivoParaNoProgramar({ ...EV, red: 'tiktok' }, AHORA), null);
  assert.match(motivoParaNoProgramar({ ...EV, red: 'tiktok', formato: 'story' }, AHORA) ?? '', /TikTok/);
  assert.match(motivoParaNoProgramar({ ...EV, red: 'youtube', formato: 'post', archivo_tipo: 'image', archivo: '3/calendario/evabc123/k3j4h5g6.png' }, AHORA) ?? '', /YouTube/);
  for (const formato of ['ad', 'email', 'otro'] as const) assert.ok(motivoParaNoProgramar({ ...EV, formato }, AHORA), formato);
});

test('el cuerpo del post: el instante en UTC con su Z, la red con su tipo de contenido y el eco del evento', () => {
  const c = cuerpoDelPost(EV, 'https://supa.test/firmado.mp4');
  assert.equal(c.scheduledFor, '2026-11-03T13:00:00.000Z');
  assert.equal('timezone' in c, false, 'con Z, la zona la ignora Zernio: no se manda');
  assert.deepEqual(c.platforms, [{ platform: 'instagram', accountId: 'acc_ig_1', platformSpecificData: { contentType: 'reel' } }]);
  assert.deepEqual(c.mediaItems, [{ type: 'video', url: 'https://supa.test/firmado.mp4' }]);
  assert.equal(c.content, 'Mirá esto 👀');
  assert.deepEqual(c.metadata, { calendarioEventoId: 'evabc123' });
  // Un post sin texto no manda `content` vacío; YouTube lleva el título.
  assert.equal('content' in cuerpoDelPost({ ...EV, texto: '' }, 'u'), false);
  assert.equal(cuerpoDelPost({ ...EV, red: 'youtube' }, 'u').title, 'Reel del lunes');
  assert.deepEqual(cuerpoDelPost({ ...EV, formato: 'story', archivo_tipo: 'image' }, 'u').platforms[0].platformSpecificData, { contentType: 'story' });
  assert.equal(cuerpoDelPost({ ...EV, formato: 'post', archivo_tipo: 'image' }, 'u').platforms[0].platformSpecificData, undefined);
});

test('el archivo: la ruta se arma y se valida por segmentos, y sólo imágenes y videos que la red acepta', () => {
  const r = rutaDelArchivo(3, 'evabc123', 'video/mp4', 'k3j4h5g6');
  assert.equal(r, '3/calendario/evabc123/k3j4h5g6.mp4');
  assert.equal(rutaValida(r, 3, 'evabc123'), true);
  assert.equal(rutaValida(r, 30, 'evabc123'), false, 'el ws 30 no es el 3');
  assert.equal(rutaValida('30/calendario/evabc123/k3j4h5g6.mp4', 3, 'evabc123'), false, 'por prefijo, «3» casaría con «30»');
  assert.equal(rutaValida(r, 3, 'evotro'), false);
  for (const mala of ['3/calendario/evabc123/../4/x.mp4', '3/calendario/evabc123/x.exe', '3/calendario/evabc123/a/b.mp4', '/3/calendario/evabc123/k3j4h5g6.mp4']) {
    assert.equal(rutaValida(mala, 3, 'evabc123'), false, mala);
  }
  assert.equal(tipoDeArchivo('image/jpeg'), 'image');
  assert.equal(tipoDeArchivo('video/quicktime'), 'video');
  assert.equal(tipoDeArchivo('image/gif'), null);
  assert.equal(tipoDeArchivo('application/pdf'), null);
  assert.equal(rutaDelArchivo(3, 'evabc123', 'application/pdf', 'k3j4h5g6'), null);
});

test('la firma de la media dura hasta 7 días DESPUÉS de publicar (Zernio la lee al publicar)', () => {
  const dias = (s: number) => s / 86_400;
  assert.ok(dias(segundosDeFirma('2026-11-03T13:00:00Z', AHORA)) > 8, 'mañana + 7 días');
  assert.ok(dias(segundosDeFirma('2026-11-30T13:00:00Z', AHORA)) > 34);
});

test('el estado de Zernio, sin inventar: esperar, publicada con su link, o fallo con su motivo', () => {
  assert.equal(estadoDeZernio({ status: 'scheduled' }), null);
  assert.equal(estadoDeZernio({ status: 'publishing' }), null);
  assert.deepEqual(estadoDeZernio({ status: 'published', platforms: [{ status: 'published', platformPostUrl: 'https://instagram.com/p/x' }] }),
    { publicacion: 'publicada', motivo: null, url: 'https://instagram.com/p/x' });
  assert.deepEqual(estadoDeZernio({ status: 'failed', platforms: [{ status: 'failed', errorMessage: 'Media too large' }] }),
    { publicacion: 'fallo', motivo: 'Media too large', url: null });
  assert.equal(estadoDeZernio({ status: 'partial' })?.publicacion, 'fallo');
  assert.equal(estadoDeZernio({ status: 'algo-nuevo' }), null, 'un estado que no conocemos no se da por publicado');
});

// Subir creativos nuevos a un conjunto por Zernio (lib/media-buyer/creativos.ts): el cuerpo de `POST /v1/ads/create` en la
// forma «attach» y lo que no se puede publicar. Contrato del OpenAPI v1.353.0 de Zernio (25/10/2026).
// Verificado rompiéndolo: con el video por imageUrl y un link http aceptado, 2 fallos y 3 pases. Restaurado, 5 de 5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cuerpoCreativoEnConjunto, errorDeTextos, nombreDeAnuncio, type TextosCreativo } from '../lib/media-buyer/creativos';

const conexion = { accountId: 'zacc1', adAccountId: 'act_1426493815659364' };
const textos: TextosCreativo = { textoPrincipal: 'Agenda tu diagnóstico gratis.', titulo: 'Diagnóstico gratis', cta: 'LEARN_MORE', link: 'https://hola-mako.com/vsl', formularioId: null };

test('una imagen va por imageUrl, en el conjunto, con los textos que Meta exige', () => {
  const c = cuerpoCreativoEnConjunto({ conexion, adSetId: '120', nombre: 'Foto 1 · MaKo', archivo: { path: 'p/a.jpg', tipo: 'image', nombre: 'a.jpg' }, urlDescarga: 'https://x/a.jpg?token=1', textos, activo: true });
  assert.equal(c.adSetId, '120');
  assert.equal(c.imageUrl, 'https://x/a.jpg?token=1');
  assert.equal(c.video, undefined);
  assert.equal(c.status, 'ACTIVE');
  for (const k of ['body', 'headline', 'callToAction', 'linkUrl']) assert.ok(c[k], `falta ${k}`);
  assert.equal(c.adAccountId, 'act_1426493815659364');
});

test('un video va por video.url (Zernio lo sube y espera a Meta), nunca por imageUrl', () => {
  const c = cuerpoCreativoEnConjunto({ conexion, adSetId: '120', nombre: 'V', archivo: { path: 'p/v.mp4', tipo: 'video', nombre: 'v.mp4' }, urlDescarga: 'https://x/v.mp4', textos, activo: false });
  assert.deepEqual(c.video, { url: 'https://x/v.mp4' });
  assert.equal(c.imageUrl, undefined);
  assert.equal(c.status, 'PAUSED', 'en pausa pausa sólo el anuncio nuevo (forma attach)');
});

test('con formulario instantáneo va el formulario y el link no es obligatorio', () => {
  const t = { ...textos, link: null, formularioId: '998877' };
  assert.equal(errorDeTextos(t), null);
  const c = cuerpoCreativoEnConjunto({ conexion, adSetId: '1', nombre: 'n', archivo: { path: 'p', tipo: 'image', nombre: 'a.png' }, urlDescarga: 'https://x', textos: t, activo: true });
  assert.equal(c.leadGenFormId, '998877');
  assert.equal(c.linkUrl, undefined);
});

test('lo que no se publica se dice antes: sin texto, sin título, sin destino, un link que no es https', () => {
  assert.match(errorDeTextos({ ...textos, textoPrincipal: '  ' })!, /texto principal/);
  assert.match(errorDeTextos({ ...textos, titulo: '' })!, /título/);
  assert.match(errorDeTextos({ ...textos, link: null })!, /link/);
  assert.match(errorDeTextos({ ...textos, link: 'http://inseguro.com' })!, /link/);
  assert.equal(errorDeTextos(textos), null);
});

test('el nombre del anuncio sale del archivo, con la marca de MaKo', () => {
  assert.equal(nombreDeAnuncio('hook_dolor-v2.mp4', 0), 'hook dolor v2 · MaKo');
  assert.equal(nombreDeAnuncio('.png', 2), 'Creativo 3 · MaKo');
});

// ── Los hooks de un video ganador como guion para el Video Generator (lib/media-buyer/hooks-guion.ts) ──
// Verificado rompiéndolo: con el cuerpo sin sacar el gancho viejo, 1 fallo y 6 pases. Restaurado, 7 de 7.
import { guionDeHook, primeraFrase } from '../lib/media-buyer/hooks-guion';

test('el hook nuevo REEMPLAZA la primera frase del ganador y conserva el cuerpo, con los rótulos del guion', () => {
  const t = '¿Sigues perdiendo leads? Te cuento cómo lo resolvimos. Agenda tu diagnóstico.';
  assert.equal(primeraFrase(t), '¿Sigues perdiendo leads?');
  assert.equal(guionDeHook('El 60% de tus leads se enfría en una hora.', t), 'GANCHO\nEl 60% de tus leads se enfría en una hora.\n\nHISTORIA\nTe cuento cómo lo resolvimos. Agenda tu diagnóstico.');
});

test('sin transcripción, el guion es sólo el gancho (se filma igual y se monta sobre el video)', () => {
  assert.equal(guionDeHook('Mira esto antes de pautar.', null), 'GANCHO\nMira esto antes de pautar.');
});

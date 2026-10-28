// =============================================================================
// Instagram orgánico por Zernio: las reglas (lib/organico-reglas.ts, puro) — 28/10/2026
// =============================================================================
// Martín a Teo (28/10, 00:16:26): «por WhatsApp preguntás cómo vienen las últimas publicaciones de Instagram». MaKo lee de
// Zernio la cuenta (alcance, vistas, interacciones), los seguidores y las publicaciones con sus métricas. Lo que se fija:
//
//   1. «NO PUDE LEER» NO ES «CERO»: una respuesta sin la métrica, o con una forma que no conocemos, da null, nunca 0. Un 0
//      que no se midió le diría al cliente que nadie vio su reel.
//   2. EL COMPLEMENTO DE ANALYTICS: Zernio lo cobra aparte; sin él contesta 402, y eso se dice en palabras (no «error»).
//   3. EL RANGO: Zernio corta en 89 días los seguidores y en 90 la cuenta: se valida antes de llamar.
//   4. LAS PUBLICACIONES con su tipo (reel, story, post), su link y sus números, de la más nueva a la más vieja.
//
// Correr: node --import tsx --test tests/organico-reglas.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  motivoDeStatus, publicacionesDe, rangoOrganico, seguidoresDe, TEXTO_MOTIVO_ORGANICO, totalesDeInsights,
} from '../lib/organico-reglas';

test('la cuenta: los totales que vinieron; lo que no vino es null, nunca 0', () => {
  const r = totalesDeInsights({ success: true, metrics: { reach: { total: 1520 }, views: { total: 4300 }, total_interactions: { total: 0 } } }, ['reach', 'views', 'total_interactions', 'saves']);
  assert.deepEqual(r, { reach: 1520, views: 4300, total_interactions: 0, saves: null });
  // Un total que falta pero viene la serie: se suma la serie.
  assert.deepEqual(totalesDeInsights({ metrics: { reach: { values: [{ date: '2026-10-01', value: 10 }, { date: '2026-10-02', value: 5 }] } } }, ['reach']), { reach: 15 });
  // Una forma que no conocemos no es «cero en todo».
  assert.equal(totalesDeInsights({ data: [] }, ['reach']), null);
  assert.equal(totalesDeInsights(null, ['reach']), null);
  assert.deepEqual(totalesDeInsights({ metrics: { reach: { total: 'mucho' } } }, ['reach']), { reach: null });
});

test('los seguidores: el último conteo, ganados y perdidos, y la serie por día', () => {
  const r = seguidoresDe({ metrics: {
    follower_count: { values: [{ date: '2026-10-01', value: 980 }, { date: '2026-10-28', value: 1012 }] },
    followers_gained: { total: 40 }, followers_lost: { total: 8 },
  } });
  assert.deepEqual(r, { actual: 1012, ganados: 40, perdidos: 8, serie: [{ fecha: '2026-10-01', valor: 980 }, { fecha: '2026-10-28', valor: 1012 }] });
  assert.equal(seguidoresDe({ metrics: {} })?.actual, null);
  assert.equal(seguidoresDe({ otra: 'cosa' }), null);
});

test('las publicaciones: tipo, link y números, de la más nueva a la más vieja; sin lista no es «no hay»', () => {
  const body = { posts: [
    { postId: 'p1', content: 'Un reel '.repeat(40), publishedAt: '2026-10-20T15:00:00Z', platformPostUrl: 'https://www.instagram.com/reel/a/', mediaType: 'reel', analytics: { reach: 900, views: 2100, likes: 80, comments: 6, shares: 4, saves: 12, engagementRate: 11.3 } },
    { postId: 'p2', content: '', publishedAt: '2026-10-25T15:00:00Z', platformPostUrl: 'https://www.instagram.com/stories/x/1/', mediaType: 'story', analytics: { reach: 300 } },
    { postId: 'p3', content: 'Foto', publishedAt: '2026-10-22T15:00:00Z', mediaType: 'image', analytics: {} },
  ] };
  const r = publicacionesDe(body);
  assert.ok(r);
  assert.deepEqual(r.map((p) => p.id), ['p2', 'p3', 'p1']);
  assert.deepEqual(r.map((p) => p.tipo), ['story', 'post', 'reel']);
  const reel = r[2];
  assert.equal(reel.texto.length <= 140, true, 'el texto va cortado');
  assert.deepEqual({ alcance: reel.alcance, vistas: reel.vistas, meGusta: reel.meGusta, comentarios: reel.comentarios, compartidos: reel.compartidos, guardados: reel.guardados, interaccion: reel.interaccionPct },
    { alcance: 900, vistas: 2100, meGusta: 80, comentarios: 6, compartidos: 4, guardados: 12, interaccion: 11.3 });
  assert.equal(r[1].alcance, null, 'sin la métrica, null');
  assert.equal(r[1].url, null);
  // Otras formas de la lista que Zernio usa en sus listados.
  assert.equal(publicacionesDe({ data: body.posts })?.length, 3);
  assert.deepEqual(publicacionesDe({ posts: [] }), []);
  assert.equal(publicacionesDe({ success: true }), null, 'un objeto sin lista no es «no hay publicaciones»');
});

test('el complemento de Analytics y los demás motivos, en palabras', () => {
  assert.equal(motivoDeStatus(402), 'sin-analytics');
  assert.equal(motivoDeStatus(401), 'clave-mala');
  assert.equal(motivoDeStatus(403), 'clave-mala');
  assert.equal(motivoDeStatus(404), 'sin-cuenta');
  assert.equal(motivoDeStatus(500), 'error');
  assert.equal(motivoDeStatus(0), 'error');
  assert.match(TEXTO_MOTIVO_ORGANICO['sin-analytics'], /Analytics/);
});

test('el rango: por defecto los últimos 30 días; Zernio corta en 89', () => {
  assert.deepEqual(rangoOrganico(null, null, '2026-10-28'), { desde: '2026-09-29', hasta: '2026-10-28' });
  assert.deepEqual(rangoOrganico('2026-10-01', '2026-10-28', '2026-10-28'), { desde: '2026-10-01', hasta: '2026-10-28' });
  assert.ok('error' in rangoOrganico('2026-01-01', '2026-10-28', '2026-10-28'), 'más de 89 días');
  assert.ok('error' in rangoOrganico('2026-10-28', '2026-10-01', '2026-10-28'), 'al revés');
  assert.ok('error' in rangoOrganico('28/10/2026', null, '2026-10-28'));
  assert.deepEqual(rangoOrganico('2026-10-20', null, '2026-10-28'), { desde: '2026-10-20', hasta: '2026-10-28' });
});

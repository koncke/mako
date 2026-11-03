// =============================================================================
// Sus OTRAS redes, por búsqueda, y VALIDADAS (ítems 10/11 de Competitors Spy, 3/11/2026)
// =============================================================================
// Martín: «con un dato, traer todas sus redes» y «súper importante que lo valides… ¿este es el
// YouTube de esta persona?». Lo que se cuida acá:
//   1. que de la página de Google salgan PERFILES, no videos sueltos ni alias que no se resuelven;
//   2. que de una red que el competidor YA tiene no se ofrezca nada (los otros con su nombre son
//      otras personas: con «Sofia Contreras» vinieron cinco Instagram distintos);
//   3. que la búsqueda NO ESCRIBA en la base: lo único que guarda es el «sí» de la persona.
//
// Las respuestas de abajo son la forma REAL del actor, medida el 3/11/2026 con
// `scripts/probar-otras-redes-apify.mjs` («Leila Hormozi» y «Sofia Contreras», ws 9).
//
// PROBADO ROMPIÉNDOLO (3/11/2026), con el archivo en 9 / 0, una rotura por vez y restaurada:
//   · `candidatosDeLaRespuesta` sin el descarte de la red que ya tiene  → 8 / 1
//   · `redDeUrl` que acepta `/watch` como canal                          → 6 / 3
//   · `redDeUrl` que convierte `/c/<alias>` en `@alias`                  → 7 / 2
//   · sin el tope de 3 por red                                           → 8 / 1
//   · `lib/spy-otras-redes.ts` que importa `getTenantDb`                 → 8 / 1
// Correr: node --import tsx --test tests/spy-otras-redes.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { candidatosDeLaRespuesta, consultaDeRedes, redDeUrl, USD_POR_BUSQUEDA_REDES } from '../lib/spy-otras-redes-reglas';
import { canalDeLaBio } from '../lib/spy-reglas';
import { canalDeUrl } from '../lib/spy-youtube';

const pagina = (...urls: string[]) => [{ organicResults: urls.map((url, i) => ({ url, title: `r${i}` })) }];
const NADA = { instagram: null, youtube_id: null, tiktok: null };

// La página de «Leila Hormozi», tal cual vino (sin los títulos).
const LEILA = pagina(
  'https://www.youtube.com/@leilahormozi',
  'https://www.instagram.com/leilahormozi/',
  'https://www.youtube.com/watch?v=w_yU1xEqXwk',
  'https://www.tiktok.com/@leilahormozi',
  'https://www.youtube.com/playlist?list=PLWgEgLt4u2muCpSQuR2vf-Vhjeif2-AYy',
  'https://www.youtube.com/watch?v=cgsWQd5EM1k',
);

test('de la página de Leila salen sus tres redes y ningún video suelto', () => {
  const c = candidatosDeLaRespuesta(LEILA, NADA);
  assert.deepEqual(c.map((k) => `${k.red}:${k.ref}`), ['youtube:@leilahormozi', 'instagram:leilahormozi', 'tiktok:leilahormozi']);
});

test('de la red que YA tiene no se ofrece nada', () => {
  // Se agregó por su @: su Instagram ya está, y los demás Instagram con su nombre son otra gente.
  const c = candidatosDeLaRespuesta(LEILA, { ...NADA, instagram: 'leilahormozi' });
  assert.deepEqual(c.map((k) => k.red), ['youtube', 'tiktok']);
  assert.deepEqual(candidatosDeLaRespuesta(LEILA, { instagram: 'x', youtube_id: 'UCx', tiktok: 'x' }), []);
});

test('los cinco «Sofia Contreras»: tope de 3 por red, sin repetir, y el /c/ afuera', () => {
  const c = candidatosDeLaRespuesta(pagina(
    'https://www.instagram.com/ssoficontreras/',
    'https://www.instagram.com/soysofiacontreras/',
    'https://www.youtube.com/c/SofiaContreras',
    'https://www.instagram.com/soysofiacontreras/reels/',
    'https://www.instagram.com/sofiacontreras_6/',
    'https://www.instagram.com/sofiacontreras0404/',
  ), NADA);
  assert.deepEqual(c.map((k) => k.ref), ['ssoficontreras', 'soysofiacontreras', 'sofiacontreras_6']);
});

test('redDeUrl: perfiles sí, publicaciones y alias no', () => {
  assert.equal(redDeUrl('https://www.youtube.com/watch?v=abc'), null);
  assert.equal(redDeUrl('https://www.youtube.com/shorts/abc'), null);
  assert.equal(redDeUrl('https://www.youtube.com/c/SofiaContreras'), null);
  assert.equal(redDeUrl('https://www.instagram.com/p/ABC123/'), null);
  assert.equal(redDeUrl('https://example.com/@x'), null);
  assert.equal(redDeUrl('no es un link'), null);
  assert.equal(redDeUrl('https://www.youtube.com/@AlexHormozi/videos')?.ref, '@AlexHormozi');
  assert.equal(redDeUrl('https://m.tiktok.com/@Leila.H/video/123')?.ref, 'leila.h');
  assert.equal(redDeUrl('https://www.youtube.com/channel/UCUyDOdBWhC1MCxEjC46d-zw')?.ref, 'UCUyDOdBWhC1MCxEjC46d-zw');
});

test('todo YouTube que se ofrece lo sabe leer Spy (si no, el «sí» guardaría algo inservible)', () => {
  for (const u of ['https://www.youtube.com/@leilahormozi', 'https://www.youtube.com/channel/UCUyDOdBWhC1MCxEjC46d-zw', 'https://www.youtube.com/user/viejo']) {
    const k = redDeUrl(u);
    assert.ok(k && canalDeUrl(k.url), u);
  }
});

test('la consulta va por el nombre de verdad; con un id de canal por nombre, por su @', () => {
  assert.equal(consultaDeRedes({ nombre: 'Leila Hormozi', instagram: null }), '"Leila Hormozi" (site:youtube.com OR site:tiktok.com OR site:instagram.com)');
  assert.match(consultaDeRedes({ nombre: 'UCUyDOdBWhC1MCxEjC46d-zw', instagram: '@leila' }), /^"leila"/);
  assert.equal(consultaDeRedes({ nombre: '', instagram: null }), '');
});

test('un TikTok en la bio entra como TikTok, no como su landing', () => {
  assert.deepEqual(canalDeLaBio({ campo: 'tiktok', valor: 'leilahormozi' }, 'instagram'), { campo: 'tiktok', valor: 'leilahormozi' });
});

test('la búsqueda NO escribe en la base: sólo el «sí» de la persona guarda', () => {
  const fuente = readFileSync(new URL('../lib/spy-otras-redes.ts', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  for (const prohibido of ['getTenantDb', 'getServiceDb', '.insert(', '.update(', '.upsert(', 'agregarCompetidor']) {
    assert.ok(!fuente.includes(prohibido), `lib/spy-otras-redes.ts usa ${prohibido}`);
  }
});

test('el costo medido sigue escrito: US$0,00455 por búsqueda', () => {
  assert.ok(Math.abs(USD_POR_BUSQUEDA_REDES - 0.00455) < 1e-9);
});

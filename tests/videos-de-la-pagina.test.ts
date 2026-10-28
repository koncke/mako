// =============================================================================
// La prueba del Pixel pregunta sólo por los videos de la página que se prueba (27/10/2026, MAU-14)
// =============================================================================
// Mauricio: la prueba de su página de gracias le pedía nombrar los videos de la principal. El paso que se abre solo antes de la prueba
// mira ahora sólo esa página; el lápiz de «Tus videos» sigue mostrando todos.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mismaPagina, detectadosDeEstaPagina } from '../lib/videos-de-la-pagina';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('la misma página: sin www, sin la barra final, sin consulta ni fragmento, con o sin https', () => {
  assert.equal(mismaPagina('https://www.elevate.com/gracias/', 'elevate.com/gracias?utm_source=fb#top'), true);
  assert.equal(mismaPagina('https://elevate.com/', 'https://elevate.com'), true);
  assert.equal(mismaPagina('https://elevate.com/gracias', 'https://elevate.com/'), false);
  assert.equal(mismaPagina(null, 'https://elevate.com'), false);
  assert.equal(mismaPagina('', ''), false);
});

test('de los detectados, sólo los que viven en la página que se prueba', () => {
  const det = [
    { id: 'vsl', pagina: 'https://elevate.com/' },
    { id: 'gracias', pagina: 'https://elevate.com/gracias' },
    { id: 'sin-pagina', pagina: null },
  ];
  assert.deepEqual(detectadosDeEstaPagina(det, 'https://www.elevate.com/gracias/').map((d) => d.id), ['gracias']);
  assert.deepEqual(detectadosDeEstaPagina(det, 'https://elevate.com').map((d) => d.id), ['vsl']);
});

test('la puerta que se abre sola usa sólo esta página; el lápiz, todos', () => {
  const p = leer('../app/integraciones/ProbarTracking.tsx');
  assert.match(p, /const deEstaPrueba: VideoDetectado\[\] = \[\.\.\.detectadosDeEstaPagina\(detectadosVideo, url\), \.\.\.deLaPagina\];/);
  assert.match(p, /const sinNombre = deEstaPrueba\.filter\(/);
  assert.match(p, /if \(vaAVideos\) \{ setSoloEstaPagina\(true\); setPaso\('videos'\); return; \}/);
  assert.match(p, /onClick=\{\(\) => \{ setSoloEstaPagina\(false\); setPaso\('videos'\); \}\}/);
});

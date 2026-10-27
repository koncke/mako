// =============================================================================
// YouTube sin clave: el canal por el login de Zernio, las vistas del VSL con la clave de MaKo (27/10/2026)
// =============================================================================
// Feedback 876470842-22: «YouTube pide pegar una clave de API». La tarjeta pedía una clave de Google Cloud (crear un proyecto,
// habilitar la Data API, crear la credencial) para leer las vistas del VSL, que son PÚBLICAS. Ahora el canal se conecta con el
// login de Zernio, las vistas se leen con la clave de MaKo, y la tarjeta pide sólo el video. Quien ya tenía su clave (medido:
// Mauricio Bustos, el único con YouTube) la sigue usando, y sigue «conectado» porque tiene el video cargado.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REDES, REDES_VISIBLES } from '../lib/zernio-redes';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('YouTube se conecta con el login de Zernio', () => {
  assert.equal(REDES.youtube.visible, true);
  assert.ok(REDES_VISIBLES.includes('youtube'));
});

test('la tarjeta ya no pide la clave: queda opcional y retirada; «conectado» es tener el video del VSL', () => {
  const cat = leer('../lib/metodo-catalogo.ts');
  const yt = cat.slice(cat.indexOf("key: 'youtube',"), cat.indexOf('tutorial:', cat.indexOf("key: 'youtube',")));
  assert.match(yt, /env: 'YOUTUBE_API_KEY'[^\n]*opcional: true, retirado: true/);
  // El video es lo único obligatorio: es lo que leen los tres lectores de «conectado».
  assert.match(yt, /env: 'YOUTUBE_VSL_VIDEO_ID'/);
  assert.doesNotMatch(yt, /env: 'YOUTUBE_VSL_VIDEO_ID'[^\n]*opcional: true/);
  assert.match(leer('../lib/integraciones-catalogo.ts'), /key: 'youtube'[^\n]*envs: \['YOUTUBE_VSL_VIDEO_ID'\]/);
  // Y el tutorial no manda a Google Cloud.
  const tut = cat.slice(cat.indexOf('tutorial:', cat.indexOf("key: 'youtube',")), cat.indexOf('},\n  },', cat.indexOf("key: 'youtube',")));
  assert.doesNotMatch(tut, /console\.cloud\.google\.com|Clave de API|YouTube Data API v3/);
  assert.match(tut, /Zernio/);
});

test('las vistas se leen con la clave del negocio si la tiene, si no con la de MaKo (son públicas)', () => {
  const y = leer('../lib/youtube.ts');
  const clave = y.slice(y.indexOf('export async function claveDeYoutube('), y.indexOf('\n}\n', y.indexOf('export async function claveDeYoutube(')));
  assert.ok(clave.indexOf("credWs('YOUTUBE_API_KEY')") < clave.indexOf('wsSuperAdmin()'), 'primero la del negocio, después la de la plataforma');
  assert.match(clave, /process\.env\.YOUTUBE_API_KEY/);
  assert.match(y, /const apiKey = await claveDeYoutube\(\);/);
  // Buscar tutoriales usa la MISMA regla (era una copia).
  assert.match(leer('../lib/tutorial-video.ts'), /return claveDeYoutube\(\);/);
  // «Probar conexión» sin clave propia prueba el video con la de MaKo.
  assert.match(leer('../lib/metodo-verificar.ts'), /const clave = v\.YOUTUBE_API_KEY \|\| \(await claveDeYoutube\(\)\);/);
});

test('la pantalla no pide un campo retirado: lo ve sólo quien ya lo tenía', () => {
  assert.match(leer('../app/api/integraciones/credencial/route.ts'), /retirado: !!c\.retirado,/);
  assert.match(leer('../app/integraciones/ServicioConfigForm.tsx'), /\.filter\(\(c\) => !c\.retirado \|\| c\.configurado\)/);
});

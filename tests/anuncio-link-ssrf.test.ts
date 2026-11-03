// Auditoría de seguridad del 01/11/2026: «crear anuncio desde un link» (lib/api-mako/areas/ads.run.ts)
// bajaba el archivo con `fetch` + `redirect: 'follow'`: un link público que redirige a 127.0.0.1 o a la
// metadata de la nube se leía desde nuestro servidor. Ahora baja por `bajarWebSegura` (cada salto
// validado, pedido a la IP ya validada) con el techo de un video de anuncio.
// Probado rompiéndolo: con `fetch(url, { redirect: 'follow' })` de vuelta, el 2 da rojo (y la guarda de
// tests/landing-analisis-ssrf.test.ts también); sin `tipo` en lo que devuelve bajarWebSegura, el 1 da rojo.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { bajarWebSegura, type DepsBajada } from '../lib/archivero-bajada';

const raiz = fileURLToPath(new URL('..', import.meta.url));

test('1. bajarWebSegura frena el salto a una IP privada y devuelve el tipo del archivo', async () => {
  const deps = (destinoFinal: string): DepsBajada => ({
    validar: async (u) => u.includes('127.0.0.1')
      ? { ok: false, error: 'La dirección no es pública.' }
      : { ok: true, url: new URL(u), ips: ['93.184.216.34'] },
    pedir: async (u) => u.hostname === 'cdn.ejemplo.test'
      ? { status: 302, location: destinoFinal, cuerpo: Buffer.alloc(0) }
      : { status: 200, location: null, cuerpo: Buffer.from('mp4'), tipo: 'video/mp4' },
  });
  await assert.rejects(bajarWebSegura('https://cdn.ejemplo.test/v.mp4', deps('http://127.0.0.1/admin')), /no es pública/);
  const r = await bajarWebSegura('https://cdn.ejemplo.test/v.mp4', deps('https://otro.ejemplo.test/v.mp4'));
  assert.equal(r.status, 200);
  assert.equal(r.tipo, 'video/mp4');
});

test('2. el anuncio desde un link baja por bajarWebSegura con el techo del video', () => {
  const src = readFileSync(raiz + 'lib/api-mako/areas/ads.run.ts', 'utf8').replace(/\r\n/g, '\n');
  const sinComentarios = src.replace(/^[ \t]*\/\/.*$/gm, '');
  assert.doesNotMatch(sinComentarios, /redirect: 'follow'/, 'ningún fetch que siga redirects solo');
  assert.match(sinComentarios, /bajarWebSegura\(url, \{ validar, pedir: \(u, ips\) => pedirClavado\(u, ips, undefined, limites\) \}\)/);
  assert.match(sinComentarios, /maxBytes: MAX_VIDEO_BYTES \+ 1/);
});

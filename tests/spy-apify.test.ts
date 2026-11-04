// Competitors Spy lee Instagram por Apify cuando Meta no puede (Martín, 1/11/2026). La clave es del negocio y sólo la usa Spy.
// Probado rompiéndolo:
//   · leerPerfilDeApify sin `conPiezas`                → 1 (perfil sin publicaciones: Spy diría «Meta no entrega los números»)
//   · contar el -1 de los «me gusta» ocultos            → 1
//   · un Video sin formato REELS                        → 1 (la tarjeta diría «Publicación»)
//   · leerPerfilInstagram de Spy sin `ws`               → 2
//   · la clave de Spy afuera de la clave de la caché    → 2 (pegarla seguía diciendo «no pude» 10 minutos)
//   · «Conectar Apify» afuera de la pantalla            → 3

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APIFY_CLAVE_DE_SPY, leerPerfilDeApify } from '../lib/instagram-perfil';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

const ITEM = {
  username: 'DrSquatch', fullName: 'Dr. Squatch', biography: 'Jabón', followersCount: 1200, postsCount: 40, profilePicUrl: 'https://x/y.jpg',
  latestPosts: [
    { shortCode: 'abc', url: 'https://www.instagram.com/p/abc/', type: 'Video', productType: 'clips', caption: 'Reel', timestamp: '2026-10-20T10:00:00.000Z', likesCount: 50, commentsCount: 3, videoViewCount: 900, displayUrl: 'https://c/1.jpg' },
    { shortCode: 'def', url: 'https://www.instagram.com/p/def/', type: 'Image', caption: 'Foto', timestamp: '2026-10-18T10:00:00.000Z', likesCount: -1, commentsCount: 0 },
    { caption: 'sin código: no tiene identidad' },
  ],
};

test('1. las publicaciones del actor salen con la misma forma que las de Meta', () => {
  const r = leerPerfilDeApify('drsquatch', [ITEM], true);
  assert.ok(r.ok);
  const [reel, foto, ...resto] = r.perfil.piezas ?? [];
  assert.deepEqual(resto, [], 'sin un código no hay pieza: el upsert de Spy va por `ref`');
  assert.equal(reel.ref, 'abc');
  assert.equal(reel.formato, 'REELS');
  assert.equal(reel.fecha, '2026-10-20');
  assert.equal(reel.vistas, 900);
  assert.equal(reel.megusta, 50);
  assert.equal(foto.formato, 'FEED');
  assert.equal(foto.megusta, null, 'el -1 de los «me gusta» ocultos no es un número');
  assert.equal(foto.comentarios, 0, 'un cero sí lo es');
  assert.equal(foto.vistas, null);
  // Sin pedirlas, como siempre (el alta del CRM y Offer).
  const sin = leerPerfilDeApify('drsquatch', [ITEM]);
  assert.ok(sin.ok);
  assert.equal(sin.perfil.piezas, undefined);
});

test('2. Spy lee con su negocio y pide la fuente por nombre; pegar la clave no choca con un fallo recordado', () => {
  const spy = leer('lib/spy.ts');
  assert.match(spy, /leerPerfilInstagram\(c\.instagram, \{ ws: await getWorkspaceActual\(\), conPiezas: true, fuentes: \['meta-negocio', 'meta-plataforma', 'apify-spy'\] \}\)/);
  const server = leer('lib/instagram-perfil-server.ts');
  assert.match(server, /\$\{claveDeSpy \? 'spy' : ''\}`;/);
  assert.match(server, /fuentes\.includes\('apify-spy'\) && ws != null \? await credDelCliente\(APIFY_CLAVE_DE_SPY, ws\)/, 'la paga el negocio que la pegó, nunca la plataforma');
  assert.match(server, /opts\.fuentes \?\? \['meta-negocio', 'meta-plataforma', 'apify'\]/, 'sin pedirla, nadie la gasta');
  assert.equal(APIFY_CLAVE_DE_SPY, 'APIFY_INSTAGRAM_TOKEN');
});

test('3. la salida está en la pantalla, y una clave pegada en el chat ofrece conectarla', () => {
  assert.match(leer('app/competitor-spy/SpyApp.tsx'), /<BotonIntegracion servicio="apify-instagram" className="spy-boton" onConectado=\{\(\) => void leer\(c\.id\)\}>/);
  assert.match(leer('lib/claves-en-el-chat.ts'), /servicio: 'apify-instagram' \}/);
});

test('4. lo ya conectado tiene camino: «Volver a conectar» con la cuenta sana', () => {
  const r = leer('app/integraciones/ConectarRedes.tsx');
  assert.match(r, /\{!esAnuncios && sana && \(\n\s*<Button size="sm" variant="secondary"[^>]*data-reconectar-zernio=\{red\}\n\s*onClick=\{\(\) => z\.conectar\(red, \{ reconectarId: sana\.accountId \}\)\}>/);
});

test('5. la tarjeta de YouTube dice para qué es: para leer competidores no pide nada', () => {
  const c = readFileSync(resolve(RAIZ, 'lib/metodo-catalogo.ts'), 'utf8');
  assert.match(c, /Para leer a tus competidores no hace falta nada/);
});
